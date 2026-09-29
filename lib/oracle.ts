import "server-only";
import oracledb from "oracledb";

// node-oracledb 6+ runs in thin mode, so no Oracle Instant Client is needed.
oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
oracledb.fetchAsString = [oracledb.CLOB];

// Next's dev server re-evaluates modules on edit, which would leak a new pool
// each time without this.
const globalForOracle = globalThis as unknown as {
  oraclePool?: oracledb.Pool;
};

async function getPool(): Promise<oracledb.Pool> {
  if (!globalForOracle.oraclePool) {
    const { ORACLE_USER, ORACLE_PASSWORD, ORACLE_CONNECT_STRING } = process.env;
    if (!ORACLE_USER || !ORACLE_PASSWORD || !ORACLE_CONNECT_STRING) {
      throw new Error(
        "Oracle credentials missing — set ORACLE_USER, ORACLE_PASSWORD and ORACLE_CONNECT_STRING",
      );
    }
    globalForOracle.oraclePool = await oracledb.createPool({
      user: ORACLE_USER,
      password: ORACLE_PASSWORD,
      connectString: ORACLE_CONNECT_STRING,
      poolMin: 0,
      poolMax: 4,
      poolIncrement: 1,
    });
  }
  return globalForOracle.oraclePool;
}

export async function query<T>(
  sql: string,
  binds: oracledb.BindParameters = {},
): Promise<T[]> {
  const pool = await getPool();
  const conn = await pool.getConnection();
  try {
    const result = await conn.execute<T>(sql, binds);
    return result.rows ?? [];
  } finally {
    await conn.close();
  }
}

export async function execute(
  sql: string,
  binds: oracledb.BindParameters = {},
): Promise<void> {
  const pool = await getPool();
  const conn = await pool.getConnection();
  try {
    await conn.execute(sql, binds, { autoCommit: true });
  } finally {
    await conn.close();
  }
}
