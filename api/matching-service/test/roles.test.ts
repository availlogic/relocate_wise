/**
 * Integration tests for PostgreSQL role-based schema isolation
 * (Architecture §5.1, Database §1.4, ITC-11).
 *
 * Verifies that the role grants created by `db/migrations/003_schemas.sql`
 * enforce the documented boundary:
 *
 *   1. `matching_service` can SELECT/INSERT/UPDATE/DELETE on
 *      `matching.*`; receives `permission denied` on
 *      `ingestion.pipeline_logs`.
 *   2. `ingestion_service` can SELECT on `matching.cities` (so the
 *      ingestion pipeline can read city metadata) and SELECT/INSERT/
 *      UPDATE on `ingestion.pipeline_logs`; receives `permission denied`
 *      on writes to `matching.city_scores`.
 *
 * These tests use `testcontainers` to spin up a fresh
 * `postgis/postgis:16-3.4-alpine` container per run. The whole suite is
 * skipped when the Docker socket is absent (CI runners without
 * `/var/run/docker.sock`). The container is started with
 * `POSTGRES_USER=relocatewise` so the migration can run as the
 * superuser; the test then connects as `matching_service` /
 * `ingestion_service` to assert the role grants.
 */
import { existsSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { GenericContainer, Wait, type StartedTestContainer } from 'testcontainers';
import pg from 'pg';

const dockerSocketPresent =
  process.platform === 'win32'
    ? true /* let testcontainers try */
    : existsSync('/var/run/docker.sock') || existsSync('/var/Run/docker.sock');

const { Pool } = pg;
type Pool = pg.Pool;

const describeMaybe = dockerSocketPresent ? describe : describe.skip;

describeMaybe('DB role isolation (ITC-11)', () => {
  let container: StartedTestContainer | null = null;
  let adminPool: Pool | null = null;
  let matchingPool: Pool | null = null;
  let ingestionPool: Pool | null = null;

  beforeAll(async () => {
    container = await new GenericContainer('postgis/postgis:16-3.4-alpine')
      .withEnvironment({
        POSTGRES_USER: 'relocatewise',
        POSTGRES_PASSWORD: 'relocatewise',
        POSTGRES_DB: 'relocatewise',
      })
      .withExposedPorts(5432)
      .withWaitStrategy(
        Wait.forLogMessage(/database system is ready to accept connections/i, 2),
      )
      .start();

    const host = container.getHost();
    const port = container.getMappedPort(5432);
    const adminUrl = `postgres://relocatewise:relocatewise@${host}:${port}/relocatewise`;
    const matchingUrl = `postgres://matching_service:matching_service@${host}:${port}/relocatewise`;
    const ingestionUrl = `postgres://ingestion_service:ingestion_service@${host}:${port}/relocatewise`;

    adminPool = new Pool({ connectionString: adminUrl });
    matchingPool = new Pool({ connectionString: matchingUrl });
    ingestionPool = new Pool({ connectionString: ingestionUrl });

    const { runMigrations } = await import('../src/db/migrate.js');
    const { seedIfEmpty } = await import('../src/db/seed.js');
    await runMigrations(adminPool);
    await seedIfEmpty(adminPool);
  }, 120_000);

  afterAll(async () => {
    await matchingPool?.end().catch(() => {});
    await ingestionPool?.end().catch(() => {});
    await adminPool?.end().catch(() => {});
    if (container) await container.stop();
  });

  // -------------------------------------------------------------------------
  // matching_service
  // -------------------------------------------------------------------------

  it('matching_service can SELECT from matching.cities', async () => {
    const res = await matchingPool!.query<{ slug: string }>(
      `SELECT slug FROM matching.cities ORDER BY slug ASC LIMIT 1`,
    );
    expect(res.rowCount).toBe(1);
    expect(typeof res.rows[0]!.slug).toBe('string');
  });

  it('matching_service can INSERT / UPDATE matching.city_scores', async () => {
    const idRes = await matchingPool!.query<{ id: number }>(
      `SELECT id FROM matching.cities ORDER BY id ASC LIMIT 1`,
    );
    const cityId = idRes.rows[0]!.id;
    await matchingPool!.query(
      `INSERT INTO matching.city_scores (city_id, dimension, score)
       VALUES ($1, 'cost', 4)
       ON CONFLICT (city_id, dimension) DO UPDATE SET score = EXCLUDED.score`,
      [cityId],
    );
    const res = await matchingPool!.query<{ score: number }>(
      `SELECT score FROM matching.city_scores WHERE city_id = $1 AND dimension = 'cost'`,
      [cityId],
    );
    expect(res.rows[0]!.score).toBe(4);
  });

  it('matching_service cannot INSERT into ingestion.pipeline_logs', async () => {
    await expect(
      matchingPool!.query(
        `INSERT INTO ingestion.pipeline_logs (job_name, status)
         VALUES ('matching-should-not-write-here', 'success')`,
      ),
    ).rejects.toThrow(/permission denied/i);
  });

  // -------------------------------------------------------------------------
  // ingestion_service
  // -------------------------------------------------------------------------

  it('ingestion_service can SELECT from matching.cities', async () => {
    const res = await ingestionPool!.query<{ slug: string }>(
      `SELECT slug FROM matching.cities ORDER BY slug ASC LIMIT 1`,
    );
    expect(res.rowCount).toBe(1);
    expect(typeof res.rows[0]!.slug).toBe('string');
  });

  it('ingestion_service can INSERT and UPDATE ingestion.pipeline_logs', async () => {
    const logRes = await ingestionPool!.query<{ id: number }>(
      `INSERT INTO ingestion.pipeline_logs (job_name, status)
       VALUES ('ingest:test', 'success')
       RETURNING id`,
    );
    const id = logRes.rows[0]!.id;
    expect(typeof id).toBe('number');

    await ingestionPool!.query(
      `UPDATE ingestion.pipeline_logs SET status = 'failed', error_details = $2 WHERE id = $1`,
      [id, 'simulated failure'],
    );

    const after = await ingestionPool!.query<{ status: string }>(
      `SELECT status FROM ingestion.pipeline_logs WHERE id = $1`,
      [id],
    );
    expect(after.rows[0]!.status).toBe('failed');
  });

  it('ingestion_service cannot INSERT into matching.city_scores (ITC-11 step 2)', async () => {
    const idRes = await ingestionPool!.query<{ id: number }>(
      `SELECT id FROM matching.cities ORDER BY id ASC LIMIT 1`,
    );
    const cityId = idRes.rows[0]!.id;
    await expect(
      ingestionPool!.query(
        `INSERT INTO matching.city_scores (city_id, dimension, score)
         VALUES ($1, 'cost', 5)`,
        [cityId],
      ),
    ).rejects.toThrow(/permission denied/i);
  });

  it('ingestion_service cannot UPDATE matching.city_scores', async () => {
    const idRes = await ingestionPool!.query<{ id: number }>(
      `SELECT id FROM matching.cities ORDER BY id ASC LIMIT 1`,
    );
    const cityId = idRes.rows[0]!.id;
    await expect(
      ingestionPool!.query(
        `UPDATE matching.city_scores SET score = 1 WHERE city_id = $1`,
        [cityId],
      ),
    ).rejects.toThrow(/permission denied/i);
  });

  it('ingestion_service cannot DELETE from matching.cities', async () => {
    await expect(
      ingestionPool!.query(`DELETE FROM matching.cities`),
    ).rejects.toThrow(/permission denied/i);
  });
});