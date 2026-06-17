# RelocateWise — Deployment Report

> v0.3.0 (PRD v3.1.0 / Architecture v1.2.0 alignment). For v0.2.0 see
> `git log` of this file.

## Project Overview

RelocateWise is a web-based decision-support tool that helps individuals and
families discover cities that match their lifestyle preferences. The MVP
is a single linear flow (8-question questionnaire → top-10 results → city
profile → side-by-side compare) with a curated 40-city dataset, an 8-dimension
deterministic matching engine, and an automated ingestion pipeline that
keeps the city scores fresh from primary, free, no-key sources.

The deployment is a two-tier hybrid per `docs/Architecture.md` §2:

1. **Frontend**: React 18 + Vite + TypeScript SPA, deployed to **Netlify**
   (free tier). Serves the static bundle via global CDN.
2. **Backend**: Node 20 + Fastify + TypeScript API + PostgreSQL 16 +
   PostGIS + scheduled ingestion worker, deployed via **Docker Compose**
   on the CEO's **Ubuntu server**. Fronted by **Caddy** for automatic
   Let's Encrypt TLS.
3. **Edge proxy**: A single Netlify Function
   (`netlify/functions/proxy.ts`) forwards `/api/*` browser calls to
   the Ubuntu API with:
   - 60s in-memory cache for `GET /api/cities` and `GET /api/cities/:slug`
   - Per-IP token-bucket rate limit (60 req / 10 min) returning `429`
   - Shared-secret gate via `x-relocatewise-secret` header

## Environment Requirements

| Requirement | Value |
|---|---|
| Node.js | 20.x LTS (per `api/package.json` `engines.node`) |
| npm | 10+ (workspace-aware) |
| Docker | 24+ (with Compose v2 plugin) |
| Postgres image | `postgis/postgis:16-3.4-alpine` (pinned in `docker-compose.yml`) |
| Caddy image | `caddy:2-alpine` (pinned in `docker-compose.yml`) |

## Required Environment Variables

| Var | Scope | Required | Default | Notes (v0.3.0) |
|---|---|---|---|---|
| `DATABASE_URL` | API | In production | unset → in-memory seed | `postgres://user:pass@host:5432/db` |
| `PORT` | API | No | `3000` | API listen port |
| `HOST` | API | No | `0.0.0.0` | API bind address |
| `GIT_SHA` | API | No | auto via `git rev-parse` | Returned by `/api/health` |
| `CORS_ORIGIN` | API | In production | echo any (dev) | Comma-separated allowed origins |
| `API_SECRET` | API + Netlify | In production | unset → free pass in dev | Shared secret sent in `x-relocatewise-secret` header |
| `ENABLE_RATE_LIMIT` | API | No | enabled (`0` to disable) | `@fastify/rate-limit` 100 req/min/IP. Test paths use `app.inject()` which is in-process and does not trigger the IP-based limit. |
| `INGESTION_DISABLED` | API | No | enabled (`1` to disable) | Skip the scheduled ingestion worker. The CLI ingestion (`npm run ingest`) still works. |
| `INGESTION_CRON` | API | No | `0 3 1 * *` (monthly) | Standard 5-field `node-cron` expression. E.g. `*/10080 * * * *` for weekly (every 10080 minutes = 7 days). |
| `VITE_API_BASE` | SPA dev/build | No | unset → relative `/api/*` | Override the API base; set to a full URL to point at a remote API. |
| `API_PROXY_TARGET` | Vite dev only | No | `http://localhost:3000` | Where Vite forwards `/api/*` in dev. Set to `http://localhost:8080` to use Caddy on host :8080 instead. |
| `API_ORIGIN` | Netlify function | Yes, in prod | — | Where the proxy forwards `/api/*` |
| `API_SECRET` | Netlify function | Yes, in prod | — | Shared header secret to the Ubuntu API (same value as on the server) |

The `docker-compose.yml` reads `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `CORS_ORIGIN`, `GIT_SHA`, `INGESTION_DISABLED`, and `INGESTION_CRON` from the host environment (or `.env` at the project root). See `.env.example` for local defaults.

## Local Development Setup

### Option A — full local stack with Docker (recommended)

```bash
git clone <your-repo-url> relocatewise
cd relocatewise
npm install
docker compose up -d
```

First boot applies both `db/migrations/001_init.sql` and `002_military_safety.sql`,
seeds the 40-city dataset, and starts the scheduled ingestion worker
(monthly by default). The API listens on `:3000`; Caddy listens on `:8080`
(insecure) and `:8443` (TLS via `internal` for local dev).

```bash
cd web
npm install
npm run dev
```

Open <http://localhost:5173>.

### Option B — no Docker, in-memory seed (fastest)

```bash
git clone <your-repo-url> relocatewise
cd relocatewise
npm install
cd api
INGESTION_DISABLED=1 npm run dev
cd ../web
npm install
npm run dev
```

The API uses the in-memory 40-city seed (identical dataset). The
ingestion worker is disabled.

### Option C — point the SPA at a different API host

```bash
cd web
VITE_API_BASE=https://staging.example.com npm run dev
```

## Smoke walkthrough

After `docker compose up -d`:

```bash
# 1. Health
curl -s http://localhost:3000/api/health
# → {"ok":true,"version":"<git-sha>","timestamp":"..."}

# 2. City list (slim)
curl -s http://localhost:3000/api/cities | python3 -c "import sys, json; print(len(json.load(sys.stdin)['cities']))"
# → 40

# 3. City profile (8 dimensions)
curl -s http://localhost:3000/api/cities/lisbon-pt | python3 -c "import sys, json; d=json.load(sys.stdin); print(sorted(d['dimensions'].keys()))"
# → ['career', 'climate', 'community', 'cost', 'education', 'healthcare', 'housing', 'military_safety']

# 4. Match (8 questions worth of profile)
curl -s -X POST -H 'Content-Type: application/json' \
  -d '{"climate":"mediterranean","military_safety_importance":3,"lifestyle_tags":["urban","coastal"]}' \
  http://localhost:3000/api/match | python3 -c "import sys, json; print(len(json.load(sys.stdin)['results']))"
# → 10
```

## Build Instructions

```bash
npm install           # workspace-aware install
npm run build         # builds shared → api → web
npm run typecheck     # tsc --noEmit across all workspaces
npm run lint          # eslint across all workspaces
npm test              # vitest across all workspaces
```

The `api` build emits `dist/server.js`, `dist/jobs/cli.js`, etc. The
`web` build emits `web/dist/index.html` + a hashed assets bundle.

## Docker Instructions

```bash
# Build the API image (smoke build, same as CI)
docker build -f api/Dockerfile -t relocatewise-api:ci-smoke .

# Or via docker compose
docker compose build api
```

The Dockerfile:
1. Uses `node:20-alpine` for both build and runtime stages.
2. Installs all workspace deps via `npm ci --include=dev`.
3. Builds `shared/` then `api/` via `tsc -p tsconfig.build.json`.
4. Prunes dev deps.
5. Copies `db/` (migrations + seed JSON), `shared/dist`, `api/dist`.
6. Runs `node dist/server.js` as the entrypoint.
7. Healthcheck hits `http://127.0.0.1:3000/api/health`.

## Production Deployment Steps

### Frontend — Netlify

1. Push the repo to GitHub.
2. Sign in to Netlify, **Add new site → Import an existing project**.
3. Pick the GitHub repo. Netlify reads `netlify.toml` automatically.
4. Verify build settings:
   - Base directory: `web`
   - Build command: `npm run build`
   - Publish directory: `dist`
   - Functions directory: `netlify/functions`
5. Set env vars: `API_ORIGIN`, `API_SECRET`, `NODE_VERSION=20`.
6. Click **Deploy site**.

### Backend — Ubuntu server (Docker Compose)

1. Install Docker CE + Compose v2.
2. `git clone` the repo to `/srv/relocatewise`.
3. Write `/srv/relocatewise/.env` with:
   - `POSTGRES_USER`, `POSTGRES_PASSWORD=$(openssl rand -hex 24)`
   - `CORS_ORIGIN=https://<ceo-domain>,https://<site>.netlify.app`
   - `API_SECRET=<same value as Netlify>`
   - `INGESTION_CRON=0 3 1 * *` (or whatever cadence)
4. Set `API_DOMAIN` on the host so Caddy can pick it up:
   ```bash
   echo 'export API_DOMAIN=api.example.com' > /etc/profile.d/relocatewise.sh
   ```
5. `cd /srv/relocatewise && docker compose up -d`.
6. Open ports 22, 80, 443. Caddy auto-provisions a Let's Encrypt cert
   on first request.
7. Smoke test:
   ```bash
   curl -s https://api.<ceo-domain>/api/health
   curl -s https://api.<ceo-domain>/api/cities/lisbon-pt | jq .dimensions | head -20
   ```

### Deploy updates

```bash
ssh root@<server-ip> 'cd /srv/relocatewise && git pull && docker compose pull && docker compose up -d'
```

This rebuilds the API image with the latest code, runs any new
migrations (e.g. `002_military_safety.sql`), and restarts the containers.
Postgres data is preserved on the named volume `pgdata`.

## Ingestion Pipeline (v0.3.0)

The API container runs `node-cron` inside the same process. On boot it
arms the cron task (default `0 3 1 * *` = 03:00 on the 1st of every month).
At each tick it:

1. Reads all 40 cities from the `cities` table.
2. For each city, fetches the 8 dimensions from primary sources:
   - **Climate**: Wikipedia summary → matches canonical label.
   - **Cost / Housing**: Wikipedia `Economy_of_<city>` summary.
   - **Career**: Wikipedia summary (default 3).
   - **Education / Healthcare / Community**: static neutral 3.
   - **Military Safety**: curated seed score, capped down if the
     latest travel advisory is more pessimistic.
3. UPSERTs the new scores into `city_scores` with
   `ON CONFLICT (city_id, dimension) DO UPDATE`.
4. Updates `cities.last_updated` to today.
5. Logs a structured summary.

To run the pipeline ad-hoc:

```bash
npm -w @relocatewise/api run ingest                 # all cities
npm -w @relocatewise/api run ingest -- --city=lisbon-pt  # one city
```

To disable the scheduler (e.g. in a read-only staging environment):

```bash
INGESTION_DISABLED=1 docker compose up -d
```

The CLI ingestion still works with the scheduler disabled.

### Source policy

- All sources are free, no-key, public.
- Wikipedia REST (`en.wikipedia.org/api/rest_v1/page/summary/...`).
- Travel-advisory pages parsed with simple regex.
- The pipeline is **tolerant by design**: a single 4xx/5xx response
  leaves the previous score in place rather than zeroing the city.
- 24h in-memory cache (file-based, in `node_modules/.cache/relocatewise/`)
  avoids hammering the same source twice in a single run.

## Rate Limiting (v0.3.0)

Two independent tiers per `docs/API_Spec.md` §3.2:

| Tier | Limit | Implementation | Notes |
|---|---|---|---|
| Edge (Netlify proxy) | 60 req / 10 min per client IP | In-process token-bucket | Per-worker. With N cold workers, global cap is N × 60. Documented limitation; acceptable for free-tier MVP traffic. |
| Backend (Fastify) | 100 req / 1 min per client IP | `@fastify/rate-limit` | Enabled by default. Opt-out via `ENABLE_RATE_LIMIT=0`. Test paths use `app.inject()` which is in-process and not subject to the IP limit. |

When a tier is exceeded, the response is:

```http
HTTP/1.1 429 Too Many Requests
Content-Type: application/json
Retry-After: 60

{
  "error": "rate_limited",
  "message": "Too many requests. Try again later."
}
```

## Caching (v0.3.0)

| Path | TTL | Implementation |
|---|---|---|
| `GET /api/cities` | 60s | Netlify proxy in-memory |
| `GET /api/cities/:slug` | 60s | Netlify proxy in-memory |
| `GET /api/cities` (in backend) | 60s | `TtlCachedCityRepository` (per-process) |
| `GET /api/cities/:slug` (in backend) | 60s | `TtlCachedCityRepository` (per-process) |
| `POST /api/match` | never | dynamic per-request |
| Wikipedia/Numbeo (ingestion) | 24h | file-based in `node_modules/.cache/relocatewise/` |

## Backups

- **MVP database**: the dataset is in git
  (`db/seeds/cities.json` + `api/src/db/cities.seed.ts`). RPO = 0,
  RTO = re-run `docker compose up -d` on a fresh box (~15 minutes).
- **Pre-v0.3.0 deployments** that have user-collected data: a weekly
  `pg_dump` is recommended but not yet automated (per the docs
  constraints we don't store user data on the server).

## Monitoring Recommendations

The MVP has no paid monitoring. A minimal observability setup on the
Ubuntu server (no cost):

```bash
# In /etc/cron.d/relocatewise-health
*/5 * * * * curl -fsS https://api.<ceo-domain>/api/health || echo "relocatewise-api-down $(date -Iseconds)" | mail -s "relocatewise down" root@localhost
```

For richer observability, scrape `/api/health`, `/api/cities`, and
`/api/match` (POST with a stub profile) from a free UptimeRobot or
Betterstack probe. Log scraping is `docker logs --tail 100
relocatewise-api` — structured enough for `grep` on the version.

## Logging Recommendations

- The API container logs to stdout in JSON or pretty mode
  (`logger: true` in production).
- The ingestion worker logs to stdout via `console.log` — pipe to
  `docker logs` or a log scraper.
- The Netlify function logs to the Netlify dashboard.
- For local dev with `npm run dev`, output goes to the terminal.

For richer structured logging, replace `console.log` with `pino` and
configure the Fastify `logger` accordingly. Not required for MVP.

## Operational Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Netlify proxy cold start between worker invocations | Medium | Low | 60s cache absorbs most reads; first request after cold start is the only miss. |
| Ingestion upstream (Wikipedia) returns 5xx | Low | Low | Pipeline is tolerant: prior scores are kept on failure. |
| Per-worker edge rate limit underestimates global cap | Low | Low | Acceptable for free-tier traffic. Documented. |
| Postgres container restarts on Ubuntu host | Low | Medium | `pgdata` is a named volume; restart is automatic via Compose `restart: unless-stopped`. |
| Cron task lost on API container restart | Low | Low | `startScheduler()` is called in `bootstrap()`; the next run fires within 1 cron interval. |
| CEO's Ubuntu server is offline | Low | High | No user data is stored (AC-10). The frontend is still served by Netlify CDN; the only impact is a 5xx until the server returns. |

## Troubleshooting

- **`/api/health` returns `version: dev`** — the API process can't find
  a `.git` directory. Set `GIT_SHA` explicitly in the env, or ensure
  the repo is cloned (not downloaded as a tarball).
- **`docker compose up` fails with `ECONNREFUSED 127.0.0.1:5432`** —
  the `db` service isn't healthy yet. Wait 10s and retry, or run
  `docker compose up -d db` first.
- **Caddy says `no certificate available`** — DNS A record isn't
  pointing at the server, or the port-80 ACME challenge is blocked.
- **Netlify function returns 502 `upstream_unreachable`** — `API_ORIGIN`
  is wrong, the API is down, or the Caddy cert hasn't been issued yet.
- **Netlify function returns 429** — exceeded 60 req / 10 min for that
  client IP. The `Retry-After` header tells the client when to retry.
- **Ingestion fails silently** — check `docker logs relocatewise-api`
  for `[ingestion] ... failed: ...`. The pipeline logs each failing
  URL with a `console.warn`; the failing city/dimension is recorded
  in the structured report.
- **CORS error in the browser** — the SPA's origin is missing from
  the API's `CORS_ORIGIN`. Update `.env` and `docker compose up -d` to
  reload.

## Rollback Procedures

```bash
# Roll back the API to a previous git SHA
ssh root@<server-ip> 'cd /srv/relocatewise && git fetch && git checkout <previous-sha> && docker compose up -d --build api'

# Roll back the database to a previous state
# 1. Stop the API so no writes are in flight
ssh root@<server-ip> 'cd /srv/relocatewise && docker compose stop api'
# 2. Restore from pg_dump
ssh root@<server-ip> 'cd /srv/relocatewise && cat /var/backups/relocatewise-YYYY-MM-DD.sql | docker exec -i relocatewise-db psql -U relocatewise relocatewise'
# 3. Restart the API
ssh root@<server-ip> 'cd /srv/relocatewise && docker compose up -d api'
```

For the frontend, Netlify holds the full deploy history. Use the
Netlify dashboard to **Publish deploy** on a previous commit.

For a v0.3.0 → v0.2.0 rollback, the API would lose the 8th dimension
(matching engine falls back to 7-dim logic since the migration `002`
is not reversed). The seed `cities.json` would mismatch the DB. The
recommended path is a clean v0.2.0 deploy with the matching
`db/seeds/cities.json` from the previous commit.
