/**
 * Tests for the API client wrapper (`src/api.ts`).
 *
 * These tests exercise the network surface that drives every page of the
 * app. We mock `globalThis.fetch` rather than going through a real
 * network so the suite stays fast and deterministic.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  API_BASE,
  ApiError,
  getCity,
  getHealth,
  listCities,
  postMatch,
} from '../src/api';
import type { UserProfile } from '@relocatewise/shared';

const SAMPLE_PROFILE: UserProfile = {
  climate: 'temperate',
  cost_importance: 2,
  cost_ceiling: 3,
  housing_importance: 0,
  housing_ceiling: null,
  career_industry: 'tech',
  education: 'important',
  healthcare_importance: 1,
  lifestyle_tags: ['urban'],
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('api client', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('exposes an empty API base by default (relative URLs)', () => {
    // import.meta.env has no VITE_API_BASE in tests, so URLs are
    // relative and rely on the Vite dev proxy (web/vite.config.ts) or
    // the Netlify function (netlify/functions/proxy.ts) to forward.
    expect(API_BASE).toBe('');
  });

  it('GET /api/health returns parsed JSON', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse({ ok: true, version: '1.0.0', timestamp: '2026-06-02T00:00:00Z' }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const res = await getHealth();

    expect(res).toEqual({
      ok: true,
      version: '1.0.0',
      timestamp: '2026-06-02T00:00:00Z',
    });
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('/api/health');
    // `fetch` defaults method to 'GET' when none is passed, so we don't
    // assert on it. We do assert the headers we set ourselves.
    expect(init).toMatchObject({
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    });
  });

  it('GET /api/cities calls the correct URL and parses the list', async () => {
    const sample = [
      {
        slug: 'auckland',
        name: 'Auckland',
        country: 'New Zealand',
        country_code: 'NZ',
        region: 'Oceania',
        lat: -36.84,
        lng: 174.74,
        description: 'A harbor city with great food.',
      },
    ];
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({ cities: sample }));
    vi.stubGlobal('fetch', fetchMock);

    const res = await listCities();

    expect(res.cities).toEqual(sample);
    expect(fetchMock.mock.calls[0]![0]).toBe('/api/cities');
  });

  it('GET /api/cities/:slug URL-encodes the slug', async () => {
    const city = {
      slug: 'sao paulo',
      name: 'São Paulo',
      country: 'Brazil',
      country_code: 'BR',
      region: 'South America',
      lat: -23.55,
      lng: -46.63,
      description: 'Vibrant and huge.',
      last_updated: '2026-05-15',
      dimensions: {
        climate: { label: 'Tropical' },
        cost: 3,
        housing: 4,
        career: {
          tech: 4, finance: 4, healthcare: 3, creative: 3, manufacturing: 4,
        },
        education: 4,
        healthcare: 4,
        community: {
          urban: 5, suburban: 3, coastal: 1, mountain: 1,
          arts_culture: 4, family_oriented: 3, expat_friendly: 3,
        },
      },
    };
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(city));
    vi.stubGlobal('fetch', fetchMock);

    const res = await getCity('sao paulo');

    expect(res.name).toBe('São Paulo');
    expect(fetchMock.mock.calls[0]![0]).toBe(
      '/api/cities/sao%20paulo',
    );
  });

  it('POST /api/match serializes the profile and parses the response', async () => {
    const sample = {
      results: [
        {
          city: {
            slug: 'lisbon', name: 'Lisbon', country: 'Portugal',
            country_code: 'PT', region: 'Europe',
            lat: 38.72, lng: -9.14,
            description: 'Sunny Atlantic coast.',
            dimensions: {
              climate: { label: 'Mediterranean' },
              cost: 2, housing: 2,
              career: { tech: 3, finance: 2, healthcare: 3, creative: 3, manufacturing: 2 },
              education: 3, healthcare: 4,
              community: {
                urban: 4, suburban: 3, coastal: 5, mountain: 1,
                arts_culture: 5, family_oriented: 3, expat_friendly: 5,
              },
            },
            last_updated: '2026-05-15',
          },
          score: 88,
          why: 'Strong overall fit.',
        },
      ],
      generated_at: '2026-06-02T00:00:00Z',
    };
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(sample));
    vi.stubGlobal('fetch', fetchMock);

    const res = await postMatch(SAMPLE_PROFILE);

    expect(res.results[0]!.city.slug).toBe('lisbon');
    expect(res.results[0]!.score).toBe(88);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('/api/match');
    expect(init).toMatchObject({ method: 'POST' });
    const reqInit = init as RequestInit;
    expect(reqInit.body).toBe(JSON.stringify(SAMPLE_PROFILE));
  });

  it('throws ApiError with the server message on a 4xx', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse({ error: 'validation_error', message: 'field X is required' }, 422),
    );
    vi.stubGlobal('fetch', fetchMock);

    let caught: unknown;
    try {
      await postMatch(SAMPLE_PROFILE);
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(ApiError);
    const e = caught as ApiError;
    expect(e.status).toBe(422);
    expect(e.envelope).toEqual({
      error: 'validation_error',
      message: 'field X is required',
    });
    expect(e.message).toBe('field X is required');
  });

  it('falls back to a network_error envelope when the body is not JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce(
        new Response('upstream timed out', { status: 504, statusText: 'Gateway Timeout' }),
      ),
    );

    await expect(getHealth()).rejects.toMatchObject({
      status: 504,
      envelope: { error: 'network_error', message: 'Gateway Timeout' },
    });
  });
});
