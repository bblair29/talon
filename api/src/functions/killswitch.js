import { app } from '@azure/functions';
import Alpaca from '@alpacahq/alpaca-trade-api';

const alpaca = new Alpaca({
  keyId: process.env.ALPACA_API_KEY,
  secretKey: process.env.ALPACA_SECRET_KEY,
  paper: true,
});

app.http('killswitch', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'killswitch',
  handler: async () => {
    try {
      await alpaca.cancelAllOrders();
      await alpaca.closeAllPositions({ cancel_orders: true });
      return {
        jsonBody: { status: 'ok', message: 'Kill switch activated — all orders cancelled, all positions closed' },
      };
    } catch (err) {
      return { status: 500, jsonBody: { error: err.message } };
    }
  },
});
