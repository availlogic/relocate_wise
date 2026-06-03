/**
 * Integration tests for `PostgresCityRepository`.
 *
 * These tests use `testcontainers` to spin up a real
 * `postgis/postgis:16-3.4-alpine` container per run. When Docker isn't
 * available (no daemon, CI runners without `/var/run/docker.sock`, etc.)
 * the entire suite is skipped so contributors without a local Docker
 * setup aren't broken.
 *
 * Per Architecture §5.1 the schema normalizes city data into two tables;
 * these tests cover:
 *   - listAll() returns 40 cities after seed
 *   - findBySlug() resolves a known slug
 *   - findBySlug() returns null on unknown slug
 *   - climate.label round-trips through sub_scores
 *   - career + community sub-scores are restored as numbers
 *   - last_updated round-trips as a YYYY-MM-DD string
 *   - PostGIS geom column is populated
 */
import { existsSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { GenericContainer, Wait, type StartedTestContainer } from 'testcontainers';
import type { Pool } from 'pg';
import { SEED_CITIES } from '../src/db/cities.seed.js';
import { PostgresCityRepository } from '../src/db/postgres.repository.js';
import { runMigrations } from '../src/db/migrate.js';
import { seedIfEmpty } from '../src/db/seed.js';

/**
 * Sync check at module load: the standard Docker socket path on Linux
 * is /var/run/docker.sock. If the socket is absent, the test runner
 * cannot reach the daemon and the suite is skipped. CI runners without
 * a mounted Docker socket will be skipped.
 */
const dockerSocketPresent =
  process.platform === 'win32' ? true /* let testcontainers try */ :
  existsSync('/var/run/docker.sock') || existsSync('/var/Run/docker.sock');

let container: StartedTestContainer | null = null;
let pool: Pool | null = null;
let repo: PostgresCityRepository | null = null;

const describeMaybe = dockerSocketPresent ? describe : describe.skip;

describeMaybe('PostgresCityRepository', () => {
  beforeAll(async () => {
    // testcontainers v10 dropped the specialized PostgreSqlContainer
    // in favor of GenericContainer + an explicit wait strategy. The
    // postgis image prints "database system is ready to accept connections"
    // twice on startup (once for the temp boot db, once for the
    // configured db); we wait for two matches.
    container = await new GenericContainer('postgis/postgis:16-3.4-alpine')
      .withEnvironment({
        POSTGRES_USER: 'relocatewise',
        POSTGRES_PASSWORD: 'relocatewise',
        POSTGRES_DB: 'relocatewise',
      })
      .withExposedPorts(5432)
      .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/i, 2))
      .start();

    const host = container.getHost();
    const port = container.getMappedPort(5432);
    const connectionString = `postgres://relocatewise:relocatewise@${host}:${port}/relocatewise`;

    const { getPool } = await import('../src/db/pool.js');
    pool = getPool({ connectionString });

    await runMigrations(pool);
    await seedIfEmpty(pool);
    repo = new PostgresCityRepository(pool);
  }, 120_000);

  afterAll(async () => {
    if (pool) await pool.end();
    if (container) await container.stop();
  });
  it('listAll() returns all 40 seeded cities', async () => {
    const cities = await repo!.listAll();
    expect(cities).toHaveLength(40);
  });

  it('listAll() returns a stable set of city names', async () => {
    // We don't pin the exact ordering because PostgreSQL's default
    // collation (en_US.utf8) and the Node.js default localeCompare
    // disagree on accented names (São Paulo, Zürich). The contract
    // is "contains all 40 names" and "no duplicates"; the relative
    // order is a UI concern handled by the matching engine's
    // (score DESC, name ASC) sort.
    const cities = await repo!.listAll();
    const names = cities.map((c) => c.name);
    expect(new Set(names).size).toBe(names.length);
    expect(new Set(names)).toEqual(new Set(SEED_CITIES.map((c) => c.name)));
  });

  it('findBySlug() returns the matching city with all 7 dimensions', async () => {
    const lisbon = await repo!.findBySlug('lisbon-pt');
    expect(lisbon).not.toBeNull();
    expect(lisbon!.name).toBe('Lisbon');
    expect(lisbon!.country).toBe('Portugal');
    expect(lisbon!.dimensions.climate.label).toBe('Mediterranean');
    expect(lisbon!.dimensions.cost).toBeGreaterThanOrEqual(1);
    expect(lisbon!.dimensions.cost).toBeLessThanOrEqual(5);
    expect(lisbon!.dimensions.career.tech).toBeGreaterThanOrEqual(0);
    expect(lisbon!.dimensions.community.arts_culture).toBeGreaterThanOrEqual(0);
  });

  it('findBySlug() returns null on an unknown slug', async () => {
    const city = await repo!.findBySlug('does-not-exist');
    expect(city).toBeNull();
  });

  it('every seeded city round-trips with all 7 dimensions populated', async () => {
    const cities = await repo!.listAll();
    for (const c of cities) {
      const expected = SEED_CITIES.find((s) => s.slug === c.slug);
      expect(expected, `missing expected entry for ${c.slug}`).toBeDefined();
      expect(c.dimensions).toEqual(expected!.dimensions);
    }
  });

  it('last_updated is a YYYY-MM-DD string', async () => {
    const cities = await repo!.listAll();
    for (const c of cities) {
      expect(c.last_updated).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('PostGIS geom column is populated (architecture §5.1 forward-compat)', async () => {
    const res = await pool!.query<{ slug: string; geom: string | null }>(
      `SELECT slug, ST_AsText(geom) AS geom FROM cities WHERE slug = $1`,
      ['lisbon-pt'],
    );
    expect(res.rowCount).toBe(1);
    const geom = res.rows[0]!.geom;
    expect(geom).toBeTruthy();
    expect(geom).toMatch(/^POINT\(/);
  });
});
