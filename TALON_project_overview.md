# 🦅 Project TALON
### *Tactical Automated Liquidity Operations Network*

> *"Strike fast. Exit clean. Leave no position open."*

---

## Overview

TALON is a Python-based automated day trading system built on the Alpaca brokerage API. It combines a real-time volatility screener, a YAML-driven rule engine, and a disciplined P&L exit framework to identify and execute intraday trades — without manual intervention.

Designed for **paper trading first**, with a clear path to live execution and future Schwab integration.

---

## Core Capabilities

| Capability | Description |
|---|---|
| **Volatility Screener** | Scans a configurable stock universe at startup, filtering by price, volume, and ATR % to find reliable high-movement candidates |
| **Rule Engine** | Loads YAML-defined trading rules at runtime — no code changes needed to add or modify strategies |
| **P&L Exit Management** | Every position has a stop-loss, take-profit, optional trailing stop, and max hold timer — all configurable per rule |
| **Risk Controls** | Daily loss cap, max open positions, max position size, and a one-command kill switch |
| **Paper / Live Toggle** | Switch between Alpaca paper and live trading via a single `.env` variable |

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                        TALON                            │
│                                                         │
│  ┌─────────────┐     ┌──────────────┐                  │
│  │  Screener   │────▶│  Rule Engine │                  │
│  │ (finds      │     │ (evaluates   │                  │
│  │  targets)   │     │  entry conds)│                  │
│  └─────────────┘     └──────┬───────┘                  │
│                             │ signals                   │
│  ┌─────────────┐     ┌──────▼───────┐                  │
│  │    Risk     │────▶│    Order     │                  │
│  │   Manager   │     │   Executor   │                  │
│  │ (size/gate) │     │  (broker API)│                  │
│  └─────────────┘     └──────┬───────┘                  │
│                             │                           │
│  ┌─────────────────────────▼────────────────────────┐  │
│  │             Position Manager                      │  │
│  │   stop-loss · take-profit · trailing · timeout    │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

---

## Project Structure

```
trading_bot/
├── main.py                        # Entry point — start here
├── config/
│   ├── settings.yaml              # Global risk, screener, data settings
│   └── rules/                     # One YAML file = one trading rule
│       ├── momentum_pnl.yaml      # EMA crossover + volume confirmation
│       └── rsi_oversold_trailing.yaml  # RSI dip + trailing stop
├── core/
│   ├── broker.py                  # Alpaca API wrapper (orders, bars, account)
│   ├── screener.py                # Volatility & reliability stock filter
│   ├── rule_engine.py             # Rule loader and signal evaluator
│   ├── position_manager.py        # Live P&L tracking, exit logic
│   └── risk_manager.py            # Kill switch, daily loss cap, sizing
├── rules/
│   ├── base_rule.py               # Abstract base class all rules extend
│   └── pnl_rules.py               # MomentumPnLRule, RSIPnLRule
├── utils/
│   ├── indicators.py              # pandas-ta wrappers (EMA, RSI, ATR, MACD)
│   └── logger.py                  # Rich terminal + file logging
└── requirements.txt
```

---

## Included Rules

### `momentum_pnl` *(enabled)*
- **Entry:** 9 EMA crosses above 21 EMA AND current volume > 20-bar average volume
- **Exit:** +3% take-profit, -1.5% stop-loss, or 2-hour max hold
- **Symbols:** Auto-populated from screener
- **Sizing:** 5% of equity per trade

### `rsi_oversold_trailing` *(disabled — enable to activate)*
- **Entry:** RSI(14) < 32 AND price above 50 EMA
- **Exit:** +5% take-profit, -2% stop-loss, 1.5% trailing stop, or 4-hour max hold
- **Symbols:** TSLA, NVDA, AMD, SPY
- **Sizing:** 4% of equity per trade

---

## Setup

```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Configure credentials
cp .env.example .env
# → Add your Alpaca Paper Trading API keys
# → Get them at: https://app.alpaca.markets → Paper Trading → API Keys

# 3. Review settings
# → Edit config/settings.yaml to adjust risk limits and screener filters

# 4. Launch
python main.py
```

---

## Adding a New Rule

No Python required for most strategies. Just create a YAML file:

```bash
# Create your rule
cp config/rules/momentum_pnl.yaml config/rules/my_rule.yaml

# Edit parameters — set enabled: true when ready
# TALON auto-discovers it on next startup
```

Available rule types (set in the `type:` field):
- `MomentumPnLRule` — EMA crossover with volume filter
- `RSIPnLRule` — RSI oversold/overbought with EMA reference

---

## Risk Controls Summary

| Control | Default | Configured in |
|---|---|---|
| Max daily loss | 3% of session equity | `settings.yaml` |
| Max open positions | 5 | `settings.yaml` |
| Max position size | 10% of equity | `settings.yaml` |
| Default stop-loss | 2% | `settings.yaml` |
| Default take-profit | 4% | `settings.yaml` |
| Kill switch | Ctrl+C or programmatic | Auto-registered |

---

## Kill Switch

```bash
# In terminal: Ctrl+C
# → Cancels all open orders
# → Closes all positions at market
# → Halts the bot
```

---

## Roadmap

- [ ] **Backtester** — validate rules on historical data before enabling live
- [ ] **Dashboard** — real-time terminal or web UI for position/P&L monitoring
- [ ] **Schwab adapter** — drop-in replacement for `core/broker.py`
- [ ] **Alert system** — Teams/Slack/email notifications on trades and errors
- [ ] **Rule composer UI** — visual interface to build YAML rules without text editing
- [ ] **Performance analytics** — win rate, avg gain/loss, Sharpe ratio per rule

---

## Technology Stack

| Layer | Technology |
|---|---|
| Language | Python 3.11+ |
| Broker API | Alpaca (`alpaca-py`) |
| Indicators | `pandas-ta` |
| Data | `pandas`, `numpy` |
| Config | YAML (`pyyaml`) |
| Logging | `rich` + file output |
| Scheduling | Native loop + `time.sleep` |

---

## ⚠️ Operational Warnings

- **Paper trade for a minimum of 2–4 weeks** before risking real capital
- **Backtest every rule** on historical data before enabling it
- **PDT Rule:** Accounts under $25,000 are limited to 3 day trades per rolling 5-day window in the US
- **Slippage is real:** Live fills differ from bar close prices — factor this into rule thresholds
- **Never disable the kill switch or daily loss cap**

---

## Alternative Project Names Considered

| Name | Meaning |
|---|---|
| **TALON** ✅ | *Tactical Automated Liquidity Operations Network* — predatory precision |
| **SPECTER** | *Smart Portfolio Execution & Trade Evaluation Routine* — covert, invisible |
| **VIPER** | *Volatility-Informed Position & Exit Routine* — fast strike, clean exit |
| **REAPER** | Autonomous, relentless execution — no hesitation |
| **NIGHTHAWK** | Stealth operations under cover of market noise |

---

*TALON — because good trades strike fast, and bad ones get cut faster.*
