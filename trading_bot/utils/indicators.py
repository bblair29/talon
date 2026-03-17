import pandas as pd
import pandas_ta as ta


def ema(df: pd.DataFrame, period: int, column: str = "close") -> pd.Series:
    return ta.ema(df[column], length=period)


def rsi(df: pd.DataFrame, period: int = 14, column: str = "close") -> pd.Series:
    return ta.rsi(df[column], length=period)


def atr(df: pd.DataFrame, period: int = 14) -> pd.Series:
    return ta.atr(df["high"], df["low"], df["close"], length=period)


def macd(
    df: pd.DataFrame, fast: int = 12, slow: int = 26, signal: int = 9, column: str = "close"
) -> pd.DataFrame:
    return ta.macd(df[column], fast=fast, slow=slow, signal=signal)


def sma(df: pd.DataFrame, period: int, column: str = "close") -> pd.Series:
    return ta.sma(df[column], length=period)


def volume_avg(df: pd.DataFrame, period: int = 20) -> pd.Series:
    return ta.sma(df["volume"], length=period)
