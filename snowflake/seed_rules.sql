-- ============================================================
-- TALON: Seed the RULES table with the 4 default trading rules
-- Run as TALON_ROLE (or ACCOUNTADMIN)
-- ============================================================

USE DATABASE TALON;
USE SCHEMA TRADING;

INSERT INTO RULES (name, type, enabled, description, config) VALUES
(
  'scalper',
  'ScalperRule',
  TRUE,
  'Bollinger Band bounce scalper — quick entries at support with tight exits',
  PARSE_JSON('{
    "entry": {"bb_period": 20, "bb_std": 2.0, "stoch_k": 14, "stoch_d": 3, "stoch_oversold": 25, "adx_min": 20},
    "exit": {"take_profit_pct": 1.0, "stop_loss_pct": 0.5, "trailing_stop_pct": 0.4, "max_hold_minutes": 45},
    "sizing": {"equity_pct": 5.0},
    "symbols": "auto"
  }')
),
(
  'vwap_reversion',
  'VWAPMeanReversionRule',
  TRUE,
  'VWAP mean reversion — buy dips below VWAP, sell on snap-back',
  PARSE_JSON('{
    "entry": {"vwap_dip_pct": 0.3, "rsi_period": 14, "rsi_max": 40, "volume_multiplier": 1.2},
    "exit": {"take_profit_pct": 1.0, "stop_loss_pct": 0.5, "trailing_stop_pct": 0.3, "max_hold_minutes": 60},
    "sizing": {"equity_pct": 4.0},
    "symbols": "auto"
  }')
),
(
  'momentum_pnl',
  'MomentumPnLRule',
  TRUE,
  'EMA crossover with volume confirmation',
  PARSE_JSON('{
    "entry": {"fast_ema": 9, "slow_ema": 21, "volume_avg_period": 20, "volume_multiplier": 1.0},
    "exit": {"take_profit_pct": 3.0, "stop_loss_pct": 1.5, "trailing_stop_pct": null, "max_hold_minutes": 120},
    "sizing": {"equity_pct": 5.0},
    "symbols": "auto"
  }')
),
(
  'rsi_oversold_trailing',
  'RSIPnLRule',
  FALSE,
  'RSI oversold bounce with trailing stop',
  PARSE_JSON('{
    "entry": {"rsi_period": 14, "rsi_threshold": 32, "ema_period": 50},
    "exit": {"take_profit_pct": 5.0, "stop_loss_pct": 2.0, "trailing_stop_pct": 1.5, "max_hold_minutes": 240},
    "sizing": {"equity_pct": 4.0},
    "symbols": ["TSLA", "NVDA", "AMD", "SPY"]
  }')
);
