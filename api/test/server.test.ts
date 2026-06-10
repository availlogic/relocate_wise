/**
 * Integration tests for the Fastify server.
 *
 * Each test:
 *   1. Builds an app with `buildApp({ cities, version, cacheTtlMs })`
 *   2. Sends a synthetic request via `app.inject()` (no real port)
 *   3. Asserts on status code + body shape
 *
 * Coverage per Architecture §7 and Constraints §B:
 *   - GET /api/health → 200 + { ok, version }
 *   - GET /api/cities  → 200 + `{ cities: CitySummary[] }` of 40 cities
 *   - GET /api/cities/:slug → 200 with full City record OR 404 on unknown slug
 *   - POST /api/match  → 200 with MatchResponse (ranked results, ≤ topN)
 *   - POST /api/match  → 400 on missing required fields (Zod rejection)
 *   - POST /api/match  → 400 on wrong type (e.g. climate as number)
 *   - POST /api/match  → deterministic ordering for identical input
 *   - All errors follow `{ error: string, message: string }` envelope
 *   - CORS header on every response
 */
import { describe, it, expect } from 'vitest';
import type { City } from '@relocatewise/shared';
import { buildApp } from '../src/server.js';
import { SEED_CITIES } from '../src/db/cities.seed.js';

const VERSION = 'test-sha-abc123';

async function newApp(cities: readonly City[] = SEED_CITIES) {
  return buildApp({ cities, version: VERSION, cacheTtlMs: 0 });
}

describe('GET /api/health', () => {
  it('returns 200 with { ok: true, version, timestamp }', async () => {
    const app = await newApp();
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.ok).toBe(true);
    expect(body.version).toBe(VERSION);
    expect(typeof body.timestamp).toBe('string');
  });
});

describe('GET /api/cities', () => {
  it('returns 200 with the full city list as { cities: [...] }', async () => {
    const app = await newApp();
    const res = await app.inject({ method: 'GET', url: '/api/cities' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body.cities)).toBe(true);
    expect(body.cities).toHaveLength(SEED_CITIES.length);
    // Every summary must have a slug, name, country, region
    for (const c of body.cities) {
      expect(typeof c.slug).toBe('string');
      expect(typeof c.name).toBe('string');
      expect(typeof c.country).toBe('string');
      expect(typeof c.region).toBe('string');
    }
  });
});

describe('GET /api/cities/:slug', () => {
  it('returns 200 with the full City record for a known slug', async () => {
    const app = await newApp();
    const res = await app.inject({ method: 'GET', url: '/api/cities/lisbon-pt' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.slug).toBe('lisbon-pt');
    expect(body.name).toBe('Lisbon');
    expect(body.country).toBe('Portugal');
    // Full record: nested dimensions
    expect(body.dimensions).toBeDefined();
    expect(body.dimensions.climate).toBeDefined();
    expect(typeof body.dimensions.climate.label).toBe('string');
    expect(typeof body.dimensions.cost).toBe('number');
  });

  it('returns 404 + ApiError envelope for an unknown slug', async () => {
    const app = await newApp();
    const res = await app.inject({ method: 'GET', url: '/api/cities/atlantis-xx' });
    expect(res.statusCode).toBe(404);
    const body = res.json();
    expect(body.error).toBe('city_not_found');
    expect(typeof body.message).toBe('string');
  });
});

describe('POST /api/match', () => {
  // A fully-populated, schema-compliant base profile.
  const baseProfile = {
    climate: 'mediterranean',
    cost_importance: 2,
    cost_ceiling: 3,
    housing_importance: 2,
    housing_ceiling: 3,
    career_industry: 'tech',
    education: 'important',
    healthcare_importance: 2,
    lifestyle_tags: ['urban', 'arts_culture'],
  };

  it('returns 200 with a MatchResponse containing ranked results', async () => {
    const app = await newApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/match',
      payload: baseProfile,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body.results)).toBe(true);
    expect(body.results.length).toBeGreaterThan(0);
    // Every result must have the three required fields per §7.1
    for (const r of body.results) {
      expect(typeof r.city.slug).toBe('string');
      expect(typeof r.score).toBe('number');
      expect(r.score).toBeGreaterThanOrEqual(0);
      expect(r.score).toBeLessThanOrEqual(100);
      expect(typeof r.why).toBe('string');
      expect(r.why.length).toBeGreaterThan(0);
    }
    // Results are sorted by score DESC
    for (let i = 1; i < body.results.length; i++) {
      expect(body.results[i - 1].score).toBeGreaterThanOrEqual(body.results[i].score);
    }
  });

  it('caps result count at 10 (topN default)', async () => {
    const app = await newApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/match',
      payload: baseProfile,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.results.length).toBeLessThanOrEqual(10);
  });

  it('treats all fields as optional and applies defaults for a partial body', async () => {
    const app = await newApp();
    const { cost_importance: _drop, ...missing } = baseProfile;
    const res = await app.inject({
      method: 'POST',
      url: '/api/match',
      payload: missing,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body.results)).toBe(true);
  });

  it('returns 200 for a completely empty body (all defaults applied)', async () => {
    const app = await newApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/match',
      payload: {},
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body.results)).toBe(true);
  });

  it('returns 400 when climate is the wrong type', async () => {
    const app = await newApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/match',
      payload: { ...baseProfile, climate: 42 },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('invalid_profile');
  });

  it('returns 400 on unknown field (strict schema)', async () => {
    const app = await newApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/match',
      payload: { ...baseProfile, not_a_field: 'oops' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('invalid_profile');
  });

  it('produces deterministic ranking: same input → same output', async () => {
    const app = await newApp();
    const a = await app.inject({ method: 'POST', url: '/api/match', payload: baseProfile });
    const b = await app.inject({ method: 'POST', url: '/api/match', payload: baseProfile });
    expect(a.statusCode).toBe(200);
    expect(b.statusCode).toBe(200);
    const slugsA = a.json().results.map((r: { city: { slug: string } }) => r.city.slug);
    const slugsB = b.json().results.map((r: { city: { slug: string } }) => r.city.slug);
    expect(slugsA).toEqual(slugsB);
  });
});

describe('Error envelope contract', () => {
  it('all error responses use { error, message } shape', async () => {
    const app = await newApp();
    const notFound = await app.inject({ method: 'GET', url: '/api/cities/nope-xx' });
    expect(notFound.statusCode).toBe(404);
    const notFoundBody = notFound.json();
    expect(typeof notFoundBody.error).toBe('string');
    expect(typeof notFoundBody.message).toBe('string');

    const badMatch = await app.inject({
      method: 'POST',
      url: '/api/match',
      payload: { totally: 'invalid' },
    });
    expect(badMatch.statusCode).toBe(400);
    const badBody = badMatch.json();
    expect(typeof badBody.error).toBe('string');
    expect(typeof badBody.message).toBe('string');
  });
});

describe('CORS', () => {
  it('responds to preflight OPTIONS with appropriate CORS headers', async () => {
    const app = await newApp();
    const res = await app.inject({
      method: 'OPTIONS',
      url: '/api/cities',
      headers: {
        origin: 'https://example.com',
        'access-control-request-method': 'GET',
      },
    });
    // @fastify/cors echoes the origin
    expect(res.headers['access-control-allow-origin']).toBe('https://example.com');
  });
});

describe('Shared-secret gate (Architecture §11)', () => {
  const originalSecret = process.env.API_SECRET;

  it('rejects /api/cities with 401 when API_SECRET is set and header is missing', async () => {
    process.env.API_SECRET = 'test-secret-abc';
    try {
      const app = await newApp();
      const res = await app.inject({ method: 'GET', url: '/api/cities' });
      expect(res.statusCode).toBe(401);
      const body = res.json();
      expect(body.error).toBe('unauthorized');
    } finally {
      process.env.API_SECRET = originalSecret;
    }
  });

  it('accepts /api/cities when the secret header matches', async () => {
    process.env.API_SECRET = 'test-secret-abc';
    try {
      const app = await newApp();
      const res = await app.inject({
        method: 'GET',
        url: '/api/cities',
        headers: { 'x-relocatewise-secret': 'test-secret-abc' },
      });
      expect(res.statusCode).toBe(200);
    } finally {
      process.env.API_SECRET = originalSecret;
    }
  });

  it('always allows /api/health regardless of the secret', async () => {
    process.env.API_SECRET = 'test-secret-abc';
    try {
      const app = await newApp();
      const res = await app.inject({ method: 'GET', url: '/api/health' });
      expect(res.statusCode).toBe(200);
    } finally {
      process.env.API_SECRET = originalSecret;
    }
  });

  it('is a no-op when API_SECRET is unset (dev workflow)', async () => {
    delete process.env.API_SECRET;
    const app = await newApp();
    const res = await app.inject({ method: 'GET', url: '/api/cities' });
    expect(res.statusCode).toBe(200);
  });
});
