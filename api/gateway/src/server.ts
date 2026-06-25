/**
 * `@relocatewise/gateway` — the API Gateway / proxy router.
 *
 * Architecture v1.4.0 §4.3:
 *   "Single entry point inside the Docker network. Rates limit
 *    client requests at the network level and proxies public traffic
 *    to the Matching Service. Blocks access to internal
 *    service-to-service communication endpoints (e.g., internal
 *    ingestion update endpoints)."
 *
 * Topology:
 *   Browser → Cloudflare Edge (TLS, WAF) → Cloudflare Tunnel
 *   → `gateway` (this service, port 3000)
 *   → `matching-service` (port 3000, internal Docker network)
 *
 * The gateway is the **only** component that listens on the public
 * ingress. The matching service and the ingestion service are on the
 * internal Docker network only.
 *
 * What this service does:
 *   1. Accepts HTTPS requests on :3000.
 *   2. Applies CORS (`@fastify/cors` with `CORS_ORIGIN` allow-list).
 *   3. Applies an in-process token-bucket rate limit
 *      (`@fastify/rate-limit`, 100 req / minute / IP).
 *   4. **Refuses** any request whose URL starts with `/api/internal/`
 *      and returns a 404 envelope (`error: not_found`) — ITC-9 step 3.
 *   5. Forwards every other `/api/*` request to the matching service
 *      via a streaming HTTP proxy. The matching service stays on the
 *      internal network; this gateway is the only thing that talks to
 *      it from "outside" (from the Cloudflare Tunnel).
 *
 * What this service does NOT do:
 *   - Database access. The gateway is stateless.
 *   - Persistent state of any kind. A restart loses nothing.
 *   - AuthN/AuthZ on the public surface. The matching service's CORS
 *     and (optional) shared-secret gate protect it; Cloudflare Edge
 *     enforces the WAF rate limit and TLS termination.
 *
 * Phase B (v1.0.0 GA, this commit): also enforces a shared-secret
 * check for the public surface when `API_PUBLIC_SECRET` is set. This
 * is belt-and-suspenders — the Cloudflare Tunnel is the primary auth
 * boundary.
 */
import Fastify, { type FastifyInstance } from 'fastify';

export interface GatewayOptions {
  /**
   * Base URL of the matching service (no trailing slash). For
   * local dev this is `http://localhost:3000`; in Docker Compose
   * this is `http://matching:3000`.
   */
  matchingUrl: string;
  /** Optional logger toggle. Default off in tests for clean output. */
  logger?: boolean;
  /**
   * Shared secret for the public surface (the matching service has
   * the same gate when `API_SECRET` is set). When undefined, the
   * gateway does not enforce an additional shared-secret check on
   * the public surface.
   */
  publicSecret?: string;
  /** Override the upstream fetcher (used by tests). */
  fetcher?: typeof fetch;
}

const INTERNAL_PREFIX = '/api/internal/';
const ALLOWED_PREFIXES = ['/api/health', '/api/cities', '/api/match'];

/**
 * Refuse any URL that targets the internal prefix. Returns true when
 * the URL should be blocked. The check is deliberately broad: any
 * path starting with `/api/internal/` is rejected regardless of
 * what's after it. This is the ITC-9 step 3 contract.
 */
function isInternalPath(pathname: string): boolean {
  return pathname.startsWith(INTERNAL_PREFIX);
}

/**
 * The set of public API paths the gateway is willing to forward.
 * Anything outside this set returns 404 from the gateway (not the
 * matching service) so the matching service never has to think
 * about path enumeration.
 */
function isAllowedPath(pathname: string): boolean {
  return ALLOWED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

export interface BuildGatewayResult {
  app: FastifyInstance;
}

/**
 * Build (but do not start) the gateway Fastify app. Used by tests.
 */
export async function buildGateway(opts: GatewayOptions): Promise<FastifyInstance> {
  const app = Fastify({
    logger: opts.logger ?? false,
    disableRequestLogging: !(opts.logger ?? false),
  });
  const fetcher = opts.fetcher ?? fetch;
  const upstream = opts.matchingUrl.replace(/\/+$/, '');

  await app.register(import('@fastify/cors'), {
    origin: process.env.CORS_ORIGIN ?? true,
    methods: ['GET', 'POST'],
  });

  // In-process rate limit (API_Spec §3.2 backend tier). The
  // Cloudflare Edge tier (60 req / 10 min per IP) is configured in
  // the Cloudflare dashboard and is independent.
  if (process.env.ENABLE_RATE_LIMIT !== '0') {
    await app.register(import('@fastify/rate-limit'), {
      max: 100,
      timeWindow: '1 minute',
      keyGenerator: (req) => req.ip,
      allowList: ['127.0.0.1'],
      skipOnError: true,
    });
  }

  // Optional shared-secret gate on the public surface. The matching
  // service has the same hook so this is a belt-and-suspenders layer;
  // Cloudflare Tunnel is the primary authentication boundary.
  if (opts.publicSecret) {
    app.addHook('onRequest', async (req, reply) => {
      // The matching service exempts /api/health; the gateway does too.
      if (req.url === '/api/health') return;
      const provided = req.headers['x-relocatewise-secret'];
      if (provided !== opts.publicSecret) {
        reply.code(401).send({
          error: 'unauthorized',
          message: 'Missing or invalid API secret.',
        });
      }
    });
  }

  // 404 any non-allowed path. This is what makes the gateway
  // "block access to internal service-to-service communication
  // endpoints" (Architecture §4.3) — internal requests never reach
  // the matching service from outside.
  app.setNotFoundHandler((req, reply) => {
    if (isInternalPath(req.url)) {
      // ITC-9 step 3: the gateway must NOT forward /api/internal/*
      // from public ingress. Return 404 so the client can't enumerate
      // whether the path exists.
      return reply.code(404).send({
        error: 'not_found',
        message: 'Not found.',
      });
    }
    return reply.code(404).send({
      error: 'not_found',
      message: 'Not found.',
    });
  });

  // Forward every allowed `/api/*` request to the matching service.
  // `req.url` carries the query string; we route on the path-only
  // part so `/api/cities?limit=5` is matched against `/api/cities`.
  app.route({
    method: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    url: '/api/*',
    handler: async (req, reply) => {
      const path = req.url.split('?', 1)[0] ?? req.url;
      if (isInternalPath(path)) {
        return reply.code(404).send({
          error: 'not_found',
          message: 'Not found.',
        });
      }
      if (!isAllowedPath(path)) {
        return reply.code(404).send({
          error: 'not_found',
          message: 'Not found.',
        });
      }

      const target = `${upstream}${req.url}`;
      const headers: Record<string, string> = {};
      for (const [k, v] of Object.entries(req.headers)) {
        if (v === undefined) continue;
        if (typeof v === 'string') headers[k] = v;
        else if (Array.isArray(v)) headers[k] = v.join(', ');
      }
      // Hop-by-hop headers that must not be forwarded.
      delete headers['host'];
      delete headers['connection'];
      delete headers['content-length'];

      try {
        const init: RequestInit = {
          method: req.method,
          headers,
        };
        if (req.method !== 'GET' && req.method !== 'HEAD' && req.body !== undefined) {
          init.body =
            typeof req.body === 'string' || Buffer.isBuffer(req.body)
              ? req.body
              : JSON.stringify(req.body);
        }
        const upstreamRes = await fetcher(target, init);
        const replyHeaders: Record<string, string> = {};
        upstreamRes.headers.forEach((value, key) => {
          replyHeaders[key] = value;
        });
        reply.code(upstreamRes.status);
        for (const [k, v] of Object.entries(replyHeaders)) {
          reply.header(k, v);
        }
        const text = await upstreamRes.text();
        return reply.send(text);
      } catch (err) {
        req.log.error({ err }, 'gateway upstream error');
        return reply.code(502).send({
          error: 'bad_gateway',
          message: 'Upstream matching service is unreachable.',
        });
      }
    },
  });

  return app;
}

export interface RunGatewayOptions extends GatewayOptions {
  port?: number;
  host?: string;
}

export async function runGateway(opts: RunGatewayOptions): Promise<FastifyInstance> {
  const app = await buildGateway(opts);
  const port = opts.port ?? Number(process.env.PORT ?? 3000);
  const host = opts.host ?? process.env.HOST ?? '0.0.0.0';
  await app.listen({ port, host });
  return app;
}

// Direct CLI entrypoint: `tsx src/server.ts` or `node dist/server.js`.
const invokedDirectly = import.meta.url === `file://${process.argv[1]}`;
if (invokedDirectly) {
  const matchingUrl = process.env.MATCHING_URL ?? 'http://localhost:3000';
  const publicSecret = process.env.API_PUBLIC_SECRET;
  runGateway({ matchingUrl, publicSecret }).catch((err: unknown) => {
    // eslint-disable-next-line no-console
    console.error('Failed to start gateway:', err);
    process.exit(1);
  });
}