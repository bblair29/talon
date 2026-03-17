import { app } from '@azure/functions';
import Alpaca from '@alpacahq/alpaca-trade-api';

const alpaca = new Alpaca({
  keyId: process.env.ALPACA_API_KEY,
  secretKey: process.env.ALPACA_SECRET_KEY,
  paper: true,
});

app.http('positions', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'positions',
  handler: async () => {
    try {
      const positions = await alpaca.getPositions();
      const mapped = positions.map((p) => ({
        symbol: p.symbol,
        qty: parseFloat(p.qty),
        avg_entry: parseFloat(p.avg_entry_price),
        current_price: parseFloat(p.current_price),
        unrealized_pnl: parseFloat(p.unrealized_pl),
        unrealized_pnl_pct: parseFloat(p.unrealized_plpc) * 100,
        market_value: parseFloat(p.market_value),
      }));
      return { jsonBody: mapped };
    } catch (err) {
      return { status: 500, jsonBody: { error: err.message } };
    }
  },
});
