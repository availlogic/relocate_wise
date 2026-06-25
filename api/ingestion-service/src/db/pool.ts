/**
 * pg.Pool factory for the ingestion service.
 *
 * The ingestion service connects with the `ingestion_service` role
 * (SELECT on `matching.*`, R/W on `ingestion.*`). Per docs/Database.md
 * §1.4 the DB role rejects any cross-schema write attempt, so this
 * pool cannot accidentally touch `matching.city_scores` even if a
 * future bug tries to. Direct writes from ingestion to the matching
 * schema flow through the matching service's internal PUT endpoint
 * (Phase C).
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

export function getIngestionPool(opts?: PoolOptions): PgPool {
  if (opts) {
    return new Pool({ connectionString: opts.connectionString, max: opts.max ?? 5 });
  }
  if (_pool) return _pool;
  const connectionString = process.env.INGESTION_DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      'INGESTION_DATABASE_URL is not set; cannot construct an ingestion Postgres pool. ' +
        'Use getIngestionPool({ connectionString }) explicitly in tests.',
    );
  }
  _pool = new Pool({ connectionString, max: 5 });
  return _pool;
}

export async function closePool(): Promise<void> {
  if (_pool) {
    const p = _pool;
    _pool = null;
    await p.end();
  }
}