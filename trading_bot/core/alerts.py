import json
import os
from datetime import datetime

import requests

from trading_bot.utils.logger import log


class AlertManager:
    """Sends trade notifications via Microsoft Teams webhook."""

    def __init__(self, config: dict):
        self.enabled = config.get("enabled", False)
        self.teams_webhook_url = config.get("teams_webhook_url") or os.environ.get("TEAMS_WEBHOOK_URL", "")
        self.notify_on_trade = config.get("notify_on_trade", True)
        self.notify_on_exit = config.get("notify_on_exit", True)
        self.notify_on_daily_target = config.get("notify_on_daily_target", True)
        self.notify_on_kill_switch = config.get("notify_on_kill_switch", True)
        self.notify_on_session_summary = config.get("notify_on_session_summary", True)

        if self.enabled and not self.teams_webhook_url:
            log.warning("Alerts enabled but no Teams webhook URL configured")
            self.enabled = False

        if self.enabled:
            log.info("Alert manager initialized (Teams webhook)")

    def _send_teams(self, card: dict):
        if not self.enabled:
            return
        try:
            resp = requests.post(
                self.teams_webhook_url,
                json=card,
                headers={"Content-Type": "application/json"},
                timeout=10,
            )
            if resp.status_code not in (200, 202):
                log.warning(f"Teams webhook returned {resp.status_code}")
        except Exception as e:
            log.warning(f"Teams alert failed: {e}")

    def _build_card(self, title: str, color: str, facts: list[dict], text: str = "") -> dict:
        return {
            "type": "message",
            "attachments": [
                {
                    "contentType": "application/vnd.microsoft.card.adaptive",
                    "content": {
                        "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
                        "type": "AdaptiveCard",
                        "version": "1.4",
                        "body": [
                            {
                                "type": "TextBlock",
                                "text": f"TALON — {title}",
                                "weight": "Bolder",
                                "size": "Medium",
                                "color": color,
                            },
                            *([{"type": "TextBlock", "text": text, "wrap": True}] if text else []),
                            {
                                "type": "FactSet",
                                "facts": facts,
                            },
                            {
                                "type": "TextBlock",
                                "text": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                                "size": "Small",
                                "isSubtle": True,
                            },
                        ],
                    },
                }
            ],
        }

    def trade_opened(self, symbol: str, qty: int, price: float, rule_name: str):
        if not self.notify_on_trade:
            return
        card = self._build_card(
            "Trade Opened", "Good",
            [
                {"title": "Symbol", "value": symbol},
                {"title": "Qty", "value": str(qty)},
                {"title": "Price", "value": f"${price:.2f}"},
                {"title": "Rule", "value": rule_name},
            ],
        )
        self._send_teams(card)

    def trade_closed(self, symbol: str, pnl: float, pnl_pct: float, reason: str):
        if not self.notify_on_exit:
            return
        color = "Good" if pnl >= 0 else "Attention"
        card = self._build_card(
            "Trade Closed", color,
            [
                {"title": "Symbol", "value": symbol},
                {"title": "P&L", "value": f"${pnl:+.2f} ({pnl_pct:+.2f}%)"},
                {"title": "Reason", "value": reason},
            ],
        )
        self._send_teams(card)

    def daily_target_hit(self, pnl_pct: float, equity: float):
        if not self.notify_on_daily_target:
            return
        card = self._build_card(
            "Daily Target Hit!", "Good",
            [
                {"title": "Session P&L", "value": f"+{pnl_pct:.2f}%"},
                {"title": "Equity", "value": f"${equity:,.2f}"},
            ],
            text="Target reached — no new trades will be opened.",
        )
        self._send_teams(card)

    def daily_stop_hit(self, pnl_pct: float, equity: float):
        if not self.notify_on_daily_target:
            return
        card = self._build_card(
            "Daily Stop Hit", "Attention",
            [
                {"title": "Session P&L", "value": f"{pnl_pct:.2f}%"},
                {"title": "Equity", "value": f"${equity:,.2f}"},
            ],
            text="Loss limit reached — trading halted for the day.",
        )
        self._send_teams(card)

    def kill_switch_activated(self):
        if not self.notify_on_kill_switch:
            return
        card = self._build_card(
            "KILL SWITCH ACTIVATED", "Attention",
            [{"title": "Action", "value": "All orders cancelled, all positions closed"}],
        )
        self._send_teams(card)

    def session_summary(self, summary: dict):
        if not self.notify_on_session_summary:
            return
        pnl = summary.get("realized_pnl", 0)
        stats = summary.get("symbol_stats", [])
        total_trades = sum(s["wins"] + s["losses"] for s in stats)
        total_wins = sum(s["wins"] for s in stats)
        wr = (total_wins / total_trades * 100) if total_trades > 0 else 0

        color = "Good" if pnl >= 0 else "Attention"
        card = self._build_card(
            "Session Summary", color,
            [
                {"title": "Realized P&L", "value": f"${pnl:+.2f}"},
                {"title": "Trades", "value": f"{total_trades} ({total_wins}W / {total_trades - total_wins}L)"},
                {"title": "Win Rate", "value": f"{wr:.1f}%"},
                {"title": "Target Hit", "value": "Yes" if summary.get("daily_target_hit") else "No"},
            ],
        )
        self._send_teams(card)

    def symbol_blocked(self, symbol: str, reason: str):
        card = self._build_card(
            "Symbol Blocked", "Warning",
            [
                {"title": "Symbol", "value": symbol},
                {"title": "Reason", "value": reason},
            ],
        )
        self._send_teams(card)
