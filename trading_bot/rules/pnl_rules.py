import pandas as pd

from trading_bot.rules.base_rule import BaseRule
from trading_bot.utils.indicators import ema, rsi, volume_avg
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
