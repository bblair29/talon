from abc import ABC, abstractmethod

import pandas as pd


class BaseRule(ABC):
    def __init__(self, config: dict):
        self.name = config["name"]
        self.enabled = config.get("enabled", False)
        self.description = config.get("description", "")
        self.entry_config = config.get("entry", {})
        self.exit_config = config.get("exit", {})
        self.sizing_config = config.get("sizing", {})
        self.symbols: list[str] = []

        # Parse symbols
        sym = config.get("symbols", [])
        if isinstance(sym, list):
            self.symbols = sym
        # "auto" means screener will populate them later

    @abstractmethod
    def check_entry(self, symbol: str, df: pd.DataFrame) -> bool:
        """Return True if entry conditions are met for this symbol."""

    @property
    def take_profit_pct(self) -> float:
        return self.exit_config.get("take_profit_pct", 4.0)

    @property
    def stop_loss_pct(self) -> float:
        return self.exit_config.get("stop_loss_pct", 2.0)

    @property
    def trailing_stop_pct(self) -> float | None:
        return self.exit_config.get("trailing_stop_pct")

    @property
    def max_hold_minutes(self) -> int | None:
        return self.exit_config.get("max_hold_minutes")

    @property
    def equity_pct(self) -> float:
        return self.sizing_config.get("equity_pct", 5.0)

    def __repr__(self) -> str:
        status = "ON" if self.enabled else "OFF"
        return f"<{self.name} [{status}] — {self.description}>"
