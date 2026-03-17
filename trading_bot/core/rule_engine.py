import os
from pathlib import Path

import yaml

from trading_bot.rules.base_rule import BaseRule
from trading_bot.rules.pnl_rules import MomentumPnLRule, RSIPnLRule
from trading_bot.utils.logger import log

RULE_TYPE_MAP: dict[str, type[BaseRule]] = {
    "MomentumPnLRule": MomentumPnLRule,
    "RSIPnLRule": RSIPnLRule,
}


class RuleEngine:
    def __init__(self, rules_dir: str):
        self.rules_dir = rules_dir
        self.rules: list[BaseRule] = []

    def load_rules(self):
        rules_path = Path(self.rules_dir)
        if not rules_path.exists():
            log.error(f"Rules directory not found: {self.rules_dir}")
            return

        for rule_file in sorted(rules_path.glob("*.yaml")):
            try:
                with open(rule_file, "r") as f:
                    config = yaml.safe_load(f)

                rule_type = config.get("type")
                if rule_type not in RULE_TYPE_MAP:
                    log.warning(f"Unknown rule type '{rule_type}' in {rule_file.name} — skipping")
                    continue

                rule_cls = RULE_TYPE_MAP[rule_type]
                rule = rule_cls(config)
                self.rules.append(rule)

                status = "[success]ENABLED[/success]" if rule.enabled else "[warning]DISABLED[/warning]"
                log.info(f"  Loaded rule: {rule.name} ({rule_type}) — {status}")

            except Exception as e:
                log.error(f"Failed to load rule {rule_file.name}: {e}")

        log.info(f"Rule engine loaded {len(self.rules)} rules")

    def get_active_rules(self) -> list[BaseRule]:
        return [r for r in self.rules if r.enabled]

    def inject_screener_symbols(self, symbols: list[str]):
        for rule in self.rules:
            if not rule.symbols or rule.symbols == ["auto"]:
                rule.symbols = symbols
                log.info(f"  Injected {len(symbols)} screener symbols into '{rule.name}'")
