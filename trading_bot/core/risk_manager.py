from trading_bot.core.broker import Broker
from trading_bot.utils.logger import log


class RiskManager:
    def __init__(self, broker: Broker, config: dict):
        self.broker = broker
        self.max_daily_loss_pct = config.get("max_daily_loss_pct", 3.0)
        self.max_open_positions = config.get("max_open_positions", 5)
        self.max_position_size_pct = config.get("max_position_size_pct", 10.0)
        self.default_stop_loss_pct = config.get("default_stop_loss_pct", 2.0)
        self.default_take_profit_pct = config.get("default_take_profit_pct", 4.0)

        self.session_start_equity: float | None = None
        self.halted = False

    def initialize(self):
        account = self.broker.get_account()
        self.session_start_equity = account["equity"]
        log.info(f"Session start equity: ${self.session_start_equity:,.2f}")

    def check_daily_loss(self) -> bool:
        if self.session_start_equity is None:
            return False
        account = self.broker.get_account()
        current_equity = account["equity"]
        loss_pct = ((self.session_start_equity - current_equity) / self.session_start_equity) * 100

        if loss_pct >= self.max_daily_loss_pct:
            log.error(
                f"[error]DAILY LOSS CAP HIT: -{loss_pct:.2f}% "
                f"(limit: {self.max_daily_loss_pct}%)[/error]"
            )
            self.halted = True
            return True
        return False

    def can_open_position(self) -> bool:
        if self.halted:
            log.warning("Trading halted — daily loss cap reached")
            return False

        positions = self.broker.get_positions()
        if len(positions) >= self.max_open_positions:
            log.warning(
                f"Max open positions reached ({self.max_open_positions})"
            )
            return False
        return True

    def calculate_position_size(self, equity_pct: float, price: float) -> int:
        account = self.broker.get_account()
        equity = account["equity"]

        # Cap at max position size
        effective_pct = min(equity_pct, self.max_position_size_pct)
        dollar_amount = equity * (effective_pct / 100)
        qty = int(dollar_amount / price)
        return max(qty, 0)

    def kill_switch(self):
        log.warning("[error]KILL SWITCH ACTIVATED[/error]")
        self.broker.cancel_all_orders()
        self.broker.close_all_positions()
        self.halted = True
        log.info("All orders cancelled, all positions closed, trading halted")
