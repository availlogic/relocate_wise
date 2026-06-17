/**
 * Tests for the Netlify /api/* proxy function.
 *
 * The proxy is a thin pass-through to `$API_ORIGIN` (Architecture §4.2).
 * These tests mock `globalThis.fetch` to verify the request is constructed
 * correctly and the response is mirrored back. We also exercise the
 * 60s in-memory cache for `GET /api/cities/:slug`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const proxyPromise = import('../functions/proxy.js').then((m) => m.default);

async function loadProxy() {
  return await proxyPromise;
}

function makeResponse(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

const originalFetch = globalThis.fetch;
let fetchMock: ReturnType<typeof vi.fn>;
let testCounter = 0;

beforeEach(() => {
  process.env.API_ORIGIN = 'https://api.example.com';
  fetchMock = vi.fn();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  testCounter += 1;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

function event(overrides: Partial<{
  httpMethod: string;
  path: string;
  rawQuery: string;
  body: string | null;
  headers: Record<string, string | undefined>;
}> = {}) {
  // Each test gets a unique default IP so the rate-limit buckets
  // don't bleed across tests.
  const defaultIp = `192.0.2.${(testCounter % 250) + 1}`;
  const headers = { 'x-forwarded-for': defaultIp, ...(overrides.headers ?? {}) };
  return {
    rawUrl: 'https://example.com' + (overrides.path ?? '/api/cities/lisbon-pt'),
    rawQuery: overrides.rawQuery ?? '',
    path: overrides.path ?? '/api/cities/lisbon-pt',
    httpMethod: overrides.httpMethod ?? 'GET',
    headers,
    multiValueHeaders: {},
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    body: overrides.body ?? null,
    isBase64Encoded: false,
  };
}

describe('Netlify /api/* proxy', () => {
  it('forwards GET /api/cities/:slug to $API_ORIGIN and mirrors the response', async () => {
    const proxy = await loadProxy();
    fetchMock.mockResolvedValueOnce(
      makeResponse(200, { slug: 'lisbon-pt', name: 'Lisbon' }),
    );

    const res = await proxy(event({ path: '/api/cities/lisbon-pt' }));

    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('Lisbon');
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://api.example.com/api/cities/lisbon-pt');
    expect(init).toMatchObject({ method: 'GET' });
  });

  it('forwards POST /api/match with body and the shared secret header', async () => {
    const proxy = await loadProxy();
    process.env.API_SECRET = 'shared-secret-123';
    fetchMock.mockResolvedValueOnce(makeResponse(200, { results: [] }));

    const body = JSON.stringify({ climate: 'temperate' });
    const res = await proxy(
      event({
        httpMethod: 'POST',
        path: '/api/match',
        body,
        headers: { 'content-type': 'application/json' },
      }),
    );

    expect(res.statusCode).toBe(200);
    const [, init] = fetchMock.mock.calls[0]!;
    expect(init).toMatchObject({ method: 'POST' });
    expect((init as RequestInit).body).toBe(body);
    expect((init as RequestInit).headers).toMatchObject({
      'x-relocatewise-secret': 'shared-secret-123',
    });
  });

  it('returns a 502 envelope when the upstream is unreachable', async () => {
    const proxy = await loadProxy();
    fetchMock.mockRejectedValueOnce(new Error('connection refused'));

    const res = await proxy(event({ path: '/api/cities' }));

    expect(res.statusCode).toBe(502);
    expect(res.body).toContain('upstream_unreachable');
    expect(res.body).toContain('connection refused');
  });

  it('mirrors upstream CORS headers when present', async () => {
    const proxy = await loadProxy();
    fetchMock.mockResolvedValueOnce(
      makeResponse(
        200,
        { ok: true },
        {
          'access-control-allow-origin': 'https://relocatewise.example.com',
          'access-control-allow-methods': 'GET, POST',
        },
      ),
    );

    const res = await proxy(event({ path: '/api/cities' }));

    expect(res.headers?.['access-control-allow-origin']).toBe(
      'https://relocatewise.example.com',
    );
    expect(res.headers?.['access-control-allow-methods']).toBe('GET, POST');
  });

  it('passes the query string through to the upstream', async () => {
    const proxy = await loadProxy();
    fetchMock.mockResolvedValueOnce(makeResponse(200, { results: [] }));
    // Use a unique IP to avoid the shared rate-limit bucket.
    const ip = `192.0.2.${Math.floor(Math.random() * 200) + 1}`;
    // Use `/api/match` with a query string: that endpoint is not
    // cacheable so the request always reaches the upstream.
    await proxy(
      event({
        httpMethod: 'POST',
        path: '/api/match',
        rawQuery: 'limit=10',
        body: '{}',
        headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
      }),
    );

    const [url] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://api.example.com/api/match?limit=10');
  });

  it('caches GET /api/cities/:slug and serves the cached response on the second call', async () => {
    const proxy = await loadProxy();
    // Use a unique slug so this test is independent of the module-level
    // cache that earlier tests may have populated.
    const slug = `cache-test-${Math.random().toString(36).slice(2, 8)}`;
    const path = `/api/cities/${slug}`;
    fetchMock.mockResolvedValueOnce(makeResponse(200, { slug, name: 'Cache' }));

    const first = await proxy(event({ path }));
    expect(first.statusCode).toBe(200);
    // First call: upstream was hit.
    expect(fetchMock).toHaveBeenCalledOnce();

    const second = await proxy(event({ path }));
    expect(second.statusCode).toBe(200);
    // Second call: cache served the response, upstream not hit again.
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('caches GET /api/cities (60s TTL) — API_Spec §3.1 v0.3.0', async () => {
    // The module-level cache may already hold an entry for /api/cities
    // from a prior test. Use a unique path marker via the path itself
    // (always the same — /api/cities) and a stub URL. We accept that
    // if the cache is already warm the test asserts HIT, otherwise MISS.
    // Either outcome proves the cache works.
    const proxy = await loadProxy();
    fetchMock.mockResolvedValueOnce(
      makeResponse(200, { cities: [{ slug: 'a' }, { slug: 'b' }] }),
    );

    const first = await proxy(
      event({ path: '/api/cities', headers: { 'x-forwarded-for': '203.0.113.42' } }),
    );
    expect(first.statusCode).toBe(200);
    // Either MISS (cold) or HIT (warm from a prior test) is acceptable.
    expect(['MISS', 'HIT']).toContain(first.headers?.['x-cache']);

    const second = await proxy(
      event({ path: '/api/cities', headers: { 'x-forwarded-for': '203.0.113.42' } }),
    );
    expect(second.statusCode).toBe(200);
    // The second call must be a cache HIT.
    expect(second.headers?.['x-cache']).toBe('HIT');
    // Either 1 or 2 upstream calls total: warm cache = 0, cold = 1.
    expect(fetchMock.mock.calls.length).toBeLessThanOrEqual(2);
  });

  it('returns 429 after 60 requests from the same IP within 10 minutes (API_Spec §3.2, ITC-6)', async () => {
    const proxy = await loadProxy();
    // Each call needs a fresh Response body — clone or build per call.
    fetchMock.mockImplementation(async () => makeResponse(200, { ok: true }));
    // Use a unique IP per test so we start with a clean bucket.
    const ip = `198.51.100.${Math.floor(Math.random() * 200) + 1}`;
    const headers = { 'x-forwarded-for': ip };

    // First 60 calls should pass through.
    for (let i = 0; i < 60; i++) {
      const res = await proxy(event({ path: '/api/health', headers }));
      expect(res.statusCode).toBe(200);
    }

    // 61st call must be 429.
    const blocked = await proxy(event({ path: '/api/health', headers }));
    expect(blocked.statusCode).toBe(429);
    expect(blocked.body).toMatch(/rate_limited/);
    expect(blocked.headers?.['retry-after']).toBeDefined();
  });
});
