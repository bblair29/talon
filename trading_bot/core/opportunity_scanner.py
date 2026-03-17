from dataclasses import dataclass

import numpy as np
import pandas as pd

from trading_bot.core.broker import Broker
from trading_bot.utils.logger import log


@dataclass
class OpportunityScore:
    symbol: str
    price: float
    avg_daily_range_pct: float     # avg (high-low)/close
    range_consistency: float        # 1 - normalized std dev (higher = more predictable)
    capture_rate_1pct: float        # % of days you could have captured 1%+
    capture_rate_half_pct: float    # % of days you could have captured 0.5%+
    avg_volume: float
    volume_score: float             # normalized 0-100
    gap_down_rate: float            # % of days with >3% overnight gap down
    avg_intraday_high_from_open: float  # avg % gain from open to daily high
    avg_intraday_low_from_open: float   # avg % drop from open to daily low
    win_streak_avg: float           # avg consecutive days with 1%+ available
    composite_score: float          # final weighted score 0-100

    def to_dict(self) -> dict:
        return {
            "symbol": self.symbol,
            "price": round(self.price, 2),
            "avg_daily_range_pct": round(self.avg_daily_range_pct, 2),
            "range_consistency": round(self.range_consistency, 1),
            "capture_rate_1pct": round(self.capture_rate_1pct, 1),
            "capture_rate_half_pct": round(self.capture_rate_half_pct, 1),
            "avg_volume": int(self.avg_volume),
            "volume_score": round(self.volume_score, 1),
            "gap_down_rate": round(self.gap_down_rate, 1),
            "avg_intraday_high_from_open": round(self.avg_intraday_high_from_open, 2),
            "avg_intraday_low_from_open": round(self.avg_intraday_low_from_open, 2),
            "win_streak_avg": round(self.win_streak_avg, 1),
            "composite_score": round(self.composite_score, 1),
        }


class OpportunityScanner:
    """Scans for reliable, volatile stocks where 1%/day captures are realistic."""

    def __init__(self, broker: Broker, lookback_days: int = 60):
        self.broker = broker
        self.lookback_days = lookback_days

    def scan(self, symbols: list[str]) -> list[OpportunityScore]:
        log.info(f"Opportunity scan: {len(symbols)} symbols, {self.lookback_days}-day lookback")
        results = []

        for symbol in symbols:
            try:
                score = self._analyze_symbol(symbol)
                if score is not None:
                    results.append(score)
            except Exception as e:
                log.warning(f"  Opportunity skip {symbol}: {e}")

        # Sort by composite score descending
        results.sort(key=lambda x: x.composite_score, reverse=True)
        log.info(f"Opportunity scan complete: {len(results)} symbols scored")
        return results

    def _analyze_symbol(self, symbol: str) -> OpportunityScore | None:
        df = self.broker.get_bars(
            symbol,
            timeframe="1Day",
            lookback_days=self.lookback_days + 10,
            limit=self.lookback_days + 5,
        )

        if df.empty or len(df) < 20:
            return None

        price = df["close"].iloc[-1]
        opens = df["open"].values
        highs = df["high"].values
        lows = df["low"].values
        closes = df["close"].values
        volumes = df["volume"].values

        # --- Daily range % ---
        daily_range_pct = ((highs - lows) / closes) * 100
        avg_range = float(np.mean(daily_range_pct))
        std_range = float(np.std(daily_range_pct))

        # Range consistency: lower std relative to mean = more predictable
        # Score from 0-100, higher is better
        cv = std_range / avg_range if avg_range > 0 else 1.0
        range_consistency = max(0, min(100, (1 - cv) * 100))

        # --- Capture rates ---
        # For each day: could you have entered at open and exited at 1%+ gain?
        intraday_high_from_open = ((highs - opens) / opens) * 100
        intraday_low_from_open = ((opens - lows) / opens) * 100

        capture_1pct = float(np.mean(intraday_high_from_open >= 1.0) * 100)
        capture_half = float(np.mean(intraday_high_from_open >= 0.5) * 100)

        avg_high_from_open = float(np.mean(intraday_high_from_open))
        avg_low_from_open = float(np.mean(intraday_low_from_open))

        # --- Gap risk ---
        # Overnight gap: (today's open - yesterday's close) / yesterday's close
        if len(closes) > 1:
            gaps = ((opens[1:] - closes[:-1]) / closes[:-1]) * 100
            gap_down_rate = float(np.mean(gaps < -3.0) * 100)
        else:
            gap_down_rate = 0.0

        # --- Volume score ---
        avg_vol = float(np.mean(volumes))
        # Normalize: 10M+ volume → score 80-100, 1M → ~50, <500k → low
        vol_score = min(100, max(0, np.log10(max(avg_vol, 1)) * 15 - 50))

        # --- Win streak avg ---
        # How many consecutive days had 1%+ intraday opportunity?
        streaks = []
        current_streak = 0
        for h in intraday_high_from_open:
            if h >= 1.0:
                current_streak += 1
            else:
                if current_streak > 0:
                    streaks.append(current_streak)
                current_streak = 0
        if current_streak > 0:
            streaks.append(current_streak)
        win_streak_avg = float(np.mean(streaks)) if streaks else 0.0

        # --- Composite Score ---
        # Weights tuned for "reliable daily 1% capture" goal
        composite = (
            capture_1pct * 0.30 +          # Most important: how often can you get 1%?
            range_consistency * 0.20 +      # Predictability
            min(avg_range * 10, 100) * 0.15 +  # Raw opportunity (capped)
            vol_score * 0.10 +              # Liquidity
            (100 - gap_down_rate * 10) * 0.15 +  # Safety (penalize gap downs)
            min(win_streak_avg * 20, 100) * 0.10  # Consistency of streaks
        )

        composite = max(0, min(100, composite))

        log.info(
            f"  {symbol}: score={composite:.0f}, "
            f"range={avg_range:.1f}%, capture@1%={capture_1pct:.0f}%, "
            f"consistency={range_consistency:.0f}, gap_risk={gap_down_rate:.0f}%"
        )

        return OpportunityScore(
            symbol=symbol,
            price=price,
            avg_daily_range_pct=avg_range,
            range_consistency=range_consistency,
            capture_rate_1pct=capture_1pct,
            capture_rate_half_pct=capture_half,
            avg_volume=avg_vol,
            volume_score=vol_score,
            gap_down_rate=gap_down_rate,
            avg_intraday_high_from_open=avg_high_from_open,
            avg_intraday_low_from_open=avg_low_from_open,
            win_streak_avg=win_streak_avg,
            composite_score=composite,
        )
