import { app } from '@azure/functions';

app.http('health', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'health',
  handler: async () => {
    const checks = {
      snowflake_account: process.env.SNOWFLAKE_ACCOUNT ? 'set' : 'missing',
      snowflake_user: process.env.SNOWFLAKE_USER ? 'set' : 'missing',
      snowflake_password: process.env.SNOWFLAKE_PASSWORD ? 'set' : 'missing',
      snowflake_database: process.env.SNOWFLAKE_DATABASE ? 'set' : 'missing',
      snowflake_warehouse: process.env.SNOWFLAKE_WAREHOUSE ? 'set' : 'missing',
      alpaca_key: process.env.ALPACA_API_KEY ? 'set' : 'missing',
    };

    // Test Snowflake connection
    try {
      const { query } = await import('../lib/snowflake.js');
      const rows = await query('SELECT 1 as OK');
      checks.snowflake_connection = 'ok';
      checks.snowflake_result = rows;
    } catch (err) {
      checks.snowflake_connection = 'failed';
      checks.snowflake_error = err.message;
      checks.snowflake_stack = err.stack?.split('\n').slice(0, 5);
    }

    return { jsonBody: checks };
  },
});
