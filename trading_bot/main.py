import signal
import sys
import time
from datetime import datetime
from pathlib import Path

import yaml
from dotenv import load_dotenv

from trading_bot.core.alerts import AlertManager
from trading_bot.core.broker import Broker
from trading_bot.core.journal import Journal
from trading_bot.core.momentum_scorer import MomentumScorer
from trading_bot.core.position_manager import PositionManager
from trading_bot.core.risk_manager import RiskManager
from trading_bot.core.rule_engine import RuleEngine
from trading_bot.core.screener import Screener
from trading_bot.core.session_manager import SessionManager
from trading_bot.core.trade_logger import TradeLogger
from trading_bot.utils.logger import console, log

BANNER = """
 ===== T A L O N =====
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

    session_manager = SessionManager(broker, settings.get("session", {}))
    session_manager.initialize(risk_manager.session_start_equity)

    alert_manager = AlertManager(settings.get("alerts", {}))
    trade_logger = TradeLogger(settings.get("logging", {}))
    journal = Journal()
    momentum_scorer = MomentumScorer(broker)

    position_manager = PositionManager(broker)

    rule_engine = RuleEngine(str(CONFIG_DIR / "rules"))
    rule_engine.load_rules()

    # Run screener and inject symbols into auto-configured rules
    screener = Screener(broker, settings["screener"])
    screened_symbols = screener.scan()
    rule_engine.inject_screener_symbols(screened_symbols)

    # Cache previous day closes for gap filter
    log.info("Caching previous closes for gap filter...")
    for symbol in screened_symbols:
        try:
            df = broker.get_bars(symbol, timeframe="1Day", lookback_days=5, limit=2)
            if len(df) >= 2:
                session_manager.set_previous_close(symbol, df["close"].iloc[-2])
        except Exception:
            pass

    active_rules = rule_engine.get_active_rules()
    if not active_rules:
        log.warning("No active rules — enable at least one rule in config/rules/")
        return

    log.info(f"Active rules: {[r.name for r in active_rules]}")
    window_status = session_manager.get_current_window_status()
    log.info(f"Current time: {window_status['current_time_et']}")
    log.info(f"Trading windows: {window_status['windows']}")

    # Momentum rescore interval
    momentum_interval = settings.get("session", {}).get("momentum_rescore_minutes", 30)
    last_momentum_rescore = datetime.now()

    # Register kill switch on Ctrl+C
    def handle_shutdown(signum, frame):
        console.print("\n[bold red]Ctrl+C detected — activating kill switch...[/bold red]")

        alert_manager.kill_switch_activated()

        # Generate session summary and journal
        summary = session_manager.get_session_summary()
        log.info(f"Session P&L: ${summary['realized_pnl']:+.2f}")
        stats = summary['symbol_stats']
        if stats:
            log.info("Symbol performance:")
            for s in stats:
                status = "BLOCKED" if s['blocked'] else "active"
                log.info(f"  {s['symbol']}: {s['wins']}W/{s['losses']}L ({s['win_rate']}%) [{status}]")

        # Log daily summary and generate journal
        trade_logger.log_daily_summary(summary)
        alert_manager.session_summary(summary)
        journal.generate_daily_report(summary, trade_logger.get_session_trades())

        risk_manager.kill_switch()
        trade_logger.close()
        sys.exit(0)

    signal.signal(signal.SIGINT, handle_shutdown)

    interval = settings.get("loop", {}).get("interval_seconds", 30)
    bar_timeframe = settings.get("data", {}).get("bar_timeframe", "1Min")
    lookback_bars = settings.get("data", {}).get("lookback_bars", 100)

    log.info(f"Starting main loop (interval: {interval}s)")

    # Main trading loop
    loop_count = 0
    while True:
        try:
            loop_count += 1

            # Check hard daily loss cap (risk manager level)
            if risk_manager.check_daily_loss():
                alert_manager.daily_stop_hit(
                    -settings["risk"]["max_daily_loss_pct"],
                    broker.get_account()["equity"],
                )
                risk_manager.kill_switch()
                break

            # Check session daily P&L target/stop
            if session_manager.should_stop_trading:
                closed_trades = position_manager.check_exits()
                for trade in closed_trades:
                    session_manager.record_trade_result(trade["symbol"], trade["pnl"])
                time.sleep(interval)
                continue

            daily_reason = session_manager.check_daily_pnl()
            if daily_reason:
                if "TARGET" in daily_reason:
                    alert_manager.daily_target_hit(
                        session_manager.daily_target_pct,
                        broker.get_account()["equity"],
                    )
                elif "STOP" in daily_reason:
                    alert_manager.daily_stop_hit(
                        -session_manager.daily_stop_pct,
                        broker.get_account()["equity"],
                    )
                log.info(f"Session stop: {daily_reason} — managing exits only")
                position_manager.check_exits()
                time.sleep(interval)
                continue

            # Check exits on existing positions and track results
            closed_trades = position_manager.check_exits()
            for trade in closed_trades:
                session_manager.record_trade_result(trade["symbol"], trade["pnl"])
                alert_manager.trade_closed(
                    trade["symbol"], trade["pnl"], 0, trade["reason"]
                )
                # Log to trade logger (get full position info from tracked data)
                trade_logger.log_trade(
                    symbol=trade["symbol"],
                    rule_name="",
                    qty=0,
                    entry_price=0,
                    exit_price=0,
                    entry_time=datetime.now(),
                    exit_time=datetime.now(),
                    exit_reason=trade["reason"],
                    pnl=trade["pnl"],
                    pnl_pct=0,
                )

            # Check if we're in a trading window
            if not session_manager.is_trading_window():
                time.sleep(interval)
                continue

            # Periodic momentum rescore — rotate into what's hot right now
            now = datetime.now()
            minutes_since_rescore = (now - last_momentum_rescore).total_seconds() / 60
            if minutes_since_rescore >= momentum_interval and screened_symbols:
                log.info("Re-scoring intraday momentum...")
                hot_symbols = momentum_scorer.get_hot_symbols(
                    screened_symbols, top_n=15, timeframe=bar_timeframe
                )
                if hot_symbols:
                    rule_engine.inject_screener_symbols(hot_symbols)
                    log.info(f"Rotated active symbols to top momentum: {hot_symbols[:5]}...")
                last_momentum_rescore = now

            # Evaluate entry signals
            if risk_manager.can_open_position():
                open_symbols = list(position_manager.tracked.keys())

                for rule in active_rules:
                    for symbol in rule.symbols:
                        if symbol in position_manager.tracked:
                            continue

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

                            price = df["close"].iloc[-1]

                            # Session manager master gate
                            allowed, reason = session_manager.can_enter(
                                symbol, price, open_symbols
                            )
                            if not allowed:
                                continue

                            if rule.check_entry(symbol, df):
                                qty = risk_manager.calculate_position_size(
                                    rule.equity_pct, price
                                )
                                if qty > 0:
                                    position_manager.open_position(
                                        symbol, qty, price, rule
                                    )
                                    open_symbols.append(symbol)

                                    alert_manager.trade_opened(
                                        symbol, qty, price, rule.name
                                    )

                        except Exception as e:
                            log.error(f"Error evaluating {symbol} for {rule.name}: {e}")

            time.sleep(interval)

        except Exception as e:
            log.error(f"Main loop error: {e}")
            time.sleep(interval)


if __name__ == "__main__":
    main()
