import pandas as pd

from trading_bot.rules.base_rule import BaseRule
from trading_bot.utils.indicators import (
    ema, rsi, volume_avg, vwap, bollinger_bands, stochastic, adx,
)
from trading_bot.utils.logger import log


class MomentumPnLRule(BaseRule):
    """EMA crossover with volume confirmation."""

    def check_entry(self, symbol: str, df: pd.DataFrame) -> bool:
        if len(df) < self.entry_config.get("slow_ema", 21) + 2:
            return False

        fast_period = self.entry_config.get("fast_ema", 9)
        slow_period = self.entry_config.get("slow_ema", 21)
        vol_period = self.entry_config.get("volume_avg_period", 20)
        vol_mult = self.entry_config.get("volume_multiplier", 1.0)

        fast_ema = ema(df, fast_period)
        slow_ema = ema(df, slow_period)
        avg_vol = volume_avg(df, vol_period)

        if fast_ema.iloc[-2] is None or slow_ema.iloc[-2] is None:
            return False

        # EMA crossover: fast was below slow, now above
        crossed_up = (fast_ema.iloc[-2] <= slow_ema.iloc[-2]) and (fast_ema.iloc[-1] > slow_ema.iloc[-1])

        # Volume confirmation
        current_volume = df["volume"].iloc[-1]
        avg_volume_val = avg_vol.iloc[-1] if avg_vol.iloc[-1] is not None else 0
        volume_ok = current_volume > (avg_volume_val * vol_mult)

        if crossed_up and volume_ok:
            log.info(
                f"[trade]{self.name} SIGNAL: {symbol} — "
                f"EMA {fast_period}/{slow_period} crossover + volume confirmed[/trade]"
            )
            return True
        return False


class RSIPnLRule(BaseRule):
    """RSI oversold bounce with EMA trend filter."""

    def check_entry(self, symbol: str, df: pd.DataFrame) -> bool:
        ema_period = self.entry_config.get("ema_period", 50)
        if len(df) < ema_period + 2:
            return False

        rsi_period = self.entry_config.get("rsi_period", 14)
        rsi_threshold = self.entry_config.get("rsi_threshold", 32)

        rsi_series = rsi(df, rsi_period)
        ema_series = ema(df, ema_period)

        if rsi_series.iloc[-1] is None or ema_series.iloc[-1] is None:
            return False

        rsi_oversold = rsi_series.iloc[-1] < rsi_threshold
        above_ema = df["close"].iloc[-1] > ema_series.iloc[-1]

        if rsi_oversold and above_ema:
            log.info(
                f"[trade]{self.name} SIGNAL: {symbol} — "
                f"RSI={rsi_series.iloc[-1]:.1f} < {rsi_threshold}, "
                f"price above EMA{ema_period}[/trade]"
            )
            return True
        return False


class VWAPMeanReversionRule(BaseRule):
    """Buy when price dips below VWAP by a threshold, sell on reversion.

    Ideal for liquid, range-bound stocks that reliably revert to VWAP.
    Targets small, frequent wins (0.5%-1% per trade).
    """

    def check_entry(self, symbol: str, df: pd.DataFrame) -> bool:
        if len(df) < 30:
            return False

        dip_pct = self.entry_config.get("vwap_dip_pct", 0.3)
        rsi_max = self.entry_config.get("rsi_max", 40)
        vol_mult = self.entry_config.get("volume_multiplier", 1.2)

        vwap_series = vwap(df)
        rsi_series = rsi(df, self.entry_config.get("rsi_period", 14))
        avg_vol = volume_avg(df, 20)

        if vwap_series.iloc[-1] is None or rsi_series.iloc[-1] is None:
            return False

        current_price = df["close"].iloc[-1]
        current_vwap = vwap_series.iloc[-1]
        pct_below_vwap = ((current_vwap - current_price) / current_vwap) * 100

        # Price must be below VWAP by threshold
        price_dipped = pct_below_vwap >= dip_pct

        # RSI should be low (confirming oversold)
        rsi_ok = rsi_series.iloc[-1] < rsi_max

        # Volume spike — confirms interest
        current_volume = df["volume"].iloc[-1]
        avg_volume_val = avg_vol.iloc[-1] if avg_vol.iloc[-1] is not None else 0
        volume_ok = current_volume > (avg_volume_val * vol_mult)

        if price_dipped and rsi_ok and volume_ok:
            log.info(
                f"[trade]{self.name} SIGNAL: {symbol} — "
                f"{pct_below_vwap:.2f}% below VWAP, RSI={rsi_series.iloc[-1]:.1f}, "
                f"volume confirmed[/trade]"
            )
            return True
        return False


class ScalperRule(BaseRule):
    """Aggressive scalping rule for frequent small gains.

    Combines Bollinger Band squeeze breakout + stochastic confirmation
    + ADX trend strength. Tight stops, quick exits.
    Designed for 0.5%-1% captures on reliable movers.
    """

    def check_entry(self, symbol: str, df: pd.DataFrame) -> bool:
        if len(df) < 30:
            return False

        bb_period = self.entry_config.get("bb_period", 20)
        bb_std = self.entry_config.get("bb_std", 2.0)
        stoch_k = self.entry_config.get("stoch_k", 14)
        stoch_d = self.entry_config.get("stoch_d", 3)
        stoch_oversold = self.entry_config.get("stoch_oversold", 25)
        adx_min = self.entry_config.get("adx_min", 20)

        upper, middle, lower = bollinger_bands(df, bb_period, bb_std)
        k_line, d_line = stochastic(df, stoch_k, stoch_d)
        adx_series = adx(df, 14)

        if any(x is None for x in [upper, middle, lower, k_line, d_line]) or adx_series is None:
            return False

        current_price = df["close"].iloc[-1]
        prev_price = df["close"].iloc[-2]

        # Condition 1: Price near or touching lower Bollinger Band (dip buy)
        near_lower_band = current_price <= lower.iloc[-1] * 1.002

        # Condition 2: Stochastic oversold and turning up (K crosses above D)
        stoch_oversold_cond = k_line.iloc[-1] < stoch_oversold
        stoch_turning = k_line.iloc[-1] > d_line.iloc[-1] and k_line.iloc[-2] <= d_line.iloc[-2]

        # Condition 3: ADX above minimum (there IS a trend, not flat)
        trend_present = adx_series.iloc[-1] > adx_min if not pd.isna(adx_series.iloc[-1]) else False

        # Condition 4: Price starting to bounce (current bar higher than prev)
        bouncing = current_price > prev_price

        if near_lower_band and (stoch_oversold_cond or stoch_turning) and trend_present and bouncing:
            log.info(
                f"[trade]{self.name} SIGNAL: {symbol} — "
                f"BB lower touch, Stoch={k_line.iloc[-1]:.0f}/{d_line.iloc[-1]:.0f}, "
                f"ADX={adx_series.iloc[-1]:.0f}, bouncing[/trade]"
            )
            return True
        return False
