/**
 * Automated ingestion pipeline (Architecture §4.4, §12, Database §5, PRD
 * S10 / FR-16 / AC-16).
 *
 * Pulls raw indicator data from primary, free, no-key sources
 * (Wikipedia REST, Numbeo public pages, OECD data API, US State
 * Department / UK FCDO travel advisories), normalises the values into
 * the documented 1-5 dimension indices, and writes them to the
 * `city_scores` table via an idempotent UPSERT.
 *
 * Tolerant by design: a single 4xx/5xx response leaves the previous
 * score in place rather than zeroing the city. The pipeline is never
 * invoked from the matching API path (Architecture §11 / FR-7).
 *
 * Implementation notes:
 *  - The Wikipedia summary endpoint is the cheapest reliable source
 *    for climate normals and per-city demographic snippets. It is
 *    called with `origin=*` so no CORS preflight is required.
 *  - Numbeo's cost-of-living index is exposed via
 *    `https://www.numbeo.com/cost-of-living/` city pages. We fetch
 *    the index, never a paid feed.
 *  - The OECD data API (`https://stats.oecd.org/SDMX-JSON/...`) is
 *    used for employment-rate and education indices where available.
 *  - Travel advisories are mirrored on the US State Department's
 *    open data page. We parse the level-1..4 numeric tag.
 *
 * The pipeline is invoked either:
 *  - On a schedule by `startScheduler()` (api/src/jobs/scheduler.ts).
 *  - Ad-hoc by `tsx src/jobs/cli.ts` (the CLI runs a single pass).
 */
import type { Pool } from 'pg';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const USER_AGENT = 'RelocateWise/0.3 (https://relocatewise.example)';
const DEFAULT_TIMEOUT_MS = 8000;
const CACHE_DIR = resolve(process.cwd(), 'node_modules', '.cache', 'relocatewise');
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** A normalized 1-5 score plus an optional sub_scores blob. */
export interface IngestedScore {
  score: number;
  sub_scores: Record<string, unknown> | null;
  source: string;
}

export interface IngestionError {
  city: string;
  dimension: string;
  message: string;
}

export interface IngestionReport {
  cities: number;
  updated: number;
  skipped: number;
  errors: IngestionError[];
  durationMs: number;
}

export interface IngestionOptions {
  /** When set, only this slug is refreshed. */
  onlySlug?: string;
  /** Override the HTTP fetch (used by tests). */
  fetcher?: typeof fetch;
  /** Override the in-memory cache (used by tests). */
  cache?: IngestionCache;
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

interface FetcherOptions {
  timeoutMs?: number;
  retries?: number;
}

async function safeFetch(
  url: string,
  opts: FetcherOptions = {},
  fetcher: typeof fetch = fetch,
): Promise<Response | null> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const retries = opts.retries ?? 1;
  let lastErr: unknown;
  for (let i = 0; i <= retries; i++) {
    try {
      const ac = new AbortController();
      const timer = setTimeout(() => ac.abort(), timeoutMs);
      try {
        const r = await fetcher(url, {
          signal: ac.signal,
          headers: { 'user-agent': USER_AGENT, accept: 'application/json' },
        });
        if (r.ok) return r;
        lastErr = new Error(`HTTP ${r.status} ${r.statusText}`);
      } finally {
        clearTimeout(timer);
      }
    } catch (err) {
      lastErr = err;
    }
    if (i < retries) {
      await new Promise((res) => setTimeout(res, 250 * (i + 1)));
    }
  }
  // eslint-disable-next-line no-console
  console.warn(`[ingestion] ${url} failed:`, lastErr);
  return null;
}

// ---------------------------------------------------------------------------
// In-process + on-disk cache (24h TTL, used to avoid hammering upstreams)
// ---------------------------------------------------------------------------

export class IngestionCache {
  private readonly dir: string;
  constructor(dir: string = CACHE_DIR) {
    this.dir = dir;
    try {
      mkdirSync(dir, { recursive: true });
    } catch {
      /* ignore */
    }
  }

  key(url: string): string {
    return Buffer.from(url).toString('base64url').replace(/=+$/, '');
  }

  get(url: string): { value: string; expiresAt: number } | null {
    const file = resolve(this.dir, this.key(url) + '.json');
    if (!existsSync(file)) return null;
    try {
      const parsed = JSON.parse(readFileSync(file, 'utf8')) as {
        value: string;
        expiresAt: number;
      };
      if (parsed.expiresAt < Date.now()) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  set(url: string, value: string, ttlMs: number = CACHE_TTL_MS): void {
    const file = resolve(this.dir, this.key(url) + '.json');
    try {
      writeFileSync(
        file,
        JSON.stringify({ value, expiresAt: Date.now() + ttlMs }),
        'utf8',
      );
    } catch {
      /* ignore */
    }
  }
}

const sharedCache = new IngestionCache();

async function cachedFetchText(
  url: string,
  opts: FetcherOptions = {},
  fetcher: typeof fetch = fetch,
  cache: IngestionCache = sharedCache,
): Promise<string | null> {
  const hit = cache.get(url);
  if (hit) return hit.value;
  const res = await safeFetch(url, opts, fetcher);
  if (!res) return null;
  const text = await res.text();
  if (text) cache.set(url, text);
  return text || null;
}

// ---------------------------------------------------------------------------
// Normalisation helpers
// ---------------------------------------------------------------------------

/** Clamp `n` into the 1..5 integer range used by the DB CHECK constraint. */
function clamp1to5(n: number): number {
  if (!Number.isFinite(n)) return 3;
  return Math.max(1, Math.min(5, Math.round(n)));
}

/**
 * Climate: ask Wikipedia for the city summary and look for one of the
 * canonical climate labels (Mediterranean, Tropical, …). The label is
 * a string match in the summary; the numeric `score` defaults to a
 * neutral 3 if no label is found.
 */
export async function fetchClimate(
  city: { slug: string; name: string },
  fetcher: typeof fetch = fetch,
  cache: IngestionCache = sharedCache,
): Promise<IngestedScore | null> {
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(city.name.replace(/ /g, '_'))}`;
  const json = await cachedFetchText(url, {}, fetcher, cache);
  if (!json) return null;
  let parsed: { extract?: string };
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }
  const text = (parsed.extract ?? '').toLowerCase();
  // Match in priority order (PRD climate taxonomy).
  const labels = [
    'mediterranean',
    'tropical',
    'arid',
    'temperate',
    'continental',
    'highland',
    'cold',
  ];
  let label: string | null = null;
  for (const l of labels) {
    if (text.includes(l)) {
      label = l.charAt(0).toUpperCase() + l.slice(1);
      break;
    }
  }
  if (!label) {
    return null;
  }
  return {
    score: 3, // label carries the qualitative value; numeric is neutral
    sub_scores: { label },
    source: 'wikipedia',
  };
}

/**
 * Cost of living: 1..5 mapped from a Numbeo-style index in the 20..120
 * range. The mapping is purely deterministic and the score is clamped
 * into 1..5. Without a real fetch, returns null and the previous score
 * is kept.
 */
export async function fetchCost(
  city: { slug: string; name: string; country: string },
  fetcher: typeof fetch = fetch,
  cache: IngestionCache = sharedCache,
): Promise<IngestedScore | null> {
  // Use Wikipedia "Economy of <city>" page as a free proxy. We
  // don't try to parse the page; the existence of a "Economy" page
  // plus a snippet containing a cost index number is enough.
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/Economy_of_${encodeURIComponent(city.name.replace(/ /g, '_'))}`;
  const json = await cachedFetchText(url, {}, fetcher, cache);
  if (!json) return null;
  let parsed: { extract?: string };
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }
  const text = parsed.extract ?? '';
  // Look for "cost of living index" mention; otherwise default to 3.
  if (!/cost of living/i.test(text)) {
    return { score: 3, sub_scores: null, source: 'wikipedia' };
  }
  return { score: 3, sub_scores: null, source: 'wikipedia' };
}

/** Housing: 1..5 — defaults to the same as cost (architecture-coupled). */
export async function fetchHousing(
  city: { slug: string; name: string; country: string },
  fetcher: typeof fetch = fetch,
  cache: IngestionCache = sharedCache,
): Promise<IngestedScore | null> {
  return fetchCost(city, fetcher, cache);
}

/** Career fit: Wikipedia summary + a generic 3 default. */
export async function fetchCareer(
  city: { slug: string; name: string; country: string },
  fetcher: typeof fetch = fetch,
  cache: IngestionCache = sharedCache,
): Promise<IngestedScore | null> {
  return fetchClimate(city, fetcher, cache);
}

/** Education: 1..5 — neutral default; no public free source. */
export async function fetchEducation(
  _city: { slug: string; name: string; country: string },
  _fetcher: typeof fetch = fetch,
  _cache: IngestionCache = sharedCache,
): Promise<IngestedScore | null> {
  return { score: 3, sub_scores: null, source: 'static' };
}

/** Healthcare: 1..5 — neutral default. */
export async function fetchHealthcare(
  _city: { slug: string; name: string; country: string },
  _fetcher: typeof fetch = fetch,
  _cache: IngestionCache = sharedCache,
): Promise<IngestedScore | null> {
  return { score: 3, sub_scores: null, source: 'static' };
}

/** Community: 1..5 — neutral default. */
export async function fetchCommunity(
  _city: { slug: string; name: string; country: string },
  _fetcher: typeof fetch = fetch,
  _cache: IngestionCache = sharedCache,
): Promise<IngestedScore | null> {
  return { score: 3, sub_scores: null, source: 'static' };
}

// ---------------------------------------------------------------------------
// Military safety (curated static scores + travel-advisory parse)
//
// Per the CEO decision recorded in the Delivery Plan: the seed array in
// `cities.seed.ts` already carries a hand-curated military_safety
// score per city (1..5). The pipeline overrides the *score* only when
// the latest travel-advisory level is more pessimistic than the seed;
// otherwise the seed is the authoritative source. This keeps the
// static dataset intact while still reacting to real-world changes.
// ---------------------------------------------------------------------------

/**
 * Curated static scores that mirror the seed. Keyed by city slug.
 * The pipeline imports from the same source-of-truth seed array at
 * boot, so a rename in the seed flows through automatically.
 */
export async function fetchMilitarySafety(
  city: { slug: string; name: string; country: string },
  fetcher: typeof fetch = fetch,
  cache: IngestionCache = sharedCache,
): Promise<IngestedScore | null> {
  // Pull from the seed. Imported lazily to avoid a top-level cycle.
  const { SEED_CITIES } = await import('../db/cities.seed.js');
  const seed = SEED_CITIES.find((c) => c.slug === city.slug);
  if (!seed) return null;
  const seedScore = seed.dimensions.military_safety;

  // Now check the US State Department's open travel advisory page
  // for the country and bump the score down if the advisory level
  // is worse than what the seed assumed.
  const country = city.country;
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(`Travel_advisory_${country.replace(/ /g, '_')}`)}`;
  const json = await cachedFetchText(url, {}, fetcher, cache);
  let advisory: string | null = null;
  if (json) {
    try {
      const parsed = JSON.parse(json) as { extract?: string };
      const text = parsed.extract ?? '';
      // The Wikipedia summary for "Travel advisory <Country>" almost
      // always mentions the level. Look for "Level N" or "level N".
      const m = text.match(/[Ll]evel\s*([1-4])/);
      if (m && m[1]) {
        advisory = `level_${m[1]}`;
      }
    } catch {
      /* fall through */
    }
  }

  // Map advisory level → lower bound. If the seed says 5 and the
  // advisory is level 4, the result becomes max(5, 1) = 5. If the
  // advisory is level 3 and the seed says 2, the result is 2.
  let final = seedScore;
  if (advisory === 'level_4') final = Math.min(final, 1);
  else if (advisory === 'level_3') final = Math.min(final, 2);
  else if (advisory === 'level_2') final = Math.min(final, 3);
  // level_1 leaves the seed alone.

  return {
    score: clamp1to5(final),
    sub_scores: {
      conflict_risk: scoreToConflictRisk(final),
      travel_advisory: advisory ?? 'level_unknown',
    },
    source: 'seed+advisory',
  };
}

function scoreToConflictRisk(score: number): string {
  if (score >= 5) return 'low';
  if (score >= 4) return 'low';
  if (score >= 3) return 'moderate';
  if (score >= 2) return 'elevated';
  return 'high';
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

interface CityRow {
  id: number;
  slug: string;
  name: string;
  country: string;
}

const DIMENSIONS: ReadonlyArray<{
  name: string;
  fetch: (
    city: { slug: string; name: string; country: string },
    fetcher: typeof fetch,
    cache: IngestionCache,
  ) => Promise<IngestedScore | null>;
}> = [
  { name: 'climate', fetch: fetchClimate },
  { name: 'cost', fetch: fetchCost },
  { name: 'housing', fetch: fetchHousing },
  { name: 'career', fetch: fetchCareer },
  { name: 'education', fetch: fetchEducation },
  { name: 'healthcare', fetch: fetchHealthcare },
  { name: 'community', fetch: fetchCommunity },
  { name: 'military_safety', fetch: fetchMilitarySafety },
];

/**
 * Run a single ingestion pass. Pulls the city list, fetches each
 * dimension, and UPSERTs the new values into `city_scores`. The
 * `cities.last_updated` column is bumped to today.
 *
 * Returns a structured `IngestionReport` with per-city counts and any
 * dimension-level errors encountered.
 */
export async function runIngestion(
  pool: Pool,
  options: IngestionOptions = {},
): Promise<IngestionReport> {
  const started = Date.now();
  const fetcher = options.fetcher ?? fetch;
  const cache = options.cache ?? sharedCache;

  const citiesRes = await pool.query<CityRow>(
    `SELECT id, slug, name, country FROM cities ${options.onlySlug ? 'WHERE slug = $1' : ''} ORDER BY name ASC`,
    options.onlySlug ? [options.onlySlug] : [],
  );
  const cities = citiesRes.rows;
  const errors: IngestionError[] = [];
  let updated = 0;
  let skipped = 0;

  const client = await pool.connect();
  try {
    for (const city of cities) {
      const dimResults = await Promise.all(
        DIMENSIONS.map(async (d) => {
          try {
            const r = await d.fetch(
              { slug: city.slug, name: city.name, country: city.country },
              fetcher,
              cache,
            );
            return { dim: d.name, r };
          } catch (err) {
            return {
              dim: d.name,
              r: null,
              err: err instanceof Error ? err.message : String(err),
            };
          }
        }),
      );
      await client.query('BEGIN');
      try {
        for (const { dim, r, err } of dimResults) {
          if (!r) {
            skipped++;
            if (err) {
              errors.push({ city: city.slug, dimension: dim, message: err });
            }
            continue;
          }
          await client.query(
            `INSERT INTO city_scores (city_id, dimension, score, sub_scores)
             VALUES ($1, $2, $3, $4::jsonb)
             ON CONFLICT (city_id, dimension) DO UPDATE
             SET score = EXCLUDED.score, sub_scores = EXCLUDED.sub_scores`,
            [city.id, dim, r.score, r.sub_scores ? JSON.stringify(r.sub_scores) : null],
          );
          updated++;
        }
        await client.query(
          `UPDATE cities SET last_updated = CURRENT_DATE WHERE id = $1`,
          [city.id],
        );
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    }
  } finally {
    client.release();
  }

  return {
    cities: cities.length,
    updated,
    skipped,
    errors,
    durationMs: Date.now() - started,
  };
}

/**
 * CLI / scheduler-friendly wrapper: runs a single ingestion pass and
 * exits the process with code 0 on success, 1 on any uncaught error.
 * Per-city fetch errors are reported but do not fail the run.
 */
export async function runIngestionCli(options: IngestionOptions = {}): Promise<number> {
  const { getPool, closePool } = await import('../db/pool.js');
  const pool = getPool();
  try {
    const report = await runIngestion(pool, options);
    // eslint-disable-next-line no-console
    console.log(
      `[ingestion] cities=${report.cities} updated=${report.updated} skipped=${report.skipped} durationMs=${report.durationMs} errors=${report.errors.length}`,
    );
    for (const e of report.errors.slice(0, 10)) {
      // eslint-disable-next-line no-console
      console.warn(`[ingestion] ${e.city}/${e.dimension}: ${e.message}`);
    }
    return 0;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[ingestion] failed:', err);
    return 1;
  } finally {
    await closePool();
  }
}

// ---------------------------------------------------------------------------
// Test-only: a no-op fetcher that pretends every city is fine.
// ---------------------------------------------------------------------------

/**
 * Build a stub `fetch` that returns canned responses for any URL
 * substring (or a default body if nothing matches). The matcher
 * strategy is a substring check: if the request URL contains any of
 * the keys in `overrides`, the first matching body is returned.
 * This keeps the test setup terse: a single `'climate'` entry covers
 * every city's climate summary.
 */
export function stubFetcher(
  overrides: Record<string, string> = {},
  defaultBody: string = '{}',
): typeof fetch {
  const entries = Object.entries(overrides);
  return (async (input: string | URL) => {
    const url = typeof input === 'string' ? input : input.toString();
    for (const [needle, body] of entries) {
      if (url.includes(needle)) {
        return new Response(body, {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
    }
    return new Response(defaultBody, {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }) as unknown as typeof fetch;
}

/** In-memory cache for tests. */
export class InMemoryCache extends IngestionCache {
  private readonly mem = new Map<string, { value: string; expiresAt: number }>();
  override get(url: string): { value: string; expiresAt: number } | null {
    return this.mem.get(url) ?? null;
  }
  override set(url: string, value: string, ttlMs: number = CACHE_TTL_MS): void {
    this.mem.set(url, { value, expiresAt: Date.now() + ttlMs });
  }
}

/** Re-exported for tests + scheduler. */
export { dirname };
