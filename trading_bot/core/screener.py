import pandas as pd

from trading_bot.core.broker import Broker
from trading_bot.utils.indicators import atr
from trading_bot.utils.logger import log


class Screener:
    def __init__(self, broker: Broker, config: dict):
        self.broker = broker
        self.min_price = config.get("min_price", 10.0)
        self.max_price = config.get("max_price", 500.0)
        self.min_avg_volume = config.get("min_avg_volume", 1_000_000)
        self.min_atr_pct = config.get("min_atr_pct", 1.5)
        self.lookback_days = config.get("lookback_days", 20)
        self.universe = config.get("universe", [])

    def scan(self) -> list[str]:
        if not self.universe:
            log.warning("No stock universe configured — screener has nothing to scan")
            return []

        log.info(f"Screening {len(self.universe)} symbols...")
        passed = []

        for symbol in self.universe:
            try:
                df = self.broker.get_bars(
                    symbol, timeframe="1Day", lookback_days=self.lookback_days + 15, limit=self.lookback_days + 10
                )
                if df.empty or len(df) < 15:
                    continue

                last_close = df["close"].iloc[-1]
                avg_volume = df["volume"].mean()

                if last_close < self.min_price or last_close > self.max_price:
                    continue
                if avg_volume < self.min_avg_volume:
                    continue

                atr_series = atr(df, period=14)
                if atr_series is None or atr_series.dropna().empty:
                    continue
                atr_val = atr_series.iloc[-1]
                atr_pct = (atr_val / last_close) * 100

                if atr_pct < self.min_atr_pct:
                    continue

                passed.append(symbol)
                log.info(
                    f"  [success]PASS[/success] {symbol}: "
                    f"${last_close:.2f}, vol={avg_volume:,.0f}, ATR%={atr_pct:.2f}%"
                )

            except Exception as e:
                log.warning(f"  Screener skip {symbol}: {e}")

        log.info(f"Screener complete: {len(passed)}/{len(self.universe)} symbols passed")
        return passed
