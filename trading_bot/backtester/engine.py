from dataclasses import dataclass, field
from datetime import datetime

import pandas as pd

from trading_bot.rules.base_rule import BaseRule
from trading_bot.utils.indicators import atr
from trading_bot.utils.logger import log


@dataclass
class BacktestTrade:
    symbol: str
    rule_name: str
    entry_time: datetime
    entry_price: float
    exit_time: datetime | None = None
    exit_price: float | None = None
    exit_reason: str = ""
    qty: int = 0
    pnl: float = 0.0
    pnl_pct: float = 0.0
    high_water_mark: float = 0.0

    @property
    def is_open(self) -> bool:
        return self.exit_time is None

    def to_dict(self) -> dict:
        return {
            "symbol": self.symbol,
            "rule_name": self.rule_name,
            "entry_time": self.entry_time.isoformat() if self.entry_time else None,
            "entry_price": self.entry_price,
            "exit_time": self.exit_time.isoformat() if self.exit_time else None,
            "exit_price": self.exit_price,
            "exit_reason": self.exit_reason,
            "qty": self.qty,
            "pnl": round(self.pnl, 2),
            "pnl_pct": round(self.pnl_pct, 4),
        }


@dataclass
class BacktestResult:
    rule_name: str
    symbol: str
    start_date: str
    end_date: str
    initial_equity: float
    final_equity: float
    trades: list[BacktestTrade] = field(default_factory=list)
    equity_curve: list[dict] = field(default_factory=list)

    @property
    def total_trades(self) -> int:
        return len([t for t in self.trades if not t.is_open])

    @property
    def winning_trades(self) -> int:
        return len([t for t in self.trades if not t.is_open and t.pnl > 0])

    @property
    def losing_trades(self) -> int:
        return len([t for t in self.trades if not t.is_open and t.pnl < 0])

    @property
    def win_rate(self) -> float:
        if self.total_trades == 0:
            return 0.0
        return (self.winning_trades / self.total_trades) * 100

    @property
    def total_pnl(self) -> float:
        return sum(t.pnl for t in self.trades if not t.is_open)

    @property
    def total_return_pct(self) -> float:
        if self.initial_equity == 0:
            return 0.0
        return ((self.final_equity - self.initial_equity) / self.initial_equity) * 100

    @property
    def avg_win(self) -> float:
        wins = [t.pnl for t in self.trades if not t.is_open and t.pnl > 0]
        return sum(wins) / len(wins) if wins else 0.0

    @property
    def avg_loss(self) -> float:
        losses = [t.pnl for t in self.trades if not t.is_open and t.pnl < 0]
        return sum(losses) / len(losses) if losses else 0.0

    @property
    def profit_factor(self) -> float:
        gross_profit = sum(t.pnl for t in self.trades if not t.is_open and t.pnl > 0)
        gross_loss = abs(sum(t.pnl for t in self.trades if not t.is_open and t.pnl < 0))
        if gross_loss == 0:
            return float("inf") if gross_profit > 0 else 0.0
        return gross_profit / gross_loss

    @property
    def max_drawdown_pct(self) -> float:
        if not self.equity_curve:
            return 0.0
        peak = self.initial_equity
        max_dd = 0.0
        for point in self.equity_curve:
            eq = point["equity"]
            if eq > peak:
                peak = eq
            dd = ((peak - eq) / peak) * 100
            if dd > max_dd:
                max_dd = dd
        return max_dd

    @property
    def sharpe_ratio(self) -> float:
        if len(self.equity_curve) < 2:
            return 0.0
        returns = []
        for i in range(1, len(self.equity_curve)):
            prev = self.equity_curve[i - 1]["equity"]
            curr = self.equity_curve[i]["equity"]
            returns.append((curr - prev) / prev)
        if not returns:
            return 0.0
        import numpy as np
        arr = np.array(returns)
        mean = arr.mean()
        std = arr.std()
        if std == 0:
            return 0.0
        # Annualize assuming daily returns, ~252 trading days
        return (mean / std) * (252 ** 0.5)

    def to_dict(self) -> dict:
        return {
            "rule_name": self.rule_name,
            "symbol": self.symbol,
            "start_date": self.start_date,
            "end_date": self.end_date,
            "initial_equity": self.initial_equity,
            "final_equity": round(self.final_equity, 2),
            "total_return_pct": round(self.total_return_pct, 2),
            "total_trades": self.total_trades,
            "winning_trades": self.winning_trades,
            "losing_trades": self.losing_trades,
            "win_rate": round(self.win_rate, 2),
            "total_pnl": round(self.total_pnl, 2),
            "avg_win": round(self.avg_win, 2),
            "avg_loss": round(self.avg_loss, 2),
            "profit_factor": round(self.profit_factor, 2),
            "max_drawdown_pct": round(self.max_drawdown_pct, 2),
            "sharpe_ratio": round(self.sharpe_ratio, 2),
            "trades": [t.to_dict() for t in self.trades if not t.is_open],
            "equity_curve": self.equity_curve,
        }


class Backtester:
    def __init__(self, broker, initial_equity: float = 100_000.0):
        self.broker = broker
        self.initial_equity = initial_equity

    def run(
        self,
        rule: BaseRule,
        symbol: str,
        lookback_days: int = 90,
        bar_timeframe: str = "1Min",
    ) -> BacktestResult:
        log.info(f"Backtesting '{rule.name}' on {symbol} ({lookback_days} days, {bar_timeframe} bars)")

        # Fetch historical bars
        df = self.broker.get_bars(
            symbol,
            timeframe=bar_timeframe,
            lookback_days=lookback_days,
            limit=50_000,
        )

        if df.empty:
            log.warning(f"No data for {symbol}")
            return BacktestResult(
                rule_name=rule.name,
                symbol=symbol,
                start_date="",
                end_date="",
                initial_equity=self.initial_equity,
                final_equity=self.initial_equity,
            )

        start_date = str(df.index[0].date()) if hasattr(df.index[0], "date") else str(df.index[0])
        end_date = str(df.index[-1].date()) if hasattr(df.index[-1], "date") else str(df.index[-1])

        result = BacktestResult(
            rule_name=rule.name,
            symbol=symbol,
            start_date=start_date,
            end_date=end_date,
            initial_equity=self.initial_equity,
            final_equity=self.initial_equity,
        )

        equity = self.initial_equity
        open_trade: BacktestTrade | None = None
        min_bars = 50  # Need enough bars for indicators

        for i in range(min_bars, len(df)):
            window = df.iloc[:i + 1]
            current_bar = df.iloc[i]
            current_time = df.index[i]
            current_price = current_bar["close"]

            # Check exit first
            if open_trade is not None:
                pnl_pct = ((current_price - open_trade.entry_price) / open_trade.entry_price) * 100

                if current_price > open_trade.high_water_mark:
                    open_trade.high_water_mark = current_price

                exit_reason = self._check_exit(rule, open_trade, current_price, pnl_pct, current_time)

                if exit_reason:
                    open_trade.exit_time = current_time
                    open_trade.exit_price = current_price
                    open_trade.exit_reason = exit_reason
                    open_trade.pnl = (current_price - open_trade.entry_price) * open_trade.qty
                    open_trade.pnl_pct = pnl_pct
                    equity += open_trade.pnl
                    result.trades.append(open_trade)
                    open_trade = None

            # Check entry
            elif rule.check_entry(symbol, window):
                qty = int((equity * (rule.equity_pct / 100)) / current_price)
                if qty > 0:
                    open_trade = BacktestTrade(
                        symbol=symbol,
                        rule_name=rule.name,
                        entry_time=current_time,
                        entry_price=current_price,
                        qty=qty,
                        high_water_mark=current_price,
                    )

            # Record equity curve (sample every N bars to keep data manageable)
            sample_rate = max(1, len(df) // 500)
            if i % sample_rate == 0:
                result.equity_curve.append({
                    "time": str(current_time),
                    "equity": round(equity, 2),
                })

        # Close any remaining open trade at last price
        if open_trade is not None:
            last_price = df["close"].iloc[-1]
            open_trade.exit_time = df.index[-1]
            open_trade.exit_price = last_price
            open_trade.exit_reason = "END_OF_DATA"
            open_trade.pnl = (last_price - open_trade.entry_price) * open_trade.qty
            open_trade.pnl_pct = ((last_price - open_trade.entry_price) / open_trade.entry_price) * 100
            equity += open_trade.pnl
            result.trades.append(open_trade)

        result.final_equity = equity

        # Final equity point
        result.equity_curve.append({
            "time": str(df.index[-1]),
            "equity": round(equity, 2),
        })

        log.info(
            f"Backtest complete: {result.total_trades} trades, "
            f"Win rate: {result.win_rate:.1f}%, "
            f"P&L: ${result.total_pnl:,.2f} ({result.total_return_pct:+.2f}%), "
            f"Sharpe: {result.sharpe_ratio:.2f}"
        )

        return result

    def _check_exit(
        self,
        rule: BaseRule,
        trade: BacktestTrade,
        current_price: float,
        pnl_pct: float,
        current_time,
    ) -> str | None:
        # Take profit
        if pnl_pct >= rule.take_profit_pct:
            return f"TAKE_PROFIT ({pnl_pct:+.2f}%)"

        # Stop loss
        if pnl_pct <= -rule.stop_loss_pct:
            return f"STOP_LOSS ({pnl_pct:+.2f}%)"

        # Trailing stop
        if rule.trailing_stop_pct is not None:
            drop = ((trade.high_water_mark - current_price) / trade.high_water_mark) * 100
            if drop >= rule.trailing_stop_pct and pnl_pct > 0:
                return f"TRAILING_STOP ({drop:.2f}% from high)"

        # Max hold time
        if rule.max_hold_minutes is not None:
            elapsed = (current_time - trade.entry_time).total_seconds() / 60
            if elapsed >= rule.max_hold_minutes:
                return f"MAX_HOLD ({elapsed:.0f}min)"

        return None
