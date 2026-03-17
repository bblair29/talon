import json
import os
from datetime import datetime
from pathlib import Path

from trading_bot.utils.logger import log

# Snowflake is optional — falls back to local JSON logging
try:
    import snowflake.connector
    HAS_SNOWFLAKE = True
except ImportError:
    HAS_SNOWFLAKE = False


class TradeLogger:
    """Persists trade data to Snowflake and/or local JSON files."""

    def __init__(self, config: dict):
        self.snowflake_enabled = config.get("snowflake_enabled", False) and HAS_SNOWFLAKE
        self.local_enabled = config.get("local_enabled", True)
        self.local_dir = config.get("local_dir", "logs/trades")

        # Snowflake config
        self.sf_account = config.get("sf_account") or os.environ.get("SNOWFLAKE_ACCOUNT", "")
        self.sf_user = config.get("sf_user") or os.environ.get("SNOWFLAKE_USER", "")
        self.sf_password = os.environ.get("SNOWFLAKE_PASSWORD", "")
        self.sf_database = config.get("sf_database", "TALON")
        self.sf_schema = config.get("sf_schema", "TRADING")
        self.sf_warehouse = config.get("sf_warehouse", "COMPUTE_WH")

        self.sf_conn = None
        self._session_trades: list[dict] = []
        self._daily_snapshots: list[dict] = []

        if self.local_enabled:
            os.makedirs(self.local_dir, exist_ok=True)
            log.info(f"Trade logger: local file logging to {self.local_dir}/")

        if self.snowflake_enabled:
            self._connect_snowflake()

    def _connect_snowflake(self):
        try:
            self.sf_conn = snowflake.connector.connect(
                account=self.sf_account,
                user=self.sf_user,
                password=self.sf_password,
                database=self.sf_database,
                schema=self.sf_schema,
                warehouse=self.sf_warehouse,
            )
            self._ensure_tables()
            log.info("Trade logger: connected to Snowflake")
        except Exception as e:
            log.warning(f"Snowflake connection failed: {e} — falling back to local only")
            self.snowflake_enabled = False

    def _ensure_tables(self):
        if not self.sf_conn:
            return
        cursor = self.sf_conn.cursor()
        try:
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS TRADE_HISTORY (
                    id INTEGER AUTOINCREMENT,
                    session_date DATE,
                    symbol VARCHAR(10),
                    rule_name VARCHAR(50),
                    side VARCHAR(4),
                    qty INTEGER,
                    entry_price FLOAT,
                    exit_price FLOAT,
                    entry_time TIMESTAMP_NTZ,
                    exit_time TIMESTAMP_NTZ,
                    exit_reason VARCHAR(100),
                    pnl FLOAT,
                    pnl_pct FLOAT,
                    created_at TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
                )
            """)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS DAILY_SUMMARY (
                    id INTEGER AUTOINCREMENT,
                    session_date DATE,
                    start_equity FLOAT,
                    end_equity FLOAT,
                    realized_pnl FLOAT,
                    total_trades INTEGER,
                    winning_trades INTEGER,
                    losing_trades INTEGER,
                    win_rate FLOAT,
                    daily_target_hit BOOLEAN,
                    daily_stop_hit BOOLEAN,
                    top_winner VARCHAR(10),
                    top_loser VARCHAR(10),
                    created_at TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
                )
            """)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS BACKTEST_RESULTS (
                    id INTEGER AUTOINCREMENT,
                    run_date DATE,
                    rule_name VARCHAR(50),
                    symbol VARCHAR(10),
                    timeframe VARCHAR(10),
                    lookback_days INTEGER,
                    start_date DATE,
                    end_date DATE,
                    initial_equity FLOAT,
                    final_equity FLOAT,
                    total_return_pct FLOAT,
                    total_trades INTEGER,
                    win_rate FLOAT,
                    profit_factor FLOAT,
                    sharpe_ratio FLOAT,
                    max_drawdown_pct FLOAT,
                    created_at TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
                )
            """)
        finally:
            cursor.close()

    def log_trade(
        self,
        symbol: str,
        rule_name: str,
        qty: int,
        entry_price: float,
        exit_price: float,
        entry_time: datetime,
        exit_time: datetime,
        exit_reason: str,
        pnl: float,
        pnl_pct: float,
    ):
        trade = {
            "session_date": datetime.now().strftime("%Y-%m-%d"),
            "symbol": symbol,
            "rule_name": rule_name,
            "side": "BUY",
            "qty": qty,
            "entry_price": round(entry_price, 2),
            "exit_price": round(exit_price, 2),
            "entry_time": entry_time.isoformat(),
            "exit_time": exit_time.isoformat(),
            "exit_reason": exit_reason,
            "pnl": round(pnl, 2),
            "pnl_pct": round(pnl_pct, 4),
        }

        self._session_trades.append(trade)

        # Local file
        if self.local_enabled:
            self._append_local(trade)

        # Snowflake
        if self.snowflake_enabled and self.sf_conn:
            try:
                cursor = self.sf_conn.cursor()
                cursor.execute(
                    """INSERT INTO TRADE_HISTORY
                    (session_date, symbol, rule_name, side, qty, entry_price, exit_price,
                     entry_time, exit_time, exit_reason, pnl, pnl_pct)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
                    (trade["session_date"], symbol, rule_name, "BUY", qty,
                     entry_price, exit_price, entry_time, exit_time,
                     exit_reason, pnl, pnl_pct),
                )
                cursor.close()
            except Exception as e:
                log.warning(f"Snowflake trade insert failed: {e}")

    def log_daily_summary(self, summary: dict):
        stats = summary.get("symbol_stats", [])
        total_trades = sum(s["wins"] + s["losses"] for s in stats)
        total_wins = sum(s["wins"] for s in stats)
        total_losses = total_trades - total_wins
        wr = (total_wins / total_trades * 100) if total_trades > 0 else 0

        # Find top winner and loser by P&L
        symbol_pnl = {}
        for t in self._session_trades:
            sym = t["symbol"]
            symbol_pnl[sym] = symbol_pnl.get(sym, 0) + t["pnl"]

        top_winner = max(symbol_pnl, key=symbol_pnl.get) if symbol_pnl else ""
        top_loser = min(symbol_pnl, key=symbol_pnl.get) if symbol_pnl else ""

        daily = {
            "session_date": datetime.now().strftime("%Y-%m-%d"),
            "start_equity": summary.get("session_start_equity", 0),
            "realized_pnl": summary.get("realized_pnl", 0),
            "total_trades": total_trades,
            "winning_trades": total_wins,
            "losing_trades": total_losses,
            "win_rate": round(wr, 2),
            "daily_target_hit": summary.get("daily_target_hit", False),
            "daily_stop_hit": summary.get("daily_stop_hit", False),
            "top_winner": top_winner,
            "top_loser": top_loser,
            "trades": self._session_trades,
        }

        if self.local_enabled:
            date_str = datetime.now().strftime("%Y-%m-%d")
            path = Path(self.local_dir) / f"summary_{date_str}.json"
            with open(path, "w") as f:
                json.dump(daily, f, indent=2, default=str)
            log.info(f"Daily summary saved to {path}")

        if self.snowflake_enabled and self.sf_conn:
            try:
                cursor = self.sf_conn.cursor()
                cursor.execute(
                    """INSERT INTO DAILY_SUMMARY
                    (session_date, start_equity, realized_pnl, total_trades,
                     winning_trades, losing_trades, win_rate,
                     daily_target_hit, daily_stop_hit, top_winner, top_loser)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
                    (daily["session_date"], daily["start_equity"],
                     daily["realized_pnl"], total_trades, total_wins, total_losses,
                     wr, daily["daily_target_hit"], daily["daily_stop_hit"],
                     top_winner, top_loser),
                )
                cursor.close()
            except Exception as e:
                log.warning(f"Snowflake summary insert failed: {e}")

    def log_backtest(self, result_dict: dict, timeframe: str, lookback_days: int):
        if self.snowflake_enabled and self.sf_conn:
            try:
                cursor = self.sf_conn.cursor()
                cursor.execute(
                    """INSERT INTO BACKTEST_RESULTS
                    (run_date, rule_name, symbol, timeframe, lookback_days,
                     start_date, end_date, initial_equity, final_equity,
                     total_return_pct, total_trades, win_rate, profit_factor,
                     sharpe_ratio, max_drawdown_pct)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
                    (datetime.now().strftime("%Y-%m-%d"),
                     result_dict["rule_name"], result_dict["symbol"],
                     timeframe, lookback_days,
                     result_dict["start_date"], result_dict["end_date"],
                     result_dict["initial_equity"], result_dict["final_equity"],
                     result_dict["total_return_pct"], result_dict["total_trades"],
                     result_dict["win_rate"], result_dict["profit_factor"],
                     result_dict["sharpe_ratio"], result_dict["max_drawdown_pct"]),
                )
                cursor.close()
            except Exception as e:
                log.warning(f"Snowflake backtest insert failed: {e}")

    def _append_local(self, trade: dict):
        date_str = datetime.now().strftime("%Y-%m-%d")
        path = Path(self.local_dir) / f"trades_{date_str}.jsonl"
        with open(path, "a") as f:
            f.write(json.dumps(trade, default=str) + "\n")

    def get_session_trades(self) -> list[dict]:
        return self._session_trades

    def close(self):
        if self.sf_conn:
            self.sf_conn.close()
