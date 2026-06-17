/**
 * Build and start the RelocateWise API.
 *
 * Two entry points:
 *   - `buildApp(opts)`  → in-memory repo, used by tests and dev with no
 *                          DATABASE_URL set. Pure function over `opts.cities`.
 *   - `bootstrap(opts)` → production path. If `DATABASE_URL` is set,
 *                          runs migrations + seed once, then starts the
 *                          HTTP server backed by a `PostgresCityRepository`.
 *                          Falls back to the in-memory repo otherwise.
 *
 * Both paths wire:
 *   - `TtlCachedCityRepository` (60s TTL) over the chosen backend
 *   - Fastify + CORS
 *   - 3 routes (Architecture §7)
 *
 * Architecture references: §2, §4 (components), §5.3 (seed), §10.1 (dev).
 */
import Fastify, { type FastifyInstance } from 'fastify';
import type { City } from '@relocatewise/shared';
import { InMemoryCityRepository, type CityRepository } from './db/repository.js';
import { TtlCachedCityRepository } from './db/cache.js';
import { matchRoute } from './routes/match.js';
import { cityRoute } from './routes/city.js';
import { healthRoute } from './routes/health.js';
import { version } from './version.js';

export interface AppOptions {
  cities?: readonly City[];
  /** Optional override for the city repository (e.g. tests, manual DI). */
  repository?: CityRepository;
  /** Logger toggle; default off in tests for clean output. */
  logger?: boolean;
  /** Cache TTL in ms; default 60s per Architecture §5.2. */
  cacheTtlMs?: number;
  /** Override the version string returned by /api/health. */
  version?: string;
}

export interface BuildAppResult {
  app: FastifyInstance;
  repository: CityRepository;
}

/**
 * Build (but do not start) the Fastify app. Always uses the in-memory
 * repo unless `opts.repository` is provided. Tests use this with a
 * `cities` array; production callers use `bootstrap()` instead.
 */
export async function buildApp(opts: AppOptions): Promise<FastifyInstance> {
  const { app } = await buildAppWithRepo(opts);
  return app;
}

export async function buildAppWithRepo(opts: AppOptions): Promise<BuildAppResult> {
  const app = Fastify({
    logger: opts.logger ?? false,
    disableRequestLogging: !(opts.logger ?? false),
  });

  const baseRepo =
    opts.repository ??
    new InMemoryCityRepository(opts.cities ?? []);
  const cachedRepo = new TtlCachedCityRepository(baseRepo, opts.cacheTtlMs);

  await app.register(import('@fastify/cors'), {
    origin: true, // echo origin in dev; tighten in prod via env if needed
    methods: ['GET', 'POST'],
  });

  // Backend rate limit (API_Spec §3.2, ITC-6). Token-bucket at
  // 100 req/min/IP, opt-out via `ENABLE_RATE_LIMIT=0`. Exempt /api/health
  // so liveness probes are never blocked.
  if (process.env.ENABLE_RATE_LIMIT !== '0') {
    await app.register(import('@fastify/rate-limit'), {
      max: 100,
      timeWindow: '1 minute',
      keyGenerator: (req) => req.ip,
      allowList: ['127.0.0.1'],
      skipOnError: true,
    });
  }

  // Shared-secret gate (Architecture §11). When `API_SECRET` is set the
  // server rejects any request without the matching
  // `x-relocatewise-secret` header, except for /api/health which must
  // stay reachable by external liveness probes. Dev / test paths set
  // nothing and get a free pass so the local dev workflow keeps
  // working.
  const expectedSecret = process.env.API_SECRET;
  if (expectedSecret) {
    app.addHook('onRequest', async (req, reply) => {
      if (req.url === '/api/health') return;
      const provided = req.headers['x-relocatewise-secret'];
      if (provided !== expectedSecret) {
        reply.code(401).send({
          error: 'unauthorized',
          message: 'Missing or invalid API secret.',
        });
      }
    });
  }

  healthRoute(app, opts.version ?? version);
  cityRoute(app, cachedRepo, '/api');
  matchRoute(app, cachedRepo, '/api');

  return { app, repository: baseRepo };
}

export interface ServerOptions {
  port?: number;
  host?: string;
  cities?: readonly City[];
  logger?: boolean;
  version?: string;
}

/**
 * Production bootstrap. If `DATABASE_URL` is set, runs migrations + seed
 * and wires the API on top of a `PostgresCityRepository`. Otherwise
 * boots with the in-memory repo seeded from `SEED_CITIES` (handy for
 * local Docker runs where the `db` container hasn't been pulled yet,
 * and for `npm run dev` on a laptop without Postgres).
 */
export async function bootstrap(opts: ServerOptions = {}): Promise<FastifyInstance> {
  if (!process.env.DATABASE_URL) {
    // Lazy import so the test path doesn't pull in 40 city records.
    const { SEED_CITIES } = await import('./db/cities.seed.js');
    return startInMemoryServer({ ...opts, cities: SEED_CITIES });
  }

  const { getPool, closePool } = await import('./db/pool.js');
  const { runMigrations } = await import('./db/migrate.js');
  const { seedIfEmpty } = await import('./db/seed.js');
  const { PostgresCityRepository } = await import('./db/postgres.repository.js');
  const { startScheduler, stopScheduler } = await import('./jobs/scheduler.js');

  const pool = getPool();
  await runMigrations(pool);
  await seedIfEmpty(pool);

  const app = Fastify({
    logger: opts.logger ?? true,
    disableRequestLogging: false,
  });
  const cachedRepo = new TtlCachedCityRepository(new PostgresCityRepository(pool));

  await app.register(import('@fastify/cors'), {
    origin: true,
    methods: ['GET', 'POST'],
  });

  // Backend rate limit (API_Spec §3.2).
  if (process.env.ENABLE_RATE_LIMIT !== '0') {
    await app.register(import('@fastify/rate-limit'), {
      max: 100,
      timeWindow: '1 minute',
      keyGenerator: (req) => req.ip,
      allowList: ['127.0.0.1'],
      skipOnError: true,
    });
  }

  // Shared-secret gate (see buildAppWithRepo above). /api/health is
  // intentionally exempt so external probes still work.
  const expectedSecret = process.env.API_SECRET;
  if (expectedSecret) {
    app.addHook('onRequest', async (req, reply) => {
      if (req.url === '/api/health') return;
      const provided = req.headers['x-relocatewise-secret'];
      if (provided !== expectedSecret) {
        reply.code(401).send({
          error: 'unauthorized',
          message: 'Missing or invalid API secret.',
        });
      }
    });
  }

  healthRoute(app, opts.version ?? version);
  cityRoute(app, cachedRepo, '/api');
  matchRoute(app, cachedRepo, '/api');

  // Ingestion scheduler (Architecture §4.4, PRD FR-16). Honours
  // `INGESTION_DISABLED=1` for dev/test environments.
  if (process.env.INGESTION_DISABLED !== '1') {
    startScheduler(pool);
  }

  app.addHook('onClose', async () => {
    stopScheduler();
    await closePool();
  });

  const port = opts.port ?? Number(process.env.PORT ?? 3000);
  const host = opts.host ?? process.env.HOST ?? '0.0.0.0';
  await app.listen({ port, host });
  return app;
}

async function startInMemoryServer(opts: ServerOptions): Promise<FastifyInstance> {
  const { app } = await buildAppWithRepo({
    cities: opts.cities ?? [],
    logger: opts.logger,
    version: opts.version,
  });
  const port = opts.port ?? Number(process.env.PORT ?? 3000);
  const host = opts.host ?? process.env.HOST ?? '0.0.0.0';
  await app.listen({ port, host });
  return app;
}

/**
 * Backwards-compatible alias kept so older scripts that import
 * `startServer` still work. New code should use `bootstrap()`.
 */
export async function startServer(opts: ServerOptions): Promise<FastifyInstance> {
  return bootstrap(opts);
}

/**
 * CLI entrypoint: `tsx src/server.ts` or `node dist/server.js`.
 *
 * In production the Docker container runs `node dist/server.js`, which
 * goes through this path. In dev, `npm run dev` uses `tsx watch` over
 * the same file, so the watcher reloads on every change.
 */
const invokedDirectly = import.meta.url === `file://${process.argv[1]}`;
if (invokedDirectly) {
  // Import the seed lazily so test imports of this module don't pull
  // in 40 city records they don't need.
  bootstrap().catch((err: unknown) => {
    // eslint-disable-next-line no-console
    console.error('Failed to start API:', err);
    process.exit(1);
  });
}
