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


def vwap(df: pd.DataFrame) -> pd.Series:
    """Cumulative VWAP — resets each day for intraday data."""
    typical_price = (df["high"] + df["low"] + df["close"]) / 3
    cum_tp_vol = (typical_price * df["volume"]).cumsum()
    cum_vol = df["volume"].cumsum()
    return cum_tp_vol / cum_vol


def bollinger_bands(df: pd.DataFrame, period: int = 20, std_dev: float = 2.0, column: str = "close"):
    """Returns (upper, middle, lower) bands."""
    bb = ta.bbands(df[column], length=period, std=std_dev)
    if bb is None:
        return None, None, None
    cols = bb.columns
    upper = bb[cols[0]]   # BBU
    middle = bb[cols[1]]  # BBM
    lower = bb[cols[2]]   # BBL
    return upper, middle, lower


def stochastic(df: pd.DataFrame, k_period: int = 14, d_period: int = 3):
    """Returns (k, d) stochastic oscillator."""
    stoch = ta.stoch(df["high"], df["low"], df["close"], k=k_period, d=d_period)
    if stoch is None:
        return None, None
    cols = stoch.columns
    return stoch[cols[0]], stoch[cols[1]]


def adx(df: pd.DataFrame, period: int = 14) -> pd.Series:
    return ta.adx(df["high"], df["low"], df["close"], length=period).iloc[:, 0]
