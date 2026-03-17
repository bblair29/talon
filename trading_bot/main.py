import signal
import sys
import time
from pathlib import Path

import yaml
from dotenv import load_dotenv

from trading_bot.core.broker import Broker
from trading_bot.core.position_manager import PositionManager
from trading_bot.core.risk_manager import RiskManager
from trading_bot.core.rule_engine import RuleEngine
from trading_bot.core.screener import Screener
from trading_bot.utils.logger import console, log

BANNER = """
 ████████╗ █████╗ ██╗      ██████╗ ███╗   ██╗
 ╚══██╔══╝██╔══██╗██║     ██╔═══██╗████╗  ██║
    ██║   ███████║██║     ██║   ██║██╔██╗ ██║
    ██║   ██╔══██║██║     ██║   ██║██║╚██╗██║
    ██║   ██║  ██║███████╗╚██████╔╝██║ ╚████║
    ╚═╝   ╚═╝  ╚═╝╚══════╝ ╚═════╝ ╚═╝  ╚═══╝
   Tactical Automated Liquidity Operations Network
"""

CONFIG_DIR = Path(__file__).parent / "config"


def load_settings() -> dict:
    settings_path = CONFIG_DIR / "settings.yaml"
    with open(settings_path, "r") as f:
        return yaml.safe_load(f)


def main():
    load_dotenv()
    console.print(BANNER, style="bold cyan")

    settings = load_settings()

    # Initialize components
    broker = Broker()
    risk_manager = RiskManager(broker, settings["risk"])
    risk_manager.initialize()

    position_manager = PositionManager(broker)

    rule_engine = RuleEngine(str(CONFIG_DIR / "rules"))
    rule_engine.load_rules()

    # Run screener and inject symbols into auto-configured rules
    screener = Screener(broker, settings["screener"])
    screened_symbols = screener.scan()
    rule_engine.inject_screener_symbols(screened_symbols)

    active_rules = rule_engine.get_active_rules()
    if not active_rules:
        log.warning("No active rules — enable at least one rule in config/rules/")
        return

    log.info(f"Active rules: {[r.name for r in active_rules]}")

    # Register kill switch on Ctrl+C
    def handle_shutdown(signum, frame):
        console.print("\n[bold red]Ctrl+C detected — activating kill switch...[/bold red]")
        risk_manager.kill_switch()
        sys.exit(0)

    signal.signal(signal.SIGINT, handle_shutdown)

    interval = settings.get("loop", {}).get("interval_seconds", 30)
    bar_timeframe = settings.get("data", {}).get("bar_timeframe", "1Min")
    lookback_bars = settings.get("data", {}).get("lookback_bars", 100)

    log.info(f"Starting main loop (interval: {interval}s)")

    # Main trading loop
    while True:
        try:
            # Check daily loss cap
            if risk_manager.check_daily_loss():
                risk_manager.kill_switch()
                break

            # Check exits on existing positions
            position_manager.check_exits()

            # Evaluate entry signals
            if risk_manager.can_open_position():
                for rule in active_rules:
                    for symbol in rule.symbols:
                        if symbol in position_manager.tracked:
                            continue  # Already have a position

                        if not risk_manager.can_open_position():
                            break

                        try:
                            df = broker.get_bars(
                                symbol,
                                timeframe=bar_timeframe,
                                lookback_days=5,
                                limit=lookback_bars,
                            )
                            if df.empty:
                                continue

                            if rule.check_entry(symbol, df):
                                price = df["close"].iloc[-1]
                                qty = risk_manager.calculate_position_size(
                                    rule.equity_pct, price
                                )
                                if qty > 0:
                                    position_manager.open_position(
                                        symbol, qty, price, rule
                                    )

                        except Exception as e:
                            log.error(f"Error evaluating {symbol} for {rule.name}: {e}")

            time.sleep(interval)

        except Exception as e:
            log.error(f"Main loop error: {e}")
            time.sleep(interval)


if __name__ == "__main__":
    main()
