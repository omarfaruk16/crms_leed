import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;

// Store money as integer cents end-to-end, but BIGINT comes back as a string
// from node-postgres. Parse the columns we know are safe (< 2^53) into numbers.
pg.types.setTypeParser(20, (v) => (v === null ? null : parseInt(v, 10))); // int8/BIGINT

// A single shared pool. Tuned for a busy CRM: keep a healthy number of warm
// connections, recycle idle ones, and fail fast if the DB is unreachable.
export const pool = new Pool(
  process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL }
    : {
        host: process.env.PGHOST || 'localhost',
        port: Number(process.env.PGPORT || 5432),
        database: process.env.PGDATABASE || 'sky_root_crm',
        user: process.env.PGUSER || 'postgres',
        password: process.env.PGPASSWORD || undefined,
      }
);

Object.assign(pool.options, {
  max: Number(process.env.PG_POOL_MAX || 20),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

pool.on('error', (err) => {
  // Don't crash the process if an idle backend dies; just log it.
  console.error('[pg] idle client error:', err.message);
});

// Thin query helper with optional slow-query logging.
export async function query(text, params) {
  const start = Date.now();
  const res = await pool.query(text, params);
  const ms = Date.now() - start;
  if (ms > 200) console.warn(`[pg] slow query ${ms}ms: ${text.slice(0, 80)}`);
  return res;
}

// Run a function inside a transaction with a dedicated client.
export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
