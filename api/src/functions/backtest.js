import { app } from '@azure/functions';
import Alpaca from '@alpacahq/alpaca-trade-api';
import { query } from '../lib/snowflake.js';

const alpaca = new Alpaca({
  keyId: process.env.ALPACA_API_KEY,
  secretKey: process.env.ALPACA_SECRET_KEY,
  paper: true,
});

const TIMEFRAME_MAP = {
  '1Min': '1Min',
  '5Min': '5Min',
  '15Min': '15Min',
  '1Hour': '1Hour',
};

app.http('backtest', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'backtest',
  handler: async (request) => {
    try {
      const body = await request.json();
      const { symbol, rule: ruleName, timeframe = '5Min', lookback = 30, equity = 100000 } = body;

      // Fetch rule config from Snowflake
      const ruleRows = await query('SELECT * FROM RULES WHERE name = ?', [ruleName]);
      if (ruleRows.length === 0) {
        return { status: 404, jsonBody: { error: `Rule "${ruleName}" not found` } };
      }
      const ruleRow = ruleRows[0];
      const config = typeof ruleRow.CONFIG === 'string' ? JSON.parse(ruleRow.CONFIG) : ruleRow.CONFIG;
      const ruleType = ruleRow.TYPE;
      const exitConfig = config.exit || {};
      const entryConfig = config.entry || {};
      const sizingConfig = config.sizing || {};

      // Fetch historical bars
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - lookback);

      const bars = [];
      const barsIter = alpaca.getBarsV2(symbol, {
        start: startDate.toISOString().split('T')[0],
        end: endDate.toISOString().split('T')[0],
        timeframe: TIMEFRAME_MAP[timeframe] || '5Min',
      });
      for await (const bar of barsIter) {
        bars.push({
          t: bar.Timestamp,
          o: bar.OpenPrice,
          h: bar.HighPrice,
          l: bar.LowPrice,
          c: bar.ClosePrice,
          v: bar.Volume,
        });
      }

      if (bars.length < 30) {
        return { status: 400, jsonBody: { error: 'Not enough data for backtest' } };
      }

      // Simple indicator helpers
      const ema = (data, period) => {
        const k = 2 / (period + 1);
        const result = [data[0]];
        for (let i = 1; i < data.length; i++) {
          result.push(data[i] * k + result[i - 1] * (1 - k));
        }
        return result;
      };

      const sma = (data, period) => {
        const result = [];
        for (let i = 0; i < data.length; i++) {
          if (i < period - 1) { result.push(null); continue; }
          const slice = data.slice(i - period + 1, i + 1);
          result.push(slice.reduce((a, b) => a + b, 0) / period);
        }
        return result;
      };

      const rsi = (data, period) => {
        const result = new Array(data.length).fill(null);
        let avgGain = 0, avgLoss = 0;
        for (let i = 1; i <= period; i++) {
          const diff = data[i] - data[i - 1];
          if (diff > 0) avgGain += diff; else avgLoss -= diff;
        }
        avgGain /= period;
        avgLoss /= period;
        result[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
        for (let i = period + 1; i < data.length; i++) {
          const diff = data[i] - data[i - 1];
          avgGain = (avgGain * (period - 1) + Math.max(diff, 0)) / period;
          avgLoss = (avgLoss * (period - 1) + Math.max(-diff, 0)) / period;
          result[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
        }
        return result;
      };

      // Compute indicators based on rule type
      const closes = bars.map((b) => b.c);
      const volumes = bars.map((b) => b.v);

      // Backtest simulation
      let cash = equity;
      let position = null;
      const trades = [];
      const equityCurve = [];

      const takeProfitPct = (exitConfig.take_profit_pct || 3) / 100;
      const stopLossPct = (exitConfig.stop_loss_pct || 1.5) / 100;
      const trailingPct = exitConfig.trailing_stop_pct ? exitConfig.trailing_stop_pct / 100 : null;
      const maxHoldBars = Math.round((exitConfig.max_hold_minutes || 120) / 5); // approximate
      const equityPct = (sizingConfig.equity_pct || 5) / 100;

      // Pre-compute indicators
      let signals;
      if (ruleType === 'MomentumPnLRule') {
        const fastEma = ema(closes, entryConfig.fast_ema || 9);
        const slowEma = ema(closes, entryConfig.slow_ema || 21);
        const volAvg = sma(volumes, entryConfig.volume_avg_period || 20);
        const volMult = entryConfig.volume_multiplier || 1.0;
        signals = closes.map((_, i) => {
          if (i < 1 || !volAvg[i]) return false;
          return fastEma[i] > slowEma[i] && fastEma[i - 1] <= slowEma[i - 1]
            && volumes[i] >= volAvg[i] * volMult;
        });
      } else if (ruleType === 'RSIPnLRule') {
        const rsiVals = rsi(closes, entryConfig.rsi_period || 14);
        const emaVals = ema(closes, entryConfig.ema_period || 50);
        const threshold = entryConfig.rsi_threshold || 32;
        signals = closes.map((c, i) => {
          if (!rsiVals[i]) return false;
          return rsiVals[i] < threshold && c > emaVals[i];
        });
      } else if (ruleType === 'VWAPMeanReversionRule') {
        // Approximate VWAP as cumulative (volume * close) / cumulative volume
        const dipPct = (entryConfig.vwap_dip_pct || 0.3) / 100;
        const rsiVals = rsi(closes, entryConfig.rsi_period || 14);
        const rsiMax = entryConfig.rsi_max || 40;
        const volAvg = sma(volumes, 20);
        const volMult = entryConfig.volume_multiplier || 1.2;
        let cumVol = 0, cumVP = 0;
        signals = closes.map((c, i) => {
          cumVol += volumes[i];
          cumVP += volumes[i] * c;
          const vwap = cumVP / cumVol;
          if (!rsiVals[i] || !volAvg[i]) return false;
          return c < vwap * (1 - dipPct) && rsiVals[i] < rsiMax
            && volumes[i] >= volAvg[i] * volMult;
        });
      } else if (ruleType === 'ScalperRule') {
        // Simplified BB bounce
        const period = entryConfig.bb_period || 20;
        const std = entryConfig.bb_std || 2.0;
        const smaVals = sma(closes, period);
        signals = closes.map((c, i) => {
          if (!smaVals[i] || i < period) return false;
          const slice = closes.slice(i - period + 1, i + 1);
          const stdDev = Math.sqrt(slice.reduce((s, v) => s + (v - smaVals[i]) ** 2, 0) / period);
          const lowerBB = smaVals[i] - std * stdDev;
          return c <= lowerBB * 1.005; // near lower band
        });
      } else {
        signals = closes.map(() => false);
      }

      // Run simulation
      for (let i = 0; i < bars.length; i++) {
        const bar = bars[i];

        // Check exits
        if (position) {
          const pnlPct = (bar.c - position.entry) / position.entry;
          const barsHeld = i - position.barIndex;

          // Update high watermark
          if (bar.h > position.highWater) position.highWater = bar.h;

          let exitReason = null;
          if (pnlPct >= takeProfitPct) exitReason = 'TAKE_PROFIT';
          else if (pnlPct <= -stopLossPct) exitReason = 'STOP_LOSS';
          else if (trailingPct && position.highWater > position.entry) {
            const trailStop = position.highWater * (1 - trailingPct);
            if (bar.c <= trailStop) exitReason = 'TRAILING_STOP';
          }
          if (barsHeld >= maxHoldBars) exitReason = exitReason || 'MAX_HOLD';

          if (exitReason) {
            const pnl = (bar.c - position.entry) * position.qty;
            cash += position.qty * bar.c;
            trades.push({
              symbol,
              entry_price: position.entry,
              exit_price: bar.c,
              entry_time: position.time,
              exit_time: bar.t,
              qty: position.qty,
              pnl: Math.round(pnl * 100) / 100,
              pnl_pct: Math.round(pnlPct * 10000) / 100,
              exit_reason: exitReason,
            });
            position = null;
          }
        }

        // Check entry
        if (!position && signals[i]) {
          const positionSize = cash * equityPct;
          const qty = Math.floor(positionSize / bar.c);
          if (qty > 0) {
            cash -= qty * bar.c;
            position = {
              entry: bar.c,
              qty,
              time: bar.t,
              barIndex: i,
              highWater: bar.c,
            };
          }
        }

        // Track equity
        const posValue = position ? position.qty * bar.c : 0;
        equityCurve.push({
          time: bar.t,
          equity: Math.round((cash + posValue) * 100) / 100,
        });
      }

      // Close any open position at end
      if (position) {
        const lastBar = bars[bars.length - 1];
        const pnl = (lastBar.c - position.entry) * position.qty;
        const pnlPct = (lastBar.c - position.entry) / position.entry;
        cash += position.qty * lastBar.c;
        trades.push({
          symbol,
          entry_price: position.entry,
          exit_price: lastBar.c,
          entry_time: position.time,
          exit_time: lastBar.t,
          qty: position.qty,
          pnl: Math.round(pnl * 100) / 100,
          pnl_pct: Math.round(pnlPct * 10000) / 100,
          exit_reason: 'END_OF_DATA',
        });
      }

      // Compute summary stats
      const totalReturn = ((cash - equity) / equity) * 100;
      const wins = trades.filter((t) => t.pnl > 0);
      const losses = trades.filter((t) => t.pnl <= 0);
      const winRate = trades.length > 0 ? (wins.length / trades.length) * 100 : 0;
      const grossProfit = wins.reduce((s, t) => s + t.pnl, 0);
      const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnl, 0));
      const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : 0;

      // Max drawdown
      let peak = equity, maxDD = 0;
      for (const pt of equityCurve) {
        if (pt.equity > peak) peak = pt.equity;
        const dd = (peak - pt.equity) / peak * 100;
        if (dd > maxDD) maxDD = dd;
      }

      // Sharpe (approximate)
      const pnls = trades.map((t) => t.pnl);
      const avgPnl = pnls.length > 0 ? pnls.reduce((a, b) => a + b, 0) / pnls.length : 0;
      const stdPnl = pnls.length > 1
        ? Math.sqrt(pnls.reduce((s, p) => s + (p - avgPnl) ** 2, 0) / (pnls.length - 1))
        : 1;
      const sharpe = stdPnl > 0 ? avgPnl / stdPnl : 0;

      return {
        jsonBody: {
          rule_name: ruleName,
          symbol,
          timeframe,
          lookback_days: lookback,
          initial_equity: equity,
          final_equity: Math.round(cash * 100) / 100,
          total_return_pct: Math.round(totalReturn * 100) / 100,
          pnl: Math.round((cash - equity) * 100) / 100,
          total_trades: trades.length,
          win_rate: Math.round(winRate * 10) / 10,
          profit_factor: Math.round(profitFactor * 100) / 100,
          sharpe_ratio: Math.round(sharpe * 100) / 100,
          max_drawdown_pct: Math.round(maxDD * 100) / 100,
          avg_win: wins.length > 0 ? Math.round(grossProfit / wins.length * 100) / 100 : 0,
          avg_loss: losses.length > 0 ? Math.round(-grossLoss / losses.length * 100) / 100 : 0,
          equity_curve: equityCurve,
          trades,
        },
      };
    } catch (err) {
      return { status: 500, jsonBody: { error: err.message } };
    }
  },
});
