from dataclasses import dataclass, field
from datetime import datetime

from trading_bot.core.broker import Broker
from trading_bot.rules.base_rule import BaseRule
from trading_bot.utils.logger import log


@dataclass
class TrackedPosition:
    symbol: str
    rule_name: str
    entry_price: float
    qty: int
    entry_time: datetime
    stop_loss_pct: float
    take_profit_pct: float
    trailing_stop_pct: float | None = None
    max_hold_minutes: int | None = None
    high_water_mark: float = 0.0

    def __post_init__(self):
        self.high_water_mark = self.entry_price


class PositionManager:
    def __init__(self, broker: Broker):
        self.broker = broker
        self.tracked: dict[str, TrackedPosition] = {}

    def open_position(self, symbol: str, qty: int, price: float, rule: BaseRule) -> str:
        order_id = self.broker.submit_market_order(symbol, qty, "buy")

        self.tracked[symbol] = TrackedPosition(
            symbol=symbol,
            rule_name=rule.name,
            entry_price=price,
            qty=qty,
            entry_time=datetime.now(),
            stop_loss_pct=rule.stop_loss_pct,
            take_profit_pct=rule.take_profit_pct,
            trailing_stop_pct=rule.trailing_stop_pct,
            max_hold_minutes=rule.max_hold_minutes,
        )

        log.info(
            f"[trade]OPENED {symbol}: {qty} shares @ ~${price:.2f} "
            f"(rule: {rule.name}, SL: {rule.stop_loss_pct}%, TP: {rule.take_profit_pct}%)[/trade]"
        )
        return order_id

    def check_exits(self):
        if not self.tracked:
            return

        broker_positions = {p["symbol"]: p for p in self.broker.get_positions()}

        closed = []
        for symbol, pos in self.tracked.items():
            bp = broker_positions.get(symbol)
            if bp is None:
                # Position was closed externally
                log.info(f"{symbol} no longer in broker — removing from tracker")
                closed.append(symbol)
                continue

            current_price = bp["current_price"]
            pnl_pct = ((current_price - pos.entry_price) / pos.entry_price) * 100

            # Update high water mark for trailing stop
            if current_price > pos.high_water_mark:
                pos.high_water_mark = current_price

            exit_reason = self._should_exit(pos, current_price, pnl_pct)
            if exit_reason:
                self.broker.close_position(symbol)
                log.info(
                    f"[trade]EXIT {symbol}: {exit_reason} "
                    f"(P&L: {pnl_pct:+.2f}%, price: ${current_price:.2f})[/trade]"
                )
                closed.append(symbol)

        for symbol in closed:
            del self.tracked[symbol]

    def _should_exit(self, pos: TrackedPosition, current_price: float, pnl_pct: float) -> str | None:
        # Take profit
        if pnl_pct >= pos.take_profit_pct:
            return f"TAKE PROFIT ({pnl_pct:+.2f}% >= {pos.take_profit_pct}%)"

        # Stop loss
        if pnl_pct <= -pos.stop_loss_pct:
            return f"STOP LOSS ({pnl_pct:+.2f}% <= -{pos.stop_loss_pct}%)"

        # Trailing stop
        if pos.trailing_stop_pct is not None:
            drop_from_high = ((pos.high_water_mark - current_price) / pos.high_water_mark) * 100
            if drop_from_high >= pos.trailing_stop_pct and pnl_pct > 0:
                return f"TRAILING STOP ({drop_from_high:.2f}% drop from ${pos.high_water_mark:.2f})"

        # Max hold time
        if pos.max_hold_minutes is not None:
            elapsed = (datetime.now() - pos.entry_time).total_seconds() / 60
            if elapsed >= pos.max_hold_minutes:
                return f"MAX HOLD TIME ({elapsed:.0f}min >= {pos.max_hold_minutes}min)"

        return None

    @property
    def open_count(self) -> int:
        return len(self.tracked)
