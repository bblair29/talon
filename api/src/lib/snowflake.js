import snowflake from 'snowflake-sdk';

// Disable OOB telemetry
snowflake.configure({ logLevel: 'ERROR' });

let pool = null;

function getPool() {
  if (!pool) {
    pool = snowflake.createPool(
      {
        account: process.env.SNOWFLAKE_ACCOUNT,
        username: process.env.SNOWFLAKE_USER,
        password: process.env.SNOWFLAKE_PASSWORD,
        database: process.env.SNOWFLAKE_DATABASE || 'TALON',
        schema: process.env.SNOWFLAKE_SCHEMA || 'TRADING',
        warehouse: process.env.SNOWFLAKE_WAREHOUSE || 'TALON_WH',
      },
      { max: 5, min: 0 }
    );
  }
  return pool;
}

export async function query(sql, binds = []) {
  const pool = getPool();
  return new Promise((resolve, reject) => {
    pool.use(async (clientConnection) => {
      const statement = clientConnection.execute({
        sqlText: sql,
        binds,
        complete: (err, stmt, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        },
      });
    });
  });
}

export async function queryOne(sql, binds = []) {
  const rows = await query(sql, binds);
  return rows.length > 0 ? rows[0] : null;
}
