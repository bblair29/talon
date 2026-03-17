import snowflake from 'snowflake-sdk';

try {
  snowflake.configure({ logLevel: 'ERROR' });
} catch {
  // Older SDK versions may not support string log levels
}

function getConnection() {
  return new Promise((resolve, reject) => {
    const conn = snowflake.createConnection({
      account: process.env.SNOWFLAKE_ACCOUNT || '',
      username: process.env.SNOWFLAKE_USER || '',
      password: process.env.SNOWFLAKE_PASSWORD || '',
      database: process.env.SNOWFLAKE_DATABASE || 'TALON',
      schema: process.env.SNOWFLAKE_SCHEMA || 'TRADING',
      warehouse: process.env.SNOWFLAKE_WAREHOUSE || 'TALON_WH',
    });

    conn.connect((err) => {
      if (err) reject(new Error(`Snowflake connection failed: ${err.message}`));
      else resolve(conn);
    });
  });
}

export async function query(sql, binds = []) {
  let conn;
  try {
    conn = await getConnection();
    return await new Promise((resolve, reject) => {
      conn.execute({
        sqlText: sql,
        binds,
        complete: (err, stmt, rows) => {
          if (err) reject(new Error(`Snowflake query failed: ${err.message}`));
          else resolve(rows || []);
        },
      });
    });
  } finally {
    if (conn) {
      try { conn.destroy(); } catch {}
    }
  }
}

export async function queryOne(sql, binds = []) {
  const rows = await query(sql, binds);
  return rows.length > 0 ? rows[0] : null;
}
