-- ============================================================
-- TALON: Isolated database, schema, role, user, and warehouse
-- Run as ACCOUNTADMIN
-- ============================================================

-- 1. Database & Schema
CREATE DATABASE IF NOT EXISTS TALON;
CREATE SCHEMA IF NOT EXISTS TALON.TRADING;

-- 2. Warehouse (XS is fine for this workload)
CREATE WAREHOUSE IF NOT EXISTS TALON_WH
  WAREHOUSE_SIZE = 'XSMALL'
  AUTO_SUSPEND = 60
  AUTO_RESUME = TRUE
  INITIALLY_SUSPENDED = TRUE;

-- 3. Role
CREATE ROLE IF NOT EXISTS TALON_ROLE;
GRANT USAGE ON DATABASE TALON TO ROLE TALON_ROLE;
GRANT USAGE ON SCHEMA TALON.TRADING TO ROLE TALON_ROLE;
GRANT ALL PRIVILEGES ON SCHEMA TALON.TRADING TO ROLE TALON_ROLE;
GRANT USAGE ON WAREHOUSE TALON_WH TO ROLE TALON_ROLE;
GRANT CREATE TABLE ON SCHEMA TALON.TRADING TO ROLE TALON_ROLE;

-- 4. Service account user (replace the password before running)
CREATE USER IF NOT EXISTS TALON_SVC
  PASSWORD = '<REPLACE_WITH_STRONG_PASSWORD>'
  DEFAULT_ROLE = TALON_ROLE
  DEFAULT_WAREHOUSE = TALON_WH
  DEFAULT_NAMESPACE = TALON.TRADING
  MUST_CHANGE_PASSWORD = FALSE;

GRANT ROLE TALON_ROLE TO USER TALON_SVC;

-- 5. Tables (stay as ACCOUNTADMIN — TALON_ROLE owns them via grants below)
USE DATABASE TALON;
USE SCHEMA TRADING;

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
);

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
);

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
);

CREATE TABLE IF NOT EXISTS RULES (
    id INTEGER AUTOINCREMENT,
    name VARCHAR(100) NOT NULL UNIQUE,
    type VARCHAR(50) NOT NULL,
    enabled BOOLEAN DEFAULT TRUE,
    description VARCHAR(500),
    config VARIANT,
    created_at TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
    updated_at TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

-- 6. Grant table permissions to role
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA TALON.TRADING TO ROLE TALON_ROLE;
GRANT ALL PRIVILEGES ON FUTURE TABLES IN SCHEMA TALON.TRADING TO ROLE TALON_ROLE;
