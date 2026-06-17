/**
 * Netlify edge proxy for /api/* (Architecture §4.2).
 *
 * The SPA is served from Netlify CDN. Direct browser → Ubuntu-server
 * calls would expose the Ubuntu API's origin and skip the edge tier
 * (which is where we plan to add caching, redirects, and post-MVP SSR).
 * This function is a thin pass-through:
 *
 *   1. Read `event.path` (always starts with `/api/`).
 *   2. Forward method, body, and selected headers to `$API_ORIGIN`.
 *   3. Cache `GET /api/cities/:slug` and `GET /api/cities` for 60s
 *      in memory (API_Spec §3.1).
 *   4. Enforce a per-IP rate limit of 60 req / 10 min (API_Spec §3.2,
 *      ITC-6). On exceed, return 429.
 *   5. Mirror the response back to the browser.
 *
 * Required env (set in the Netlify UI):
 *   API_ORIGIN   — e.g. https://api.example.com (no trailing slash)
 *   API_SECRET   — shared secret sent in `x-relocatewise-secret`. The
 *                  Ubuntu API is responsible for rejecting calls that
 *                  don't carry it (Architecture §11).
 *
 * The cache + rate limit are intentionally process-local; with ~100
 * cities, 60s TTL, and a 10-min rolling window, this is a 1-2x
 * speedup with bounded memory. Documented as a per-worker
 * limitation in `artifacts/Deployment_Report.md` (the per-worker
 * ceiling means the global cap is N_workers * 60, not 60).
 */
import type { HandlerEvent, HandlerContext, HandlerResponse } from '@netlify/functions';

interface CacheEntry {
  status: number;
  headers: Record<string, string>;
  body: string;
  expiresAt: number;
}

const CACHE_TTL_MS = 60_000;
const cache = new Map<string, CacheEntry>();

const CACHEABLE_PATHS = new Set(['/api/cities']);

const CITY_SLUG_PATTERN = /^\/api\/cities\/([A-Za-z0-9_-]+)$/;

function isCacheable(event: HandlerEvent): string | null {
  if (event.httpMethod !== 'GET') return null;
  const path = (event.path ?? '').replace(/^.*?\/api/, '/api');
  if (CACHEABLE_PATHS.has(path)) return path;
  const m = path.match(CITY_SLUG_PATTERN);
  return m ? path : null;
}

// ---------------------------------------------------------------------------
// In-process per-IP token-bucket rate limiter (API_Spec §3.2)
// ---------------------------------------------------------------------------

const RATE_LIMIT_MAX = 60; // 60 requests
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // per 10 minutes
const RATE_LIMIT_CLEANUP_INTERVAL_MS = 60 * 1000;

interface Bucket {
  /** Sliding-window timestamps of recent requests. */
  timestamps: number[];
  /** Last time we garbage-collected this bucket. */
  lastSweep: number;
}

const buckets = new Map<string, Bucket>();

function getClientIp(event: HandlerEvent): string {
  const xff = event.headers['x-forwarded-for'] ?? event.headers['x-nf-client-connection-ip'];
  if (typeof xff === 'string' && xff.length > 0) {
    return xff.split(',')[0]!.trim();
  }
  return 'unknown';
}

function checkAndConsumeRateLimit(ip: string, now: number): { allowed: boolean; retryAfterMs?: number } {
  let bucket = buckets.get(ip);
  if (!bucket) {
    bucket = { timestamps: [], lastSweep: now };
    buckets.set(ip, bucket);
  }
  // GC: drop timestamps older than the window.
  if (now - bucket.lastSweep > RATE_LIMIT_CLEANUP_INTERVAL_MS) {
    const cutoff = now - RATE_LIMIT_WINDOW_MS;
    bucket.timestamps = bucket.timestamps.filter((t) => t > cutoff);
    bucket.lastSweep = now;
  }
  // Drop expired timestamps from the front of the deque.
  const cutoff = now - RATE_LIMIT_WINDOW_MS;
  while (bucket.timestamps.length > 0 && bucket.timestamps[0]! <= cutoff) {
    bucket.timestamps.shift();
  }
  if (bucket.timestamps.length >= RATE_LIMIT_MAX) {
    const oldest = bucket.timestamps[0]!;
    return { allowed: false, retryAfterMs: oldest + RATE_LIMIT_WINDOW_MS - now };
  }
  bucket.timestamps.push(now);
  return { allowed: true };
}

function readEnv(name: string, fallback?: string): string {
  const v = process.env[name] ?? readNetlifyEnv(name);
  if (v && v.length > 0) return v;
  if (fallback !== undefined) return fallback;
  throw new Error(`Missing required env var: ${name}`);
}

function getSecret(): string {
  return process.env.API_SECRET ?? readNetlifyEnv('API_SECRET') ?? '';
}

function readNetlifyEnv(name: string): string | undefined {
  // `Netlify` is a runtime global exposed by the Netlify platform. It
  // does not exist in unit tests; we treat its absence as "env not set".
  const g = globalThis as { Netlify?: { env?: { get?: (k: string) => string | undefined } } };
  return g.Netlify?.env?.get?.(name);
}

export default async (
  event: HandlerEvent,
  _context?: HandlerContext,
): Promise<HandlerResponse> => {
  const path = (event.path ?? '').replace(/^.*?\/api/, '/api');
  const origin = readEnv('API_ORIGIN').replace(/\/+$/, '');
  const target = `${origin}${path}${event.rawQuery ? `?${event.rawQuery}` : ''}`;
  const secret = getSecret();

  // Per-IP rate limit (API_Spec §3.2, ITC-6). Applied before cache
  // lookup so a flooding client cannot warm the cache.
  const now = Date.now();
  const ip = getClientIp(event);
  const rl = checkAndConsumeRateLimit(ip, now);
  if (!rl.allowed) {
    const retryAfter = Math.ceil((rl.retryAfterMs ?? 0) / 1000);
    return {
      statusCode: 429,
      headers: {
        'content-type': 'application/json',
        'retry-after': String(retryAfter),
      },
      body: JSON.stringify({
        error: 'rate_limited',
        message: 'Too many requests. Try again later.',
      }),
    };
  }

  const cacheKey = isCacheable(event);
  if (cacheKey) {
    const hit = cache.get(cacheKey);
    if (hit && hit.expiresAt > now) {
      return {
        statusCode: hit.status,
        headers: { ...hit.headers, 'x-cache': 'HIT' },
        body: hit.body,
      };
    }
  }

  const headers: Record<string, string> = {
    'content-type': event.headers['content-type'] ?? 'application/json',
    accept: event.headers.accept ?? 'application/json',
  };
  if (secret) headers['x-relocatewise-secret'] = secret;
  if (event.headers['x-forwarded-for']) {
    headers['x-forwarded-for'] = event.headers['x-forwarded-for'];
  }

  let res: Response;
  try {
    res = await fetch(target, {
      method: event.httpMethod,
      headers,
      body: event.body && event.httpMethod !== 'GET' && event.httpMethod !== 'HEAD' ? event.body : undefined,
    });
  } catch (err) {
    return {
      statusCode: 502,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        error: 'upstream_unreachable',
        message: err instanceof Error ? err.message : 'Unknown error',
      }),
    };
  }

  const responseHeaders: Record<string, string> = {
    'content-type': res.headers.get('content-type') ?? 'application/json',
  };
  // Propagate CORS preflight responses verbatim.
  const acao = res.headers.get('access-control-allow-origin');
  if (acao) responseHeaders['access-control-allow-origin'] = acao;
  const acam = res.headers.get('access-control-allow-methods');
  if (acam) responseHeaders['access-control-allow-methods'] = acam;
  const acah = res.headers.get('access-control-allow-headers');
  if (acah) responseHeaders['access-control-allow-headers'] = acah;

  const body = await res.text();

  if (cacheKey && res.ok) {
    cache.set(cacheKey, {
      status: res.status,
      headers: responseHeaders,
      body,
      expiresAt: now + CACHE_TTL_MS,
    });
  }

  return {
    statusCode: res.status,
    headers: { ...responseHeaders, 'x-cache': 'MISS' },
    body,
  };
}
