import { app } from '@azure/functions';
import { query } from '../lib/snowflake.js';

app.http('analytics', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'analytics',
  handler: async (request) => {
    try {
      const url = new URL(request.url);
      const days = parseInt(url.searchParams.get('days') || '30');

      // Run all queries in parallel
      const [trades, dailySummaries, exitCounts, ruleStats] = await Promise.all([
        // Daily P&L + symbol P&L from trade history
        query(
          `SELECT session_date, symbol, pnl
           FROM TRADE_HISTORY
           WHERE session_date >= DATEADD('day', -?, CURRENT_DATE())`,
          [days]
        ),
        // Daily summaries
        query(
          `SELECT session_date, start_equity, realized_pnl, total_trades,
                  winning_trades, losing_trades, win_rate
           FROM DAILY_SUMMARY
           WHERE session_date >= DATEADD('day', -?, CURRENT_DATE())
           ORDER BY session_date ASC`,
          [days]
        ),
        // Exit distribution
        query(
          `SELECT exit_reason, COUNT(*) as cnt
           FROM TRADE_HISTORY
           WHERE session_date >= DATEADD('day', -?, CURRENT_DATE())
           GROUP BY exit_reason`,
          [days]
        ),
        // Rule performance
        query(
          `SELECT rule_name,
                  COUNT(*) as trades,
                  ROUND(SUM(CASE WHEN pnl > 0 THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0) * 100, 1) as win_rate,
                  ROUND(SUM(pnl), 2) as total_pnl,
                  ROUND(
                    NULLIF(SUM(CASE WHEN pnl > 0 THEN pnl ELSE 0 END), 0) /
                    NULLIF(SUM(CASE WHEN pnl < 0 THEN ABS(pnl) ELSE 0 END), 0)
                  , 2) as profit_factor,
                  ROUND(AVG(pnl) / NULLIF(STDDEV(pnl), 0), 2) as sharpe
           FROM TRADE_HISTORY
           WHERE session_date >= DATEADD('day', -?, CURRENT_DATE())
           GROUP BY rule_name`,
          [days]
        ),
      ]);

      // Daily P&L aggregation
      const dailyMap = {};
      for (const t of trades) {
        const d = t.SESSION_DATE;
        dailyMap[d] = (dailyMap[d] || 0) + (t.PNL || 0);
      }
      const daily_pnl = Object.entries(dailyMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, pnl]) => ({ date, pnl: Math.round(pnl * 100) / 100 }));

      // Symbol P&L aggregation
      const symbolMap = {};
      for (const t of trades) {
        symbolMap[t.SYMBOL] = (symbolMap[t.SYMBOL] || 0) + (t.PNL || 0);
      }
      const symbol_pnl = Object.entries(symbolMap)
        .map(([symbol, pnl]) => ({ symbol, pnl: Math.round(pnl * 100) / 100 }))
        .sort((a, b) => b.pnl - a.pnl);

      // Exit distribution
      const exitColors = {
        TAKE_PROFIT: 'var(--talon-green)',
        STOP_LOSS: 'var(--talon-red)',
        MAX_HOLD: 'var(--talon-yellow)',
        TRAILING_STOP: 'var(--talon-accent)',
      };
      const exit_distribution = exitCounts.map((r) => ({
        name: r.EXIT_REASON,
        value: r.CNT,
        color: exitColors[r.EXIT_REASON] || 'var(--talon-muted)',
      }));

      // Rule performance
      const rule_performance = ruleStats.map((r) => ({
        rule: r.RULE_NAME,
        trades: r.TRADES,
        win_rate: r.WIN_RATE || 0,
        pnl: r.TOTAL_PNL || 0,
        profit_factor: r.PROFIT_FACTOR || 0,
        sharpe: r.SHARPE || 0,
      }));

      // Equity history from daily summaries
      const equity_history = dailySummaries.map((ds) => ({
        date: ds.SESSION_DATE,
        equity: Math.round(((ds.START_EQUITY || 0) + (ds.REALIZED_PNL || 0)) * 100) / 100,
      }));

      // Top-level stats
      const totalPnl = trades.reduce((s, t) => s + (t.PNL || 0), 0);
      const totalTrades = trades.length;
      const wins = trades.filter((t) => (t.PNL || 0) > 0).length;
      const dailyVals = daily_pnl.map((d) => d.pnl);

      return {
        jsonBody: {
          total_pnl: Math.round(totalPnl * 100) / 100,
          total_trades: totalTrades,
          win_rate: totalTrades > 0 ? Math.round((wins / totalTrades) * 1000) / 10 : 0,
          best_day: dailyVals.length > 0 ? Math.max(...dailyVals) : 0,
          worst_day: dailyVals.length > 0 ? Math.min(...dailyVals) : 0,
          daily_pnl,
          symbol_pnl,
          exit_distribution,
          rule_performance,
          equity_history,
        },
      };
    } catch (err) {
      return { status: 500, jsonBody: { error: err.message } };
    }
  },
});
