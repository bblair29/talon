"""Auto-generates daily trade journal reports."""

import json
import os
from datetime import datetime
from pathlib import Path

from trading_bot.utils.logger import log


class Journal:
    """Generates readable daily reports from trade data."""

    def __init__(self, output_dir: str = "logs/journal"):
        self.output_dir = output_dir
        os.makedirs(output_dir, exist_ok=True)

    def generate_daily_report(self, session_summary: dict, trades: list[dict]) -> str:
        """Generate a markdown daily journal entry. Returns the file path."""
        date_str = datetime.now().strftime("%Y-%m-%d")
        pnl = session_summary.get("realized_pnl", 0)
        start_eq = session_summary.get("session_start_equity", 0)
        target_hit = session_summary.get("daily_target_hit", False)
        stop_hit = session_summary.get("daily_stop_hit", False)
        stats = session_summary.get("symbol_stats", [])

        total_trades = sum(s["wins"] + s["losses"] for s in stats)
        total_wins = sum(s["wins"] for s in stats)
        wr = (total_wins / total_trades * 100) if total_trades > 0 else 0

        # Build P&L by symbol
        symbol_pnl = {}
        symbol_trades = {}
        rule_pnl = {}
        exit_reasons = {}
        for t in trades:
            sym = t.get("symbol", "?")
            rule = t.get("rule_name", "?")
            reason = t.get("exit_reason", "?")
            p = t.get("pnl", 0)

            symbol_pnl[sym] = symbol_pnl.get(sym, 0) + p
            symbol_trades[sym] = symbol_trades.get(sym, 0) + 1
            rule_pnl[rule] = rule_pnl.get(rule, 0) + p
            exit_reasons[reason] = exit_reasons.get(reason, 0) + 1

        # Sort
        best_symbols = sorted(symbol_pnl.items(), key=lambda x: x[1], reverse=True)
        best_rules = sorted(rule_pnl.items(), key=lambda x: x[1], reverse=True)

        # Determine session outcome
        if target_hit:
            outcome = "TARGET HIT"
        elif stop_hit:
            outcome = "STOP HIT"
        elif pnl > 0:
            outcome = "GREEN DAY"
        elif pnl < 0:
            outcome = "RED DAY"
        else:
            outcome = "FLAT"

        pnl_pct = (pnl / start_eq * 100) if start_eq > 0 else 0

        lines = [
            f"# TALON Daily Journal — {date_str}",
            "",
            f"## Session Outcome: {outcome}",
            "",
            f"| Metric | Value |",
            f"|--------|-------|",
            f"| Start Equity | ${start_eq:,.2f} |",
            f"| Realized P&L | ${pnl:+,.2f} ({pnl_pct:+.2f}%) |",
            f"| Total Trades | {total_trades} |",
            f"| Win / Loss | {total_wins}W / {total_trades - total_wins}L |",
            f"| Win Rate | {wr:.1f}% |",
            f"| Daily Target Hit | {'Yes' if target_hit else 'No'} |",
            f"| Daily Stop Hit | {'Yes' if stop_hit else 'No'} |",
            "",
        ]

        # P&L by symbol
        if best_symbols:
            lines.append("## P&L by Symbol")
            lines.append("")
            lines.append("| Symbol | Trades | P&L |")
            lines.append("|--------|--------|-----|")
            for sym, p in best_symbols:
                cnt = symbol_trades.get(sym, 0)
                lines.append(f"| {sym} | {cnt} | ${p:+.2f} |")
            lines.append("")

        # P&L by rule
        if best_rules:
            lines.append("## P&L by Rule")
            lines.append("")
            lines.append("| Rule | P&L |")
            lines.append("|------|-----|")
            for rule, p in best_rules:
                lines.append(f"| {rule} | ${p:+.2f} |")
            lines.append("")

        # Exit reasons
        if exit_reasons:
            lines.append("## Exit Reasons")
            lines.append("")
            lines.append("| Reason | Count |")
            lines.append("|--------|-------|")
            for reason, count in sorted(exit_reasons.items(), key=lambda x: x[1], reverse=True):
                lines.append(f"| {reason} | {count} |")
            lines.append("")

        # Blocked symbols
        blocked = [s for s in stats if s.get("blocked")]
        if blocked:
            lines.append("## Blocked Symbols")
            lines.append("")
            for s in blocked:
                lines.append(f"- **{s['symbol']}**: {s['wins']}W/{s['losses']}L ({s['win_rate']}%)")
            lines.append("")

        # Lessons / analysis
        lines.append("## Auto-Analysis")
        lines.append("")

        if wr >= 55:
            lines.append("- Win rate above 55% — rules are finding edge today")
        elif wr < 40 and total_trades > 5:
            lines.append("- Win rate below 40% — consider tightening entry conditions or sitting out")

        if target_hit:
            lines.append("- Daily target hit — discipline held, gains locked in")

        if stop_hit:
            lines.append("- Daily stop hit — review which symbols/rules caused the damage")

        top_winner = best_symbols[0] if best_symbols else None
        top_loser = best_symbols[-1] if len(best_symbols) > 1 else None
        if top_winner and top_winner[1] > 0:
            lines.append(f"- Best performer: **{top_winner[0]}** (${top_winner[1]:+.2f})")
        if top_loser and top_loser[1] < 0:
            lines.append(f"- Worst performer: **{top_loser[0]}** (${top_loser[1]:+.2f})")

        lines.append("")
        lines.append("---")
        lines.append(f"*Generated by TALON at {datetime.now().strftime('%H:%M:%S')}*")

        content = "\n".join(lines)

        # Write file
        path = Path(self.output_dir) / f"journal_{date_str}.md"
        with open(path, "w") as f:
            f.write(content)

        log.info(f"Daily journal saved to {path}")
        return str(path)
