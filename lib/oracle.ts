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

/**
 * Calls a PL/SQL function that RETURNs a SYS_REFCURSOR, bound as :cursor in
 * `sql` (e.g. `BEGIN :cursor := pkg_x.some_report(:p); END;`). Used for
 * read-only report-shaped queries that live in PL/SQL so a preview can never
 * drift from what the matching posting procedure actually does.
 */
export async function queryCursor<T>(
  sql: string,
  binds: oracledb.BindParameters = {},
): Promise<T[]> {
  const pool = await getPool();
  const conn = await pool.getConnection();
  try {
    const result = await conn.execute<T>(sql, {
      ...binds,
      cursor: { dir: oracledb.BIND_OUT, type: oracledb.CURSOR },
    });
    const cursor = (result.outBinds as { cursor: oracledb.ResultSet<T> }).cursor;
    const rows = await cursor.getRows();
    await cursor.close();
    return rows;
  } finally {
    await conn.close();
  }
}

export async function execute(
  sql: string,
  binds: oracledb.BindParameters = {},
): Promise<number> {
  const pool = await getPool();
  const conn = await pool.getConnection();
  try {
    const result = await conn.execute(sql, binds, { autoCommit: true });
    return result.rowsAffected ?? 0;
  } finally {
    await conn.close();
  }
}

/**
 * Runs several statements on one connection as a single transaction, so a
 * document either lands completely or not at all. Nothing inside autocommits;
 * the commit happens once the callback returns, and any throw rolls the whole
 * lot back.
 */
export type Tx = {
  query: <R>(sql: string, binds?: oracledb.BindParameters) => Promise<R[]>;
  execute: (
    sql: string,
    binds?: oracledb.BindParameters,
  ) => Promise<oracledb.Result<unknown>>;
};

export async function withTransaction<T>(
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  const pool = await getPool();
  const conn = await pool.getConnection();
  try {
    const result = await fn({
      query: async <R>(sql: string, binds: oracledb.BindParameters = {}) => {
        const r = await conn.execute<R>(sql, binds);
        return r.rows ?? [];
      },
      execute: (sql: string, binds: oracledb.BindParameters = {}) =>
        conn.execute(sql, binds),
    });
    await conn.commit();
    return result;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    await conn.close();
  }
}
