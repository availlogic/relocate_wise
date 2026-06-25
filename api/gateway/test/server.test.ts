/**
 * Tests for `@relocatewise/gateway` (Architecture §4.3, ITC-9).
 *
 * The gateway is a thin proxy + path filter. The tests use
 * `app.inject()` (no real port) and stub the upstream fetcher so
 * the suite runs in-process and deterministically.
 *
 * Coverage:
 *   - Public routes (`/api/health`, `/api/cities`, `/api/match`)
 *     are forwarded with the correct method, body, and Authorization
 *     passthrough.
 *   - Internal routes (`/api/internal/...`) are refused with a 404
 *     from the gateway and never reach the upstream (ITC-9 step 3).
 *   - Disallowed public paths (e.g. `/api/admin`) return 404 from
 *     the gateway.
 *   - The shared-secret gate on the public surface returns 401 when
 *     the bearer is missing/wrong and forwards when correct.
 *   - 502 on upstream network failures.
 */
import { describe, expect, it } from 'vitest';
import { buildGateway, type GatewayOptions } from '../src/server.js';

interface CapturedCall {
  url: string;
  init: RequestInit | undefined;
}

function makeCapturingFetcher(
  overrides: Record<string, { status?: number; body?: string }> = {},
): {
  fetcher: typeof fetch;
  captured: CapturedCall[];
} {
  const captured: CapturedCall[] = [];
  const fetcher: typeof fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input.toString();
    captured.push({ url, init });
    for (const [needle, override] of Object.entries(overrides)) {
      if (url.includes(needle)) {
        return new Response(override.body ?? '{}', {
          status: override.status ?? 200,
          headers: { 'content-type': 'application/json' },
        });
      }
    }
    return new Response('{}', {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
  return { fetcher, captured };
}

async function newGateway(
  opts: Partial<GatewayOptions> = {},
): Promise<{ app: Awaited<ReturnType<typeof buildGateway>>; captured: CapturedCall[] }> {
  const { fetcher, captured } = makeCapturingFetcher();
  const app = await buildGateway({
    matchingUrl: 'http://matching.internal',
    fetcher,
    publicSecret: undefined,
    ...opts,
  });
  return { app, captured };
}

describe('@relocatewise/gateway', () => {
  it('forwards GET /api/health to the matching service', async () => {
    const { app, captured } = await newGateway();
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    expect(captured).toHaveLength(1);
    expect(captured[0]!.url).toBe('http://matching.internal/api/health');
    expect(captured[0]!.init?.method).toBe('GET');
  });

  it('forwards GET /api/cities with query string', async () => {
    const { app, captured } = await newGateway();
    const res = await app.inject({
      method: 'GET',
      url: '/api/cities?limit=5',
    });
    expect(res.statusCode).toBe(200);
    expect(captured[0]!.url).toBe('http://matching.internal/api/cities?limit=5');
  });

  it('forwards POST /api/match with the request body intact', async () => {
    const { app, captured } = await newGateway();
    const body = { climate: 'mediterranean' };
    const res = await app.inject({
      method: 'POST',
      url: '/api/match',
      payload: body,
    });
    expect(res.statusCode).toBe(200);
    expect(captured).toHaveLength(1);
    expect(captured[0]!.init?.method).toBe('POST');
    expect(captured[0]!.init?.body).toBe(JSON.stringify(body));
  });

  it('forwards GET /api/cities/:slug', async () => {
    const { app, captured } = await newGateway();
    const res = await app.inject({
      method: 'GET',
      url: '/api/cities/lisbon-pt',
    });
    expect(res.statusCode).toBe(200);
    expect(captured[0]!.url).toBe('http://matching.internal/api/cities/lisbon-pt');
  });

  // -------------------------------------------------------------------------
  // Internal sync endpoint blocking (ITC-9 step 3)
  // -------------------------------------------------------------------------

  it('refuses GET /api/internal/cities/lisbon-pt/scores with 404', async () => {
    const { app, captured } = await newGateway();
    const res = await app.inject({
      method: 'GET',
      url: '/api/internal/cities/lisbon-pt/scores',
    });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({
      error: 'not_found',
      message: 'Not found.',
    });
    expect(captured).toHaveLength(0); // never reached the upstream
  });

  it('refuses PUT /api/internal/cities/lisbon-pt/scores with 404 (ITC-9 step 3)', async () => {
    const { app, captured } = await newGateway();
    const res = await app.inject({
      method: 'PUT',
      url: '/api/internal/cities/lisbon-pt/scores',
      payload: { dimensions: { cost: 3 } },
    });
    expect(res.statusCode).toBe(404);
    expect(captured).toHaveLength(0);
  });

  it('refuses POST /api/internal/anything with 404', async () => {
    const { app, captured } = await newGateway();
    const res = await app.inject({
      method: 'POST',
      url: '/api/internal/admin/reset',
      payload: {},
    });
    expect(res.statusCode).toBe(404);
    expect(captured).toHaveLength(0);
  });

  it('refuses any unknown /api/* path with 404', async () => {
    const { app, captured } = await newGateway();
    const res = await app.inject({ method: 'GET', url: '/api/admin' });
    expect(res.statusCode).toBe(404);
    expect(captured).toHaveLength(0);
  });

  // -------------------------------------------------------------------------
  // Shared-secret gate on the public surface
  // -------------------------------------------------------------------------

  it('returns 401 on the public surface when shared-secret is set and missing', async () => {
    const { fetcher, captured } = makeCapturingFetcher();
    const app = await buildGateway({
      matchingUrl: 'http://matching.internal',
      fetcher,
      publicSecret: 'shhh',
    });
    const res = await app.inject({ method: 'GET', url: '/api/cities' });
    expect(res.statusCode).toBe(401);
    expect(res.json().error).toBe('unauthorized');
    expect(captured).toHaveLength(0);
  });

  it('returns 401 when the shared-secret is wrong', async () => {
    const { fetcher, captured } = makeCapturingFetcher();
    const app = await buildGateway({
      matchingUrl: 'http://matching.internal',
      fetcher,
      publicSecret: 'shhh',
    });
    const res = await app.inject({
      method: 'GET',
      url: '/api/cities',
      headers: { 'x-relocatewise-secret': 'wrong' },
    });
    expect(res.statusCode).toBe(401);
    expect(captured).toHaveLength(0);
  });

  it('forwards /api/cities when the shared-secret matches', async () => {
    const { fetcher, captured } = makeCapturingFetcher();
    const app = await buildGateway({
      matchingUrl: 'http://matching.internal',
      fetcher,
      publicSecret: 'shhh',
    });
    const res = await app.inject({
      method: 'GET',
      url: '/api/cities',
      headers: { 'x-relocatewise-secret': 'shhh' },
    });
    expect(res.statusCode).toBe(200);
    expect(captured).toHaveLength(1);
  });

  it('exempts /api/health from the shared-secret gate (liveness)', async () => {
    const { fetcher, captured } = makeCapturingFetcher();
    const app = await buildGateway({
      matchingUrl: 'http://matching.internal',
      fetcher,
      publicSecret: 'shhh',
    });
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    expect(captured).toHaveLength(1);
  });

  // -------------------------------------------------------------------------
  // Upstream error path
  // -------------------------------------------------------------------------

  it('returns 502 when the upstream matching service is unreachable', async () => {
    const failingFetcher: typeof fetch = async () => {
      throw new Error('ECONNREFUSED');
    };
    const app = await buildGateway({
      matchingUrl: 'http://matching.internal',
      fetcher: failingFetcher,
    });
    const res = await app.inject({ method: 'GET', url: '/api/cities' });
    expect(res.statusCode).toBe(502);
    expect(res.json().error).toBe('bad_gateway');
  });

  it('forwards upstream status codes (e.g. 404 from matching service)', async () => {
    const { fetcher, captured } = makeCapturingFetcher({
      'api/cities/does-not-exist': { status: 404, body: '{"error":"city_not_found"}' },
    });
    const app = await buildGateway({
      matchingUrl: 'http://matching.internal',
      fetcher,
    });
    const res = await app.inject({
      method: 'GET',
      url: '/api/cities/does-not-exist',
    });
    expect(res.statusCode).toBe(404);
    expect(res.body).toBe('{"error":"city_not_found"}');
    expect(captured).toHaveLength(1);
  });

  it('strips hop-by-hop headers from the forwarded request', async () => {
    const { fetcher, captured } = makeCapturingFetcher();
    const app = await buildGateway({
      matchingUrl: 'http://matching.internal',
      fetcher,
    });
    const res = await app.inject({ method: 'GET', url: '/api/cities' });
    expect(res.statusCode).toBe(200);
    const forwardedHeaders = captured[0]!.init?.headers as Record<string, string>;
    expect(forwardedHeaders['host']).toBeUndefined();
    expect(forwardedHeaders['connection']).toBeUndefined();
    expect(forwardedHeaders['content-length']).toBeUndefined();
  });
});