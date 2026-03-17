import { app } from '@azure/functions';
import { query } from '../lib/snowflake.js';

app.http('trades', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'trades',
  handler: async (request) => {
    try {
      const url = new URL(request.url);
      const days = parseInt(url.searchParams.get('days') || '30');

      const rows = await query(
        `SELECT id, session_date, symbol, rule_name, side, qty,
                entry_price, exit_price, entry_time, exit_time,
                exit_reason, pnl, pnl_pct
         FROM TRADE_HISTORY
         WHERE session_date >= DATEADD('day', -?, CURRENT_DATE())
         ORDER BY exit_time DESC`,
        [days]
      );

      const trades = rows.map((r) => ({
        id: r.ID,
        session_date: r.SESSION_DATE,
        symbol: r.SYMBOL,
        rule_name: r.RULE_NAME,
        side: r.SIDE,
        qty: r.QTY,
        entry_price: r.ENTRY_PRICE,
        exit_price: r.EXIT_PRICE,
        entry_time: r.ENTRY_TIME,
        exit_time: r.EXIT_TIME,
        exit_reason: r.EXIT_REASON,
        pnl: r.PNL,
        pnl_pct: r.PNL_PCT,
      }));

      return { jsonBody: trades };
    } catch (err) {
      return { status: 500, jsonBody: { error: err.message } };
    }
  },
});
