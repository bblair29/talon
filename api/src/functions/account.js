import { app } from '@azure/functions';
import Alpaca from '@alpacahq/alpaca-trade-api';

const alpaca = new Alpaca({
  keyId: process.env.ALPACA_API_KEY,
  secretKey: process.env.ALPACA_SECRET_KEY,
  paper: true,
});

app.http('account', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'account',
  handler: async () => {
    try {
      const account = await alpaca.getAccount();
      return {
        jsonBody: {
          equity: parseFloat(account.equity),
          cash: parseFloat(account.cash),
          buying_power: parseFloat(account.buying_power),
          day_trade_count: parseInt(account.daytrade_count),
          portfolio_value: parseFloat(account.portfolio_value),
          status: account.status,
        },
      };
    } catch (err) {
      return { status: 500, jsonBody: { error: err.message } };
    }
  },
});
