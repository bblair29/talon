import snowflake from 'snowflake-sdk';

snowflake.configure({ logLevel: 'ERROR' });

function getConnection() {
  return new Promise((resolve, reject) => {
    const conn = snowflake.createConnection({
      account: process.env.SNOWFLAKE_ACCOUNT,
      username: process.env.SNOWFLAKE_USER,
      password: process.env.SNOWFLAKE_PASSWORD,
      database: process.env.SNOWFLAKE_DATABASE || 'TALON',
      schema: process.env.SNOWFLAKE_SCHEMA || 'TRADING',
      warehouse: process.env.SNOWFLAKE_WAREHOUSE || 'TALON_WH',
    });

    conn.connect((err, conn) => {
      if (err) reject(err);
      else resolve(conn);
    });
  });
}

export async function query(sql, binds = []) {
  const conn = await getConnection();
  return new Promise((resolve, reject) => {
    conn.execute({
      sqlText: sql,
      binds,
      complete: (err, stmt, rows) => {
        conn.destroy();
        if (err) reject(err);
        else resolve(rows || []);
      },
    });
  });
}

export async function queryOne(sql, binds = []) {
  const rows = await query(sql, binds);
  return rows.length > 0 ? rows[0] : null;
}
