from dataclasses import dataclass, field
from datetime import datetime, time
from zoneinfo import ZoneInfo

from trading_bot.core.broker import Broker
from trading_bot.utils.logger import log

ET = ZoneInfo("America/New_York")


@dataclass
class SymbolTracker:
    wins: int = 0
    losses: int = 0
    consecutive_losses: int = 0
    blocked: bool = False

    @property
    def total(self) -> int:
        return self.wins + self.losses

    @property
    def win_rate(self) -> float:
        return (self.wins / self.total * 100) if self.total > 0 else 50.0


# Sector groupings for correlation guard
SECTOR_MAP = {
    # Semiconductors
    "NVDA": "semis", "AMD": "semis", "SMCI": "semis", "MU": "semis",
    "ARM": "semis", "SOXL": "semis",
    # Big Tech
    "AAPL": "big_tech", "MSFT": "big_tech", "GOOG": "big_tech", "META": "big_tech", "AMZN": "big_tech",
    # Crypto-linked
    "COIN": "crypto", "MARA": "crypto", "RIOT": "crypto", "MSTR": "crypto",
    # EV / Auto
    "TSLA": "ev",
    # Fintech
    "SOFI": "fintech", "HOOD": "fintech", "AFRM": "fintech",
    # Cybersecurity
    "CRWD": "cyber", "PANW": "cyber",
    # Cloud / SaaS
    "SNOW": "cloud", "SHOP": "cloud", "RBLX": "cloud",
    # Entertainment / Consumer
    "NFLX": "entertainment", "DKNG": "entertainment", "ROKU": "entertainment", "SNAP": "entertainment",
    # Industrial / Transport
    "BA": "industrial", "UBER": "transport",
    # ETFs
    "SPY": "etf_broad", "QQQ": "etf_tech", "IWM": "etf_small", "TQQQ": "etf_leveraged",
    # Other
    "PLTR": "data_ai",
}


class SessionManager:
    """Controls when, what, and how much to trade within a session.

    Implements: daily P&L target/stop, time-of-day filters, correlation
    guard, adaptive symbol tracking, and premarket gap filtering.
    """

    def __init__(self, broker: Broker, config: dict):
        self.broker = broker

        # Daily P&L controls
        self.daily_target_pct = config.get("daily_target_pct", 1.0)
        self.daily_stop_pct = config.get("daily_stop_pct", 1.5)

        # Time-of-day windows (ET)
        self.trading_windows = config.get("trading_windows", [
            {"start": "09:35", "end": "11:30"},   # Morning momentum
            {"start": "14:00", "end": "15:45"},    # Afternoon push
        ])

        # Correlation guard
        self.max_per_sector = config.get("max_per_sector", 2)

        # Adaptive symbol tracking
        self.max_consecutive_losses = config.get("max_consecutive_losses", 3)
        self.min_win_rate_to_continue = config.get("min_win_rate_to_continue", 30.0)
        self.min_trades_for_cutoff = config.get("min_trades_for_cutoff", 5)

        # Premarket gap filter
        self.max_gap_pct = config.get("max_gap_pct", 4.0)

        # Multi-timeframe confirmation
        self.mtf_enabled = config.get("mtf_enabled", True)
        self.mtf_timeframe = config.get("mtf_timeframe", "15Min")
        self.mtf_ema_period = config.get("mtf_ema_period", 21)

        # Session state
        self.session_start_equity: float = 0.0
        self.realized_pnl: float = 0.0
        self.symbol_trackers: dict[str, SymbolTracker] = {}
        self.sector_positions: dict[str, list[str]] = {}
        self.daily_target_hit = False
        self.daily_stop_hit = False
        self.prev_closes: dict[str, float] = {}

    def initialize(self, session_equity: float):
        self.session_start_equity = session_equity
        self.realized_pnl = 0.0
        self.symbol_trackers = {}
        self.sector_positions = {}
        self.daily_target_hit = False
        self.daily_stop_hit = False
        self.prev_closes = {}
        log.info(
            f"Session manager initialized: "
            f"target=+{self.daily_target_pct}%, stop=-{self.daily_stop_pct}%"
        )

    # ── Daily P&L Target / Stop ──────────────────────────────────

    def check_daily_pnl(self) -> str | None:
        """Returns reason string if trading should stop, None if OK."""
        if self.session_start_equity <= 0:
            return None

        account = self.broker.get_account()
        current_equity = account["equity"]
        pnl_pct = ((current_equity - self.session_start_equity) / self.session_start_equity) * 100

        if pnl_pct >= self.daily_target_pct:
            if not self.daily_target_hit:
                self.daily_target_hit = True
                log.info(
                    f"[success]DAILY TARGET HIT: +{pnl_pct:.2f}% "
                    f"(target: +{self.daily_target_pct}%) — stopping new entries[/success]"
                )
            return f"DAILY_TARGET (+{pnl_pct:.2f}%)"

        if pnl_pct <= -self.daily_stop_pct:
            if not self.daily_stop_hit:
                self.daily_stop_hit = True
                log.warning(
                    f"[error]DAILY STOP HIT: {pnl_pct:.2f}% "
                    f"(limit: -{self.daily_stop_pct}%) — halting all trading[/error]"
                )
            return f"DAILY_STOP ({pnl_pct:.2f}%)"

        return None

    @property
    def should_stop_trading(self) -> bool:
        return self.daily_target_hit or self.daily_stop_hit

    # ── Time-of-Day Filter ───────────────────────────────────────

    def is_trading_window(self) -> bool:
        """Check if current time falls within an allowed trading window."""
        now = datetime.now(ET).time()

        for window in self.trading_windows:
            start = time.fromisoformat(window["start"])
            end = time.fromisoformat(window["end"])
            if start <= now <= end:
                return True

        return False

    def get_current_window_status(self) -> dict:
        """Returns info about current time vs trading windows."""
        now = datetime.now(ET)
        now_time = now.time()
        in_window = False
        next_window = None

        for window in self.trading_windows:
            start = time.fromisoformat(window["start"])
            end = time.fromisoformat(window["end"])
            if start <= now_time <= end:
                in_window = True
                break
            elif now_time < start and (next_window is None or start < time.fromisoformat(next_window["start"])):
                next_window = window

        return {
            "current_time_et": now.strftime("%H:%M:%S ET"),
            "in_trading_window": in_window,
            "next_window": next_window,
            "windows": self.trading_windows,
        }

    # ── Correlation Guard ────────────────────────────────────────

    def update_sector_positions(self, open_symbols: list[str]):
        """Rebuild sector position map from currently open positions."""
        self.sector_positions = {}
        for sym in open_symbols:
            sector = SECTOR_MAP.get(sym, "other")
            if sector not in self.sector_positions:
                self.sector_positions[sector] = []
            self.sector_positions[sector].append(sym)

    def can_open_in_sector(self, symbol: str) -> bool:
        """Check if opening a position in this symbol's sector would exceed limits."""
        sector = SECTOR_MAP.get(symbol, "other")
        current = self.sector_positions.get(sector, [])
        if len(current) >= self.max_per_sector:
            log.info(
                f"  Correlation guard: {symbol} blocked — "
                f"sector '{sector}' already has {len(current)} positions: {current}"
            )
            return False
        return True

    # ── Adaptive Symbol Tracking ─────────────────────────────────

    def record_trade_result(self, symbol: str, pnl: float):
        """Track per-symbol win/loss for adaptive filtering."""
        if symbol not in self.symbol_trackers:
            self.symbol_trackers[symbol] = SymbolTracker()

        tracker = self.symbol_trackers[symbol]
        if pnl > 0:
            tracker.wins += 1
            tracker.consecutive_losses = 0
        else:
            tracker.losses += 1
            tracker.consecutive_losses += 1

        # Check if symbol should be blocked
        if tracker.consecutive_losses >= self.max_consecutive_losses:
            tracker.blocked = True
            log.warning(
                f"  {symbol} BLOCKED: {tracker.consecutive_losses} consecutive losses"
            )
        elif (tracker.total >= self.min_trades_for_cutoff and
              tracker.win_rate < self.min_win_rate_to_continue):
            tracker.blocked = True
            log.warning(
                f"  {symbol} BLOCKED: win rate {tracker.win_rate:.0f}% "
                f"< {self.min_win_rate_to_continue}% after {tracker.total} trades"
            )

        self.realized_pnl += pnl

    def is_symbol_allowed(self, symbol: str) -> bool:
        tracker = self.symbol_trackers.get(symbol)
        if tracker and tracker.blocked:
            return False
        return True

    def get_symbol_stats(self) -> list[dict]:
        return [
            {
                "symbol": sym,
                "wins": t.wins,
                "losses": t.losses,
                "win_rate": round(t.win_rate, 1),
                "consecutive_losses": t.consecutive_losses,
                "blocked": t.blocked,
            }
            for sym, t in sorted(self.symbol_trackers.items(), key=lambda x: x[1].win_rate, reverse=True)
        ]

    # ── Premarket Gap Filter ─────────────────────────────────────

    def set_previous_close(self, symbol: str, prev_close: float):
        self.prev_closes[symbol] = prev_close

    def check_gap(self, symbol: str, current_price: float) -> bool:
        """Returns True if the stock has NOT gapped excessively (safe to trade)."""
        prev_close = self.prev_closes.get(symbol)
        if prev_close is None or prev_close <= 0:
            return True  # No data — allow

        gap_pct = abs((current_price - prev_close) / prev_close) * 100
        if gap_pct > self.max_gap_pct:
            log.info(
                f"  Gap filter: {symbol} blocked — "
                f"{gap_pct:.1f}% gap (limit: {self.max_gap_pct}%)"
            )
            return False
        return True

    # ── Multi-Timeframe Confirmation ─────────────────────────────

    def check_higher_tf_trend(self, symbol: str) -> bool:
        """Confirm the higher timeframe trend is bullish before entering long."""
        if not self.mtf_enabled:
            return True

        try:
            from trading_bot.utils.indicators import ema

            df = self.broker.get_bars(
                symbol,
                timeframe=self.mtf_timeframe,
                lookback_days=5,
                limit=50,
            )
            if df.empty or len(df) < self.mtf_ema_period + 2:
                return True  # Not enough data — don't block

            ema_series = ema(df, self.mtf_ema_period)
            if ema_series.iloc[-1] is None:
                return True

            current_price = df["close"].iloc[-1]
            above_ema = current_price > ema_series.iloc[-1]

            if not above_ema:
                log.info(
                    f"  MTF filter: {symbol} blocked — "
                    f"price below {self.mtf_timeframe} EMA{self.mtf_ema_period}"
                )
            return above_ema

        except Exception as e:
            log.warning(f"  MTF check failed for {symbol}: {e}")
            return True  # Fail open

    # ── Master Gate ──────────────────────────────────────────────

    def can_enter(self, symbol: str, current_price: float, open_symbols: list[str]) -> tuple[bool, str]:
        """Master check: should we enter this trade?

        Returns (allowed, reason) — reason explains why blocked.
        """
        # Daily P&L check
        daily_reason = self.check_daily_pnl()
        if daily_reason:
            return False, daily_reason

        # Time window
        if not self.is_trading_window():
            return False, "OUTSIDE_TRADING_WINDOW"

        # Symbol blocked by adaptive tracker
        if not self.is_symbol_allowed(symbol):
            return False, f"SYMBOL_BLOCKED ({symbol})"

        # Correlation guard
        self.update_sector_positions(open_symbols)
        if not self.can_open_in_sector(symbol):
            sector = SECTOR_MAP.get(symbol, "other")
            return False, f"SECTOR_LIMIT ({sector})"

        # Gap filter
        if not self.check_gap(symbol, current_price):
            return False, "EXCESSIVE_GAP"

        # Multi-timeframe trend
        if not self.check_higher_tf_trend(symbol):
            return False, "MTF_TREND_BEARISH"

        return True, "OK"

    def get_session_summary(self) -> dict:
        return {
            "session_start_equity": self.session_start_equity,
            "realized_pnl": round(self.realized_pnl, 2),
            "daily_target_hit": self.daily_target_hit,
            "daily_stop_hit": self.daily_stop_hit,
            "daily_target_pct": self.daily_target_pct,
            "daily_stop_pct": self.daily_stop_pct,
            "trading_window": self.get_current_window_status(),
            "symbol_stats": self.get_symbol_stats(),
            "sector_positions": dict(self.sector_positions),
        }
