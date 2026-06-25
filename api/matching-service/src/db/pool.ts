/**
 * pg.Pool factories.
 *
 * Per docs/Architecture.md §5.1 and docs/Database.md §1.4 the database
 * enforces a strict schema segregation: the **matching** service owns
 * the `matching` schema, the **ingestion** service owns the `ingestion`
 * schema, and each service connects through a dedicated PostgreSQL role
 * whose grants are scoped to its schema.
 *
 * Three factories are exposed:
 *
 *   - `getAdminPool()`     — superuser pool. Used by the migration
 *                            runner (CREATE SCHEMA / CREATE ROLE /
 *                            GRANT) and the boot-time seed path. Not
 *                            used by the matching HTTP route handlers
 *                            and not exposed to the request path.
 *   - `getMatchingPool()`  — role-restricted pool for the matching
 *                            service. Read+write on `matching.*`;
 *                            SELECT-only on `ingestion.*` (used by
 *                            the matching service only as part of
 *                            internal observability, never for
 *                            user-facing queries).
 *   - `getIngestionPool()` — role-restricted pool for the ingestion
 *                            service. SELECT-only on `matching.*`;
 *                            read+write on `ingestion.*`.
 *
 * Each factory is cached at most once per process. Tests that want
 * isolation pass an explicit `connectionString` and get a fresh pool.
 *
 * Environment variables:
 *   - `DATABASE_URL`              — superuser connection (legacy alias
 *                                   for `ADMIN_DATABASE_URL`).
 *   - `ADMIN_DATABASE_URL`        — superuser pool URL (preferred).
 *   - `MATCHING_DATABASE_URL`     — `matching_service` connection URL.
 *   - `INGESTION_DATABASE_URL`    — `ingestion_service` connection URL.
 */
import pg from 'pg';

const { Pool } = pg;
export type PgPool = pg.Pool;

export interface PoolOptions {
  connectionString: string;
  /** Optional: override per-test isolation. */
  max?: number;
}

let _adminPool: PgPool | null = null;
let _matchingPool: PgPool | null = null;
let _ingestionPool: PgPool | null = null;

function urlFor(role: 'admin' | 'matching' | 'ingestion'): string | undefined {
  if (role === 'admin') {
    return process.env.ADMIN_DATABASE_URL ?? process.env.DATABASE_URL;
  }
  if (role === 'matching') {
    return process.env.MATCHING_DATABASE_URL ?? process.env.DATABASE_URL;
  }
  return process.env.INGESTION_DATABASE_URL ?? process.env.DATABASE_URL;
}

function explainMissing(role: 'admin' | 'matching' | 'ingestion'): never {
  const env =
    role === 'admin'
      ? 'ADMIN_DATABASE_URL (or DATABASE_URL)'
      : role === 'matching'
      ? 'MATCHING_DATABASE_URL (or DATABASE_URL)'
      : 'INGESTION_DATABASE_URL (or DATABASE_URL)';
  throw new Error(
    `${env} is not set; cannot construct a ${role} Postgres pool. ` +
      `Use get${role.charAt(0).toUpperCase() + role.slice(1)}Pool({ connectionString }) explicitly in tests.`,
  );
}

function buildOrReuse(
  cached: PgPool | null,
  role: 'admin' | 'matching' | 'ingestion',
  opts?: PoolOptions,
): PgPool {
  if (opts) {
    return new Pool({ connectionString: opts.connectionString, max: opts.max ?? 5 });
  }
  if (cached) return cached;
  const connectionString = urlFor(role);
  if (!connectionString) explainMissing(role);
  const pool = new Pool({ connectionString, max: 5 });
  return pool;
}

/** Superuser pool (used for migrations and the boot-time seed). */
export function getAdminPool(opts?: PoolOptions): PgPool {
  _adminPool = buildOrReuse(_adminPool, 'admin', opts);
  return _adminPool;
}

/** Matching service pool — read+write on `matching.*`. */
export function getMatchingPool(opts?: PoolOptions): PgPool {
  _matchingPool = buildOrReuse(_matchingPool, 'matching', opts);
  return _matchingPool;
}

/** Ingestion service pool — SELECT on `matching.*`, R/W on `ingestion.*`. */
export function getIngestionPool(opts?: PoolOptions): PgPool {
  _ingestionPool = buildOrReuse(_ingestionPool, 'ingestion', opts);
  return _ingestionPool;
}

/**
 * Legacy alias kept for backward compatibility with existing callers
 * (the boot path, `runSeedCli`, tests). It returns the **admin** pool
 * because the original `getPool()` was the superuser pool used to run
 * migrations. New code should call `getAdminPool()` /
 * `getMatchingPool()` / `getIngestionPool()` explicitly.
 */
export function getPool(opts?: PoolOptions): PgPool {
  return getAdminPool(opts);
}

/**
 * Close all cached pools. Tests use this in `afterAll`; production
 * never calls it (the process exits cleanly on SIGTERM).
 */
export async function closePool(): Promise<void> {
  const pools = [_adminPool, _matchingPool, _ingestionPool];
  _adminPool = null;
  _matchingPool = null;
  _ingestionPool = null;
  for (const p of pools) {
    if (p) await p.end();
  }
}