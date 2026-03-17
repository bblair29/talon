"""Intraday momentum scorer — re-ranks stocks in real-time during the session.

Unlike the startup screener, this runs periodically and scores based on
what's happening RIGHT NOW: volume surges, price acceleration, VWAP position.
"""

import pandas as pd
import numpy as np

from trading_bot.core.broker import Broker
from trading_bot.utils.indicators import ema, rsi, vwap, volume_avg, atr
from trading_bot.utils.logger import log


class MomentumScore:
    def __init__(self, symbol: str, score: float, details: dict):
        self.symbol = symbol
        self.score = score
        self.details = details

    def to_dict(self) -> dict:
        return {"symbol": self.symbol, "score": round(self.score, 1), **self.details}


class MomentumScorer:
    """Scores stocks based on current intraday momentum.

    Re-run every 15-30 min to rotate into the day's best movers.
    """

    def __init__(self, broker: Broker):
        self.broker = broker

    def score_symbols(self, symbols: list[str], timeframe: str = "1Min") -> list[MomentumScore]:
        results = []

        for symbol in symbols:
            try:
                score = self._score_symbol(symbol, timeframe)
                if score is not None:
                    results.append(score)
            except Exception as e:
                log.warning(f"Momentum skip {symbol}: {e}")

        results.sort(key=lambda x: x.score, reverse=True)
        return results

    def _score_symbol(self, symbol: str, timeframe: str) -> MomentumScore | None:
        df = self.broker.get_bars(symbol, timeframe=timeframe, lookback_days=2, limit=100)
        if df.empty or len(df) < 30:
            return None

        close = df["close"].iloc[-1]
        prev_close = df["close"].iloc[-20] if len(df) > 20 else df["close"].iloc[0]

        # Price momentum (% change over last 20 bars)
        price_momentum = ((close - prev_close) / prev_close) * 100

        # Volume surge: current vs average
        avg_vol = volume_avg(df, 20)
        current_vol = df["volume"].iloc[-1]
        avg_vol_val = avg_vol.iloc[-1] if avg_vol.iloc[-1] is not None and avg_vol.iloc[-1] > 0 else 1
        vol_ratio = current_vol / avg_vol_val

        # VWAP position
        vwap_series = vwap(df)
        vwap_val = vwap_series.iloc[-1] if vwap_series.iloc[-1] is not None else close
        vwap_dist_pct = ((close - vwap_val) / vwap_val) * 100

        # RSI — not too overbought (still room to run)
        rsi_series = rsi(df, 14)
        rsi_val = rsi_series.iloc[-1] if rsi_series.iloc[-1] is not None else 50

        # Price acceleration: is momentum increasing?
        if len(df) >= 10:
            recent_move = ((df["close"].iloc[-1] - df["close"].iloc[-5]) / df["close"].iloc[-5]) * 100
            earlier_move = ((df["close"].iloc[-5] - df["close"].iloc[-10]) / df["close"].iloc[-10]) * 100
            acceleration = recent_move - earlier_move
        else:
            acceleration = 0

        # Range expansion: current bar range vs ATR
        atr_series = atr(df, 14)
        atr_val = atr_series.iloc[-1] if atr_series is not None and not pd.isna(atr_series.iloc[-1]) else 1
        current_range = df["high"].iloc[-1] - df["low"].iloc[-1]
        range_expansion = (current_range / atr_val) if atr_val > 0 else 1

        # Composite score
        score = 0.0

        # Volume surge (0-30 pts)
        score += min(30, vol_ratio * 10)

        # Price momentum direction bonus (0-25 pts)
        if price_momentum > 0:
            score += min(25, abs(price_momentum) * 8)

        # Acceleration (0-15 pts)
        if acceleration > 0:
            score += min(15, acceleration * 5)

        # RSI sweet spot: 40-70 is ideal for continuation (0-15 pts)
        if 40 <= rsi_val <= 70:
            score += 15
        elif 30 <= rsi_val < 40 or 70 < rsi_val <= 80:
            score += 8

        # Range expansion (0-15 pts)
        score += min(15, range_expansion * 8)

        details = {
            "price": round(close, 2),
            "price_momentum_pct": round(price_momentum, 2),
            "volume_ratio": round(vol_ratio, 2),
            "vwap_dist_pct": round(vwap_dist_pct, 2),
            "rsi": round(rsi_val, 1),
            "acceleration": round(acceleration, 2),
            "range_expansion": round(range_expansion, 2),
        }

        return MomentumScore(symbol, score, details)

    def get_hot_symbols(self, symbols: list[str], top_n: int = 10, timeframe: str = "1Min") -> list[str]:
        """Get the top N symbols by current momentum score."""
        scored = self.score_symbols(symbols, timeframe)
        hot = [s.symbol for s in scored[:top_n]]

        if hot:
            log.info(
                f"Hot symbols: {', '.join(f'{s.symbol}({s.score:.0f})' for s in scored[:top_n])}"
            )
        return hot
