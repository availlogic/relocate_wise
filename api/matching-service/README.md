# `@relocatewise/matching-service`

The **matching service** is one of the three Node.js microservices that make up the RelocateWise GA v1.0 release (per `docs/Architecture.md` v1.4.0 §4.4 and §8).

It owns:
- The `matching` PostgreSQL schema (cities + city_scores; defined in `db/migrations/`).
- The public REST surface: `GET /api/health`, `GET /api/cities`, `GET /api/cities/:slug`, `POST /api/match`.
- The **internal sync endpoint** `PUT /api/internal/cities/:slug/scores` — bearer-token gated; only the ingestion service calls it.
- The deterministic 8-dimension matching engine (`src/matching/`).

It does NOT:
- Run the ingestion cron (that lives in `@relocatewise/ingestion-service`).
- Sit on the public ingress (Cloudflare Pages → Cloudflare Tunnel → `@relocatewise/gateway` → matching-service).

## Inputs

| Env var | Required | Purpose |
|---|---|---|
| `MATCHING_DATABASE_URL` | Yes (production) | Connection string for the `matching_service` PostgreSQL role (R/W on `matching.*`). |
| `ADMIN_DATABASE_URL` | Yes (production, for boot) | Superuser pool used to apply migrations + the boot-time seed. |
| `API_SECRET` | Yes (internal route) | Bearer token expected in `Authorization: Bearer <secret>` on `PUT /api/internal/cities/:slug/scores`. When unset the internal route returns 503. |
| `PORT`, `HOST` | No | Defaults: `3000`, `0.0.0.0`. |
| `CORS_ORIGIN` | Production | Comma-separated allow-list for the Fastify CORS plugin. |
| `ENABLE_RATE_LIMIT` | No | Set to `0` to disable the in-process token-bucket (`100 req/min/IP`). |
| `GIT_SHA` | No | Returned by `/api/health`. Falls back to `git rev-parse` then `dev`. |

## Outputs

- HTTP responses matching the documented contracts in `docs/API_Spec.md`:
  - `GET /api/health` → `{ ok, version, timestamp }`
  - `GET /api/cities` → `{ cities: CitySummary[] }`
  - `GET /api/cities/:slug` → `City` (or 404 envelope)
  - `POST /api/match` → `{ results: MatchedCity[], generated_at }`
  - `PUT /api/internal/cities/:slug/scores` → `{ success, message, dimensions }` (or 401/404/400)
- Side effect: writes to `matching.cities.last_updated` and UPSERTs into `matching.city_scores` (the only writes to the `matching` schema in the system).

## Directory layout

```
matching-service/
├── package.json
├── tsconfig.json
├── tsconfig.build.json
├── vitest.config.ts
├── Dockerfile
├── README.md
├── scripts/
│   ├── export-cities-json.ts
│   └── add-landmark-urls.mjs
├── src/
│   ├── server.ts           # buildApp + bootstrap (the Fastify entrypoint)
│   ├── version.ts          # resolved at boot from GIT_SHA / git / 'dev'
│   ├── matching/           # scoring (deterministic, pure)
│   │   ├── defaults.ts
│   │   ├── result.ts
│   │   ├── score.ts
│   │   └── why.ts
│   ├── db/                 # pool + repository + seed + migrate
│   │   ├── cache.ts
│   │   ├── cities.seed.ts  # the canonical 40-city dataset
│   │   ├── migrate.ts
│   │   ├── pool.ts         # getAdminPool / getMatchingPool / getIngestionPool
│   │   ├── postgres.repository.ts
│   │   ├── repository.ts
│   │   └── seed.ts
│   ├── routes/
│   │   ├── city.ts         # GET /api/cities, GET /api/cities/:slug
│   │   ├── health.ts       # GET /api/health
│   │   ├── internal.ts     # PUT /api/internal/cities/:slug/scores (bearer-gated)
│   │   └── match.ts        # POST /api/match
│   └── schemas/
│       ├── internal.ts     # Zod schema for the internal sync body
│       └── profile.ts      # Zod schema for the match profile
└── test/
    ├── server.test.ts
    ├── postgres.repository.test.ts
    ├── roles.test.ts
    ├── internal-put.test.ts
    ├── matching.score.test.ts
    ├── matching.why.test.ts
    ├── landmark_urls.test.ts
    ├── cities.seed-sync.test.ts
    └── fixtures.ts
```

## Setup / test / build

```bash
# Install (from repo root)
npm ci

# Build the shared types first (workspace dep)
npm run -w @relocatewise/shared build

# Typecheck
npm -w @relocatewise/matching-service run typecheck

# Unit + integration tests (the testcontainers tests require Docker)
npm -w @relocatewise/matching-service test

# Build
npm -w @relocatewise/matching-service run build

# Dev (no Postgres; in-memory seed)
INGESTION_DISABLED=1 npm -w @relocatewise/matching-service run dev

# Dev (Postgres via Docker Compose)
docker compose up -d db
ADMIN_DATABASE_URL=postgres://relocatewise:relocatewise@localhost:5432/relocatewise \
MATCHING_DATABASE_URL=postgres://matching_service:matching_service@localhost:5432/relocatewise \
INGESTION_DATABASE_URL=postgres://ingestion_service:ingestion_service@localhost:5432/relocatewise \
API_SECRET=local-dev-secret \
npm -w @relocatewise/matching-service run dev
```

## Known limitations

1. The internal sync endpoint is currently bound to `/api/internal/*` on the matching service. Until `@relocatewise/gateway` is in front of this process, the bearer token is the only line of defence. The gateway refuses to forward `/api/internal/*` from the public ingress (ITC-9 step 3).
2. The pool layer exposes three factories (`getAdminPool`, `getMatchingPool`, `getIngestionPool`) but this service only needs the first two in production. The third is exported so the seeding CLI can refresh `ingestion.*` rows without coupling to the ingestion service.