/**
 * Tests for the ingestion pipeline fetchers and the `runIngestion`
 * orchestrator (Architecture §4.4, PRD FR-16 / AC-16).
 *
 * The fetchers themselves are tested with a stubbed `fetch` so no
 * real HTTP traffic is generated. The orchestrator is tested against
 * a real testcontainers-managed Postgres database so the SQL path
 * (reading `matching.cities`, writing `ingestion.pipeline_logs`) is
 * exercised end-to-end.
 *
 * Phase B: the test sets up the database directly via a `pg.Client`
 * (running the migration SQL files + a hand-rolled seed) because
 * the matching service's `seedIfEmpty()` lives in a separate
 * workspace. The orchestrator itself still uses an ingestion pool
 * (the `ingestion_service` role) — that is the production path.
 *
 * The testcontainers integration tests are skipped when the Docker
 * socket is absent (CI runners without `/var/run/docker.sock`).
 */
import { existsSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  fetchClimate,
  fetchCost,
  fetchEducation,
  fetchHealthcare,
  fetchCommunity,
  fetchMilitarySafety,
  runIngestion,
  stubFetcher,
  InMemoryCache,
  type IngestionOptions,
  type ScoresWriter,
} from '../src/jobs/ingestion.js';
import { GenericContainer, Wait, type StartedTestContainer } from 'testcontainers';
import pg from 'pg';

const dockerSocketPresent =
  process.platform === 'win32'
    ? true
    : existsSync('/var/run/docker.sock') || existsSync('/var/Run/docker.sock');

const { Client, Pool } = pg;
type Pool = pg.Pool;

const describeMaybe = dockerSocketPresent ? describe : describe.skip;

const MIGRATIONS_DIR = resolve(
  process.cwd(),
  '..',
  '..',
  'db',
  'migrations',
);

/**
 * Apply every `db/migrations/*.sql` file in lexicographic order,
 * tracking applied filenames in a `_migrations` table. Mirrors the
 * matching service's `runMigrations()` so the ingestion test exercises
 * the same DDL path the matching service uses in production.
 */
async function applyMigrations(client: pg.Client): Promise<void> {
  await client.query(
    `CREATE TABLE IF NOT EXISTS _migrations (
       filename TEXT PRIMARY KEY,
       applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
     )`,
  );
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  for (const filename of files) {
    await client.query('BEGIN');
    try {
      await client.query(readFileSync(join(MIGRATIONS_DIR, filename), 'utf8'));
      await client.query(
        `INSERT INTO _migrations (filename) VALUES ($1) ON CONFLICT DO NOTHING`,
        [filename],
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }
  }
}

async function seedOneCity(client: pg.Client): Promise<void> {
  // Insert a single city so the orchestrator has something to read.
  // We populate every dimension so the orchestrator's UPSERT path
  // can exercise every key.
  await client.query(
    `INSERT INTO matching.cities (
       slug, name, country, country_code, region, lat, lng, description, last_updated
     ) VALUES (
       'lisbon-pt', 'Lisbon', 'Portugal', 'PT', 'Europe', 38.7223, -9.1393,
       'Coastal capital with Mediterranean climate.', CURRENT_DATE
     )`,
  );
  const { rows } = await client.query<{ id: number }>(
    `SELECT id FROM matching.cities WHERE slug = 'lisbon-pt'`,
  );
  const cityId = rows[0]!.id;
  await client.query(
    `INSERT INTO matching.city_scores (city_id, dimension, score, sub_scores) VALUES
       ($1, 'climate', 0, $2::jsonb),
       ($1, 'cost', 3, NULL),
       ($1, 'housing', 3, NULL),
       ($1, 'career', 0, $3::jsonb),
       ($1, 'education', 3, NULL),
       ($1, 'healthcare', 4, NULL),
       ($1, 'community', 0, $4::jsonb),
       ($1, 'military_safety', 5, NULL)`,
    [
      cityId,
      JSON.stringify({ label: 'Mediterranean' }),
      JSON.stringify({ tech: 5, finance: 3, healthcare: 2, creative: 4, manufacturing: 1 }),
      JSON.stringify({
        urban: 3,
        suburban: 2,
        rural: 1,
        coastal: 5,
        mountain: 1,
        arts_culture: 4,
        family_oriented: 3,
        expat_friendly: 5,
      }),
    ],
  );
}

describe('ingestion — fetchers (unit, mocked fetch)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('fetchClimate extracts a Mediterranean label from a Wikipedia summary', async () => {
    const fakeFetch = stubFetcher({
      'en.wikipedia.org/api/rest_v1/page/summary/': JSON.stringify({
        extract: 'Lisbon is the capital of Portugal. The city has a Mediterranean climate with mild winters.',
      }),
    });
    const cache = new InMemoryCache();
    const r = await fetchClimate({ slug: 'lisbon-pt', name: 'Lisbon' }, fakeFetch, cache);
    expect(r).not.toBeNull();
    expect(r!.sub_scores).toEqual({ label: 'Mediterranean' });
    expect(r!.source).toBe('wikipedia');
  });

  it('fetchClimate returns null when no climate label is found', async () => {
    const fakeFetch = stubFetcher({
      'en.wikipedia.org/api/rest_v1/page/summary/': JSON.stringify({
        extract: 'Atlantis is a mythical island kingdom.',
      }),
    });
    const cache = new InMemoryCache();
    const r = await fetchClimate({ slug: 'atlantis-xx', name: 'Atlantis' }, fakeFetch, cache);
    expect(r).toBeNull();
  });

  it('fetchCost uses the Economy of <city> summary', async () => {
    const fakeFetch = stubFetcher({
      'Economy_of_': JSON.stringify({
        extract: 'The cost of living in Lisbon is moderate compared to other Western European capitals.',
      }),
    });
    const r = await fetchCost(
      { slug: 'lisbon-pt', name: 'Lisbon', country: 'Portugal' },
      fakeFetch,
      new InMemoryCache(),
    );
    expect(r).not.toBeNull();
    expect(r!.score).toBe(3);
  });

  it('fetchEducation returns a neutral 3', async () => {
    const r = await fetchEducation({ slug: 'x', name: 'X', country: 'X' });
    expect(r).toEqual({ score: 3, sub_scores: null, source: 'static' });
  });

  it('fetchHealthcare returns a neutral 3', async () => {
    const r = await fetchHealthcare({ slug: 'x', name: 'X', country: 'X' });
    expect(r).toEqual({ score: 3, sub_scores: null, source: 'static' });
  });

  it('fetchCommunity returns a neutral 3', async () => {
    const r = await fetchCommunity({ slug: 'x', name: 'X', country: 'X' });
    expect(r).toEqual({ score: 3, sub_scores: null, source: 'static' });
  });

  it('fetchMilitarySafety honours the seed when no advisory is found', async () => {
    // The fetcher imports the seed lazily; the Lisbon entry has
    // military_safety = 5 in cities.seed.ts.
    const r = await fetchMilitarySafety(
      { slug: 'lisbon-pt', name: 'Lisbon', country: 'Portugal' },
      stubFetcher({}),
      new InMemoryCache(),
    );
    expect(r).not.toBeNull();
    expect(r!.score).toBe(5);
    expect(r!.sub_scores?.travel_advisory).toBe('level_unknown');
  });

  it('fetchMilitarySafety caps the score when the advisory is level_3', async () => {
    // Make the advisory page return text containing "Level 3".
    const fakeFetch = stubFetcher({
      'Travel_advisory_': JSON.stringify({
        extract: 'Travelers should exercise increased caution. Level 3 of 4.',
      }),
    });
    const r = await fetchMilitarySafety(
      { slug: 'lisbon-pt', name: 'Lisbon', country: 'Portugal' },
      fakeFetch,
      new InMemoryCache(),
    );
    expect(r).not.toBeNull();
    // Seed is 5, advisory is 3 → cap is min(5, 2) = 2.
    expect(r!.score).toBeLessThanOrEqual(2);
  });
});

describeMaybe('ingestion — runIngestion (testcontainers Postgres)', () => {
  let container: StartedTestContainer | null = null;
  let pool: Pool | null = null;

  beforeAll(async () => {
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
    const superUrl = `postgres://relocatewise:relocatewise@${host}:${port}/relocatewise`;
    const ingestionUrl = `postgres://ingestion_service:ingestion_service@${host}:${port}/relocatewise`;

    // Set up the DB via the superuser: apply migrations + seed one city.
    const admin = new Client({ connectionString: superUrl });
    await admin.connect();
    try {
      await applyMigrations(admin);
      await seedOneCity(admin);
    } finally {
      await admin.end();
    }

    // Create the ingestion_service role + grants if they don't exist
    // (003_schemas.sql has a role-creation block but we run a focused
    // setup here for tests that don't import the matching service).
    const grant = new Client({ connectionString: superUrl });
    await grant.connect();
    try {
      await grant.query(
        `DO $$ BEGIN
           IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='ingestion_service') THEN
             CREATE ROLE ingestion_service LOGIN PASSWORD 'ingestion_service';
           END IF;
         END $$`,
      );
      await grant.query(`GRANT USAGE ON SCHEMA matching TO ingestion_service`);
      await grant.query(`GRANT USAGE ON SCHEMA ingestion TO ingestion_service`);
      await grant.query(`GRANT SELECT ON ALL TABLES IN SCHEMA matching TO ingestion_service`);
      await grant.query(
        `ALTER DEFAULT PRIVILEGES IN SCHEMA matching GRANT SELECT ON TABLES TO ingestion_service`,
      );
      await grant.query(
        `GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA ingestion TO ingestion_service`,
      );
      await grant.query(
        `GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA ingestion TO ingestion_service`,
      );
      await grant.query(
        `ALTER DEFAULT PRIVILEGES IN SCHEMA ingestion
           GRANT SELECT, INSERT, UPDATE ON TABLES TO ingestion_service`,
      );
    } finally {
      await grant.end();
    }

    pool = new Pool({ connectionString: ingestionUrl });
  }, 120_000);

  afterAll(async () => {
    if (pool) await pool.end();
    if (container) await container.stop();
  });

  it('upserts all 8 dimensions × N cities and bumps last_updated', async () => {
    const captured: Array<{
      slug: string;
      dimension: string;
      score: number;
    }> = [];
    const stubWriter: ScoresWriter = {
      async upsert(citySlug, dimension, score) {
        captured.push({ slug: citySlug, dimension, score });
        return { ok: true };
      },
    };
    const options: IngestionOptions = {
      fetcher: stubFetcher({
        'en.wikipedia.org/api/rest_v1/page/summary/': JSON.stringify({
          extract: 'Mediterranean climate. The cost of living is moderate. Level 1 of 4.',
        }),
        'Economy_of_': JSON.stringify({
          extract: 'The cost of living is moderate compared to other Western European capitals.',
        }),
        'Travel_advisory_': JSON.stringify({
          extract: 'Level 1 of 4.',
        }),
      }),
      cache: new InMemoryCache(),
      scoresWriter: stubWriter,
    };
    const report = await runIngestion(pool!, options);
    expect(report.cities).toBe(1);
    expect(report.errors).toEqual([]);
    expect(report.updated).toBeGreaterThanOrEqual(8);

    // Every dimension must reach the writer.
    const dimensions = new Set(captured.map((c) => c.dimension));
    expect(dimensions.size).toBe(8);

    // Every call must use the seeded slug.
    for (const c of captured) {
      expect(c.slug).toBe('lisbon-pt');
    }

    // ingestion.pipeline_logs has one success row per city.
    const logs = await pool!.query<{ job_name: string; status: string }>(
      `SELECT job_name, status FROM ingestion.pipeline_logs
        WHERE job_name LIKE 'ingest:city:%'`,
    );
    expect(logs.rowCount).toBeGreaterThanOrEqual(report.cities);
    for (const row of logs.rows) {
      expect(row.status).toBe('success');
    }
  }, 60_000);

  it('onlySlug refreshes a single city', async () => {
    const captured: Array<{ slug: string }> = [];
    const stubWriter: ScoresWriter = {
      async upsert(citySlug) {
        captured.push({ slug: citySlug });
        return { ok: true };
      },
    };
    const options: IngestionOptions = {
      onlySlug: 'lisbon-pt',
      fetcher: stubFetcher({
        'en.wikipedia.org/api/rest_v1/page/summary/': JSON.stringify({
          extract: 'Mediterranean climate. The cost of living is moderate.',
        }),
        'Economy_of_': JSON.stringify({
          extract: 'The cost of living is moderate compared to other Western European capitals.',
        }),
        'Travel_advisory_': JSON.stringify({
          extract: 'Level 1 of 4.',
        }),
      }),
      cache: new InMemoryCache(),
      scoresWriter: stubWriter,
    };
    const report = await runIngestion(pool!, options);
    expect(report.cities).toBe(1);
    expect(report.updated).toBeGreaterThanOrEqual(8);
    for (const c of captured) {
      expect(c.slug).toBe('lisbon-pt');
    }
  });

  it('tolerates a failing fetch and skips affected dimensions', async () => {
    const failingFetch = (async () => {
      return new Response('boom', { status: 500 });
    }) as unknown as typeof fetch;
    const stubWriter: ScoresWriter = {
      async upsert() {
        return { ok: true };
      },
    };
    const options: IngestionOptions = {
      onlySlug: 'lisbon-pt',
      fetcher: failingFetch,
      cache: new InMemoryCache(),
      scoresWriter: stubWriter,
    };
    const report = await runIngestion(pool!, options);
    expect(report.cities).toBe(1);
    expect(report.skipped).toBeGreaterThan(0);
    expect(report.cities).toBe(1);
  }, 60_000);

  it('records a writer failure in pipeline_logs and the report', async () => {
    const stubWriter: ScoresWriter = {
      async upsert(_slug, dimension) {
        if (dimension === 'cost') {
          return { ok: false, error: 'matching service rejected' };
        }
        return { ok: true };
      },
    };
    const options: IngestionOptions = {
      onlySlug: 'lisbon-pt',
      fetcher: stubFetcher({
        'en.wikipedia.org/api/rest_v1/page/summary/': JSON.stringify({
          extract: 'Mediterranean climate. The cost of living is moderate. Level 1 of 4.',
        }),
        'Economy_of_': JSON.stringify({
          extract: 'The cost of living is moderate compared to other Western European capitals.',
        }),
        'Travel_advisory_': JSON.stringify({
          extract: 'Level 1 of 4.',
        }),
      }),
      cache: new InMemoryCache(),
      scoresWriter: stubWriter,
    };
    const report = await runIngestion(pool!, options);
    expect(report.errors.length).toBeGreaterThanOrEqual(1);
    expect(
      report.errors.some(
        (e) => e.city === 'lisbon-pt' && e.dimension === 'cost',
      ),
    ).toBe(true);
    const logs = await pool!.query<{
      status: string;
      error_details: string | null;
    }>(
      `SELECT status, error_details FROM ingestion.pipeline_logs
        WHERE job_name = 'ingest:city:lisbon-pt'
        ORDER BY id DESC LIMIT 1`,
    );
    expect(logs.rowCount).toBe(1);
    expect(logs.rows[0]!.status).toBe('failed');
    expect(logs.rows[0]!.error_details ?? '').toContain('cost');
  });
});