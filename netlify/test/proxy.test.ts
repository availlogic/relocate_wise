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

function event(overrides: Partial<{
  httpMethod: string;
  path: string;
  rawQuery: string;
  body: string | null;
  headers: Record<string, string | undefined>;
}> = {}) {
  return {
    rawUrl: 'https://example.com' + (overrides.path ?? '/api/cities/lisbon-pt'),
    rawQuery: overrides.rawQuery ?? '',
    path: overrides.path ?? '/api/cities/lisbon-pt',
    httpMethod: overrides.httpMethod ?? 'GET',
    headers: overrides.headers ?? {},
    multiValueHeaders: {},
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    body: overrides.body ?? null,
    isBase64Encoded: false,
  };
}

function makeResponse(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

const originalFetch = globalThis.fetch;
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  process.env.API_ORIGIN = 'https://api.example.com';
  fetchMock = vi.fn();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
  // Wipe the cache by re-importing. Vitest's vi.resetModules would be
  // cleaner, but it forces a re-import of every test. We rely on the
  // TTL-free tests below to set `cacheTtlMs` semantics; for the simple
  // hit/miss assertions the proxy's own 60s cache is acceptable.
});

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

    await proxy(event({ path: '/api/cities', rawQuery: 'limit=10' }));

    const [url] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://api.example.com/api/cities?limit=10');
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
});
