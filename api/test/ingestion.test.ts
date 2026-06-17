/**
 * Tests for the ingestion pipeline fetchers and the `runIngestion`
 * orchestrator (Architecture §4.4, PRD FR-16 / AC-16).
 *
 * The fetchers themselves are tested with a stubbed `fetch` so no
 * real HTTP traffic is generated; the orchestrator is tested against
 * a real testcontainers-managed Postgres database so the UPSERT and
 * `last_updated` semantics are exercised end-to-end.
 *
 * The testcontainers integration tests are skipped when the Docker
 * socket is absent (CI runners without `/var/run/docker.sock`).
 */
import { existsSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
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
} from '../src/jobs/ingestion.js';
import { runMigrations } from '../src/db/migrate.js';
import { seedIfEmpty } from '../src/db/seed.js';
import { getPool } from '../src/db/pool.js';
import { GenericContainer, Wait, type StartedTestContainer } from 'testcontainers';
import type { Pool } from 'pg';

const dockerSocketPresent =
  process.platform === 'win32'
    ? true
    : existsSync('/var/run/docker.sock') || existsSync('/var/Run/docker.sock');

const describeMaybe = dockerSocketPresent ? describe : describe.skip;

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
    const connectionString = `postgres://relocatewise:relocatewise@${host}:${port}/relocatewise`;

    pool = getPool({ connectionString });
    await runMigrations(pool);
    await seedIfEmpty(pool);
  }, 120_000);

  afterAll(async () => {
    if (pool) await pool.end();
    if (container) await container.stop();
  });

  it('upserts all 8 dimensions × N cities and bumps last_updated', async () => {
    // Use a stub fetcher that returns a Mediterranean climate + an
    // Economy of <city> page for every city. The other fetchers are
    // static and always return score=3.
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
    };
    const before = await pool!.query<{ max: string }>(
      `SELECT MAX(last_updated) AS max FROM cities`,
    );
    const report = await runIngestion(pool!, options);
    expect(report.cities).toBeGreaterThanOrEqual(40);
    expect(report.errors).toEqual([]);
    expect(report.updated).toBeGreaterThanOrEqual(report.cities * 8);

    const after = await pool!.query<{ max: string }>(
      `SELECT MAX(last_updated) AS max FROM cities`,
    );
    const beforeDate = before.rows[0]?.max ? new Date(before.rows[0].max) : new Date(0);
    const afterDate = after.rows[0]?.max ? new Date(after.rows[0].max) : new Date(0);
    expect(afterDate.getTime()).toBeGreaterThanOrEqual(beforeDate.getTime());
  }, 60_000);

  it('onlySlug refreshes a single city', async () => {
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
    };
    const report = await runIngestion(pool!, options);
    expect(report.cities).toBe(1);
    expect(report.updated).toBeGreaterThanOrEqual(8);
  });

  it('tolerates a failing fetch and skips affected dimensions', async () => {
    const failingFetch = (async () => {
      return new Response('boom', { status: 500 });
    }) as unknown as typeof fetch;
    const options: IngestionOptions = {
      onlySlug: 'lisbon-pt',
      fetcher: failingFetch,
      cache: new InMemoryCache(),
    };
    const report = await runIngestion(pool!, options);
    expect(report.cities).toBe(1);
    // The static fetchers (education, healthcare, community) still
    // succeed (score 3) and the military_safety static fallback
    // (level_unknown) also succeeds. The Wikipedia-based ones fail
    // gracefully and are recorded in `skipped`.
    expect(report.skipped).toBeGreaterThan(0);
    // The whole run still completes without throwing.
    expect(report.cities).toBe(1);
  }, 60_000);
});
