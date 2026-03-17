import os
from datetime import datetime, timedelta

import pandas as pd
from alpaca.data.historical import StockHistoricalDataClient
from alpaca.data.requests import StockBarsRequest
from alpaca.data.timeframe import TimeFrame, TimeFrameUnit
from alpaca.trading.client import TradingClient
from alpaca.trading.enums import OrderSide, OrderType, TimeInForce
from alpaca.trading.requests import MarketOrderRequest

from trading_bot.utils.logger import log

TIMEFRAME_MAP = {
    "1Min": TimeFrame(1, TimeFrameUnit.Minute),
    "5Min": TimeFrame(5, TimeFrameUnit.Minute),
    "15Min": TimeFrame(15, TimeFrameUnit.Minute),
    "1Hour": TimeFrame(1, TimeFrameUnit.Hour),
    "1Day": TimeFrame(1, TimeFrameUnit.Day),
}


class Broker:
    def __init__(self):
        api_key = os.environ["ALPACA_API_KEY"]
        secret_key = os.environ["ALPACA_SECRET_KEY"]
        self.paper = os.environ.get("TRADING_MODE", "paper").lower() == "paper"

        self.trading_client = TradingClient(
            api_key, secret_key, paper=self.paper
        )
        self.data_client = StockHistoricalDataClient(api_key, secret_key)

        mode_label = "PAPER" if self.paper else "LIVE"
        log.info(f"Broker initialized in [bold]{mode_label}[/bold] mode")

    def get_account(self) -> dict:
        account = self.trading_client.get_account()
        return {
            "equity": float(account.equity),
            "cash": float(account.cash),
            "buying_power": float(account.buying_power),
            "day_trade_count": account.daytrade_count,
        }

    def get_bars(
        self, symbol: str, timeframe: str = "1Min", lookback_days: int = 5, limit: int = 100
    ) -> pd.DataFrame:
        tf = TIMEFRAME_MAP.get(timeframe, TIMEFRAME_MAP["1Min"])
        start = datetime.now() - timedelta(days=lookback_days)

        request = StockBarsRequest(
            symbol_or_symbols=symbol,
            timeframe=tf,
            start=start,
            limit=limit,
        )
        barset = self.data_client.get_stock_bars(request)
        bars = barset[symbol]

        records = []
        for bar in bars:
            records.append({
                "timestamp": bar.timestamp,
                "open": float(bar.open),
                "high": float(bar.high),
                "low": float(bar.low),
                "close": float(bar.close),
                "volume": int(bar.volume),
            })

        df = pd.DataFrame(records)
        if not df.empty:
            df.set_index("timestamp", inplace=True)
        return df

    def submit_market_order(self, symbol: str, qty: float, side: str) -> str:
        order_side = OrderSide.BUY if side == "buy" else OrderSide.SELL
        request = MarketOrderRequest(
            symbol=symbol,
            qty=qty,
            side=order_side,
            type=OrderType.MARKET,
            time_in_force=TimeInForce.DAY,
        )
        order = self.trading_client.submit_order(request)
        log.info(
            f"[trade]ORDER {side.upper()} {qty} x {symbol} → {order.id}[/trade]"
        )
        return str(order.id)

    def get_positions(self) -> list[dict]:
        positions = self.trading_client.get_all_positions()
        return [
            {
                "symbol": p.symbol,
                "qty": float(p.qty),
                "avg_entry": float(p.avg_entry_price),
                "current_price": float(p.current_price),
                "unrealized_pnl": float(p.unrealized_pl),
                "unrealized_pnl_pct": float(p.unrealized_plpc) * 100,
            }
            for p in positions
        ]

    def close_position(self, symbol: str) -> str:
        self.trading_client.close_position(symbol)
        log.info(f"[trade]CLOSED position: {symbol}[/trade]")
        return symbol

    def cancel_all_orders(self):
        self.trading_client.cancel_orders()
        log.info("All open orders cancelled")

    def close_all_positions(self):
        self.trading_client.close_all_positions(cancel_orders=True)
        log.info("All positions closed")
