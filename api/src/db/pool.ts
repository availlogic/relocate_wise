/**
 * pg.Pool factory. Single process-wide pool keyed off `DATABASE_URL`.
 *
 * The pool is created lazily so that unit tests (which never set
 * `DATABASE_URL`) don't open a connection. Tests that want a real DB
 * use `getPool({ connectionString: 'postgres://...' })` directly.
 */
import pg from 'pg';

const { Pool } = pg;
export type PgPool = pg.Pool;

export interface PoolOptions {
  connectionString: string;
  /** Optional: override per-test isolation. */
  max?: number;
}

let _pool: PgPool | null = null;

export function getPool(opts?: PoolOptions): PgPool {
  if (opts) {
    return new Pool({
      connectionString: opts.connectionString,
      max: opts.max ?? 5,
    });
  }
  if (_pool) return _pool;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      'DATABASE_URL is not set; cannot construct a Postgres pool. ' +
        'Use getPool({ connectionString }) explicitly in tests.',
    );
  }
  _pool = new Pool({ connectionString, max: 5 });
  return _pool;
}

/**
 * Close the cached pool. Tests use this in `afterAll`; production
 * never calls it (the process exits cleanly on SIGTERM).
 */
export async function closePool(): Promise<void> {
  if (_pool) {
    const p = _pool;
    _pool = null;
    await p.end();
  }
}
