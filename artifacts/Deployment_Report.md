# RelocateWise — Deployment Report

> v0.4.0 (PRD v3.2.0 / Architecture v1.3.0 alignment).
> v0.4.0 migration: **Netlify → Cloudflare Pages + Cloudflare Tunnel**.

## Project Overview

RelocateWise is a web-based decision-support tool that helps individuals and
families discover cities that match their lifestyle preferences. The MVP
is a single linear flow (8-question bilingual questionnaire → top-10 results
→ city profile → side-by-side compare) with a curated 40-city dataset, an
8-dimension deterministic matching engine, and an automated ingestion
pipeline that keeps the city scores fresh from primary, free, no-key sources.

The deployment is a **two-tier secure deployment** per `docs/Architecture.md` v1.3.0 §2:

1. **Frontend**: React 18 + Vite + TypeScript SPA, deployed to **Cloudflare Pages**
   (free tier). Serves the static bundle via Cloudflare's global CDN. Pages
   Functions route `/api/*` calls to the Ubuntu API via the tunnel.
2. **Backend**: Node 20 + Fastify + TypeScript API + PostgreSQL 16 +
   PostGIS + scheduled ingestion worker, deployed via **Docker Compose**
   on the CEO's **Ubuntu server**. Fronted by **Caddy** (internal Docker
   network only). Public exposure is via **Cloudflare Tunnel** (outbound
   `cloudflared` daemon).
3. **Edge tunnel**: A `cloudflared` daemon establishes an outbound tunnel
   from the Ubuntu server to Cloudflare's edge. Cloudflare Pages forwards
   `/api/*` calls through the tunnel to the local Caddy/API stack. The
   edge tier enforces a 60 req / 10 min per-IP rate limit via WAF rules.

## Environment Requirements

| Requirement | Value |
|---|---|
| Node.js | 20.x LTS (per `api/package.json` and `web/package.json` `engines.node`) |
| npm | 10+ (workspace-aware) |
| Docker | 24+ (with Compose v2 plugin) |
| Postgres image | `postgis/postgis:16-3.4-alpine` (pinned in `docker-compose.yml`) |
| Caddy image | `caddy:2-alpine` (pinned in `docker-compose.yml`) |
| cloudflared image | `cloudflare/cloudflared:2026.6.1` (pinned in `docker-compose.cloudflared.yml`) |
| Cloudflare account | Free tier (Pages + Tunnel) |

## Required Environment Variables

| Var | Scope | Required | Default | Notes (v0.4.0) |
|---|---|---|---|---|
| `DATABASE_URL` | API | In production | unset → in-memory seed | `postgres://user:pass@host:5432/db` |
| `PORT` | API | No | `3000` | API listen port |
| `HOST` | API | No | `0.0.0.0` | API bind address |
| `GIT_SHA` | API | No | `dev` | Returned by `/api/health` |
| `CORS_ORIGIN` | API | In production | echo any (dev) | Comma-separated allowed origins — should match the Cloudflare Pages domain (e.g. `https://relocatewise.pages.dev` or a custom `https://example.com`). |
| `API_SECRET` | API + Cloudflare Pages | Optional | unset → free pass | Shared secret sent in `x-relocatewise-secret` header. Belt-and-suspenders; Cloudflare Tunnel is the primary authentication layer. |
| `ENABLE_RATE_LIMIT` | API | No | enabled (`0` to disable) | `@fastify/rate-limit` 100 req/min/IP. Test paths use `app.inject()` which is in-process and does not trigger the IP-based limit. |
| `INGESTION_DISABLED` | API | No | enabled (`1` to disable) | Skip the scheduled ingestion worker. The CLI ingestion (`npm run ingest`) still works. |
| `INGESTION_CRON` | API | No | `0 3 1 * *` (monthly) | Standard 5-field `node-cron` expression. E.g. `*/10080 * * * *` for weekly (every 10080 minutes = 7 days). |
| `VITE_API_BASE` | SPA build | No | unset → relative `/api/*` | Override the API base; set to a full URL to point at a remote API (Cloudflare Pages routing takes precedence otherwise). |
| `API_PROXY_TARGET` | Vite dev only | No | `http://localhost:3000` | Where Vite forwards `/api/*` in dev. Set to `http://localhost:8080` to use Caddy on host :8080 instead. |
| `CLOUDFLARE_API_TOKEN` | GitHub Actions | For deploy workflow | unset | Cloudflare API token with `Pages: Edit` + `Account: Read` permissions. |
| `CLOUDFLARE_ACCOUNT_ID` | GitHub Actions | For deploy workflow | unset | Cloudflare account ID. |

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
seeds the 40-city dataset (with `flag_image_url` + `landmark_image_url` for every city),
and starts the scheduled ingestion worker (monthly by default).

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

## Smoke walkthrough (v0.4.0)

After `docker compose up -d`:

```bash
# 1. Health
curl -s http://localhost:3000/api/health
# → {"ok":true,"version":"<git-sha>","timestamp":"..."}

# 2. City list (slim, no image URLs)
curl -s http://localhost:3000/api/cities | python3 -c "import sys, json; print(len(json.load(sys.stdin)['cities']))"
# → 40

# 3. City profile (full record with flag + landmark URLs)
curl -s http://localhost:3000/api/cities/lisbon-pt | python3 -c "import sys, json; d=json.load(sys.stdin); print(d['flag_image_url']); print(d['landmark_image_url'])"
# → /flags/pt.svg
# → https://commons.wikimedia.org/wiki/Special:FilePath/Lisbon_(36831531576).jpg

# 4. Match with the new language field (returns why_key + why_vars)
curl -s -X POST -H 'Content-Type: application/json' \
  -d '{"climate":"mediterranean","language":"zh","lifestyle_tags":["urban","coastal"]}' \
  http://localhost:3000/api/match | python3 -c "import sys, json; r=json.load(sys.stdin); print(r['results'][0]['why_key'])"
# → community
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
`web` build emits `web/dist/index.html` + a hashed assets bundle (which
also includes the 27 country flag SVGs from `web/public/flags/`).

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

## Production Deployment Steps (v0.4.0)

### Frontend — Cloudflare Pages

#### 1. Create the Cloudflare Pages project

1. Sign in to <https://dash.cloudflare.com>.
2. Go to **Workers & Pages → Create application → Pages → Upload assets** (or
   connect to the GitHub repo for automatic deploys).
3. Project name: **`relocatewise`** (matches `web/wrangler.toml`).
4. Build settings:
   - Build command: `npm run build`
   - Build output directory: `dist`
   - Root directory: `web`
   - Environment variables: `NODE_VERSION=20`.

#### 2. Configure `/api/*` routing

In the Pages project → **Settings → Functions → Routes**, add:
- Route: `/api/*`
- Worker / Function: `relocatewise-api-proxy` (a Worker that forwards
  `/api/*` requests to the Ubuntu API via the Cloudflare Tunnel hostname).
  The Worker is configured in `cloudflared/CONFIG.example.yml` as
  `api.<DOMAIN>`.

The exact routing configuration depends on the Cloudflare account
type. For free-tier Pages, the simplest setup is:

```js
// relocatewise-api-proxy (Cloudflare Worker)
export default {
  async fetch(request) {
    const url = new URL(request.url);
    return fetch(`https://api.${url.host}${url.pathname}${url.search}`, {
      method: request.method,
      headers: request.headers,
      body: request.body,
    });
  },
};
```

Then bind the Worker to `/api/*` in the Pages Functions routing.

#### 3. (Optional) Custom domain

In Cloudflare DNS, add a CNAME for `<ceo-domain>` pointing at
`<project>.pages.dev`. Cloudflare provisions a Let's Encrypt cert
automatically.

### Backend — Ubuntu server (Docker Compose + Cloudflare Tunnel)

#### 1. Install Docker CE + Compose v2 on the Ubuntu server

```bash
ssh root@<server-ip>
apt update && apt -y install ca-certificates curl gnupg
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpk̄g --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  > /etc/apt/sources.list.d/docker.list
apt update && apt -y install docker-ce docker-ce-cli containerd.io docker-compose-plugin
```

#### 2. One-time: create the Cloudflare Tunnel

```bash
cloudflared tunnel login    # interactive
cloudflared tunnel create relocatewise-prod
# Writes ~/.cloudflared/<UUID>.json with the tunnel credentials.
```

#### 3. Configure the tunnel

```bash
cp cloudflared/CONFIG.example.yml ~/.cloudflared/config.yml
# Edit the file: substitute <TUNNEL-UUID> and <DOMAIN> with the values
# from step 2.
```

#### 4. Store the tunnel credentials as Docker secrets

```bash
docker swarm init    # one-time
cat ~/.cloudflared/<UUID>.json \
  | docker secret create cloudflared_credentials -
docker secret create cloudflared_config - < ~/.cloudflared/config.yml
```

#### 5. Clone the repo and create `.env`

```bash
mkdir -p /srv/relocatewise
cd /srv/relocatewise
git clone <your-github-repo-url> .

cat > /srv/relocatewise/.env <<EOF
POSTGRES_USER=relocatewise
POSTGRES_PASSWORD=$(openssl rand -hex 24)
POSTGRES_DB=relocatewise

# Cloudflare Pages domain + custom domain (comma-separated if both).
CORS_ORIGIN=https://relocatewise.pages.dev,https://example.com

# Git SHA returned by /api/health.
GIT_SHA=$(git -C /srv/relocatewise rev-parse --short HEAD)

# Ingestion cadence (default monthly at 03:00 UTC on the 1st).
INGESTION_CRON=0 3 1 * * *
EOF
chmod 600 /srv/relocatewise/.env
```

#### 6. Bring up the stack

```bash
cd /srv/relocatewise
docker compose \
  -f docker-compose.yml \
  -f docker-compose.cloudflared.yml \
  up -d
```

This brings up `db` (PostGIS), `api`, `caddy` (internal), and `cloudflared`
(exposes the Ubuntu stack to the Cloudflare edge). No inbound ports are
opened on the host firewall.

#### 7. Smoke test

```bash
# Direct (local) — should work without the tunnel.
curl -s http://localhost:3000/api/health

# Via the tunnel — should also work and be encrypted.
curl -s https://api.example.com/api/health
```

### Deploy updates

```bash
ssh root@<server-ip>
cd /srv/relocatewise
git pull
docker compose -f docker-compose.yml -f docker-compose.cloudflared.yml pull
docker compose -f docker-compose.yml -f docker-compose.cloudflared.yml up -d
```

This rebuilds the API image with the latest code, runs any new
migrations, and restarts the containers. Postgres data is preserved on
the named volume `pgdata`.

For the SPA, either:
- Push to the connected GitHub repo (Cloudflare auto-deploys from `main`).
- Run the manual deploy: `cd web && npm ci && npm run build && npx wrangler pages deploy ./dist --project-name=relocatewise --branch=main`.

## Ingestion Pipeline (v0.4.0)

The API container runs `node-cron` inside the same process. On boot it
arms the cron task (default `0 3 1 * *` = 03:00 UTC on the 1st of every
month). At each tick it:

1. Reads all 40 cities from the `cities` table.
2. For each city, fetches the 8 dimensions from primary sources:
   - **Climate**: Wikipedia summary → matches canonical label.
   - **Cost / Housing**: Wikipedia `Economy_of_<city>` summary.
   - **Career**: Wikipedia summary (default 3).
   - **Education / Healthcare / Community**: static neutral 3.
   - **Geopolitical and Conflict Risk** (`military_safety`): curated seed score, capped down if the latest travel advisory is more pessimistic.
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
INGESTION_DISABLED=1 docker compose -f docker-compose.yml -f docker-compose.cloudflared.yml up -d
```

The CLI ingestion still works with the scheduler disabled.

### Source policy

- All sources are free, no-key, public.
- Wikipedia REST (`en.wikipedia.org/api/rest_v1/page/summary/...`).
- Travel-advisory pages parsed with simple regex.
- The pipeline is **tolerant by design**: a single 4xx/5xx response leaves the previous score in place rather than zeroing the city.
- 24h in-memory cache (file-based, in `node_modules/.cache/relocatewise/`) avoids hammering the same source twice in a single run.

## Rate Limiting (v0.4.0)

Two independent tiers per `docs/API_Spec.md` §3.2:

| Tier | Limit | Implementation | Notes |
|---|---|---|---|
| Edge (Cloudflare Pages WAF) | 60 req / 10 min per client IP | Cloudflare WAF rule on `/api/*` | Configured in the Cloudflare dashboard. Per-PoP, not global — acceptable for free-tier traffic. |
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

## Caching (v0.4.0)

| Path | TTL | Implementation |
|---|---|---|
| `GET /api/cities/:slug` | 60s | `TtlCachedCityRepository` (per-process) on the API side |
| `GET /api/cities` | 60s | `TtlCachedCityRepository` (per-process) on the API side |
| `POST /api/match` | never | Dynamic per-request |
| Static SPA assets | Cache-Control: public, max-age=31536000, immutable | Vite's hashed filenames + Cloudflare's CDN |
| Country flag SVGs | Same as SPA assets | Bundled in `/flags/*.svg`, served by Cloudflare CDN |
| Wikimedia landmark thumbnails | Per-image HTTP cache headers | Direct from Wikimedia Commons (the SPA `<img loading="lazy">` defers them) |

## Backups

- **MVP database**: the dataset is in git (`db/seeds/cities.json` + `api/src/db/cities.seed.ts`). RPO = 0, RTO = re-run `docker compose up -d` on a fresh box (~15 minutes).
- **Pre-v0.4.0 deployments** that have user-collected data: a weekly `pg_dump` is recommended but not yet automated (per the docs constraints we don't store user data on the server).

## Monitoring Recommendations

The MVP has no paid monitoring. A minimal observability setup on the Ubuntu server (no cost):

```bash
# In /etc/cron.d/relocatewise-health
*/5 * * * * curl -fsS https://api.example.com/api/health || echo "relocatewise-api-down $(date -Iseconds)" | mail -s "relocatewise down" root@localhost
```

For richer observability, scrape `/api/health`, `/api/cities`, and `/api/match` (POST with a stub profile) from a free UptimeRobot or Betterstack probe. Log scraping is `docker logs --tail 100 relocatewise-api` — structured enough for `grep` on the version.

## Logging Recommendations

- The API container logs to stdout in JSON or pretty mode (`logger: true` in production).
- The ingestion worker logs to stdout via `console.log` — pipe to `docker logs` or a log scraper.
- The Cloudflare Pages dashboard shows edge logs.
- For local dev with `npm run dev`, output goes to the terminal.

For richer structured logging, replace `console.log` with `pino` and configure the Fastify `logger` accordingly. Not required for MVP.

## Operational Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Cloudflare Tunnel daemon crashes | Low | High | Docker `restart: unless-stopped` policy on `cloudflared`. Cloudflare's edge retries the connection automatically. |
| Ingestion upstream (Wikipedia) returns 5xx | Low | Low | Pipeline is tolerant: prior scores are kept on failure. |
| Cloudflare WAF rate limit underestimates global cap | Low | Low | Acceptable for free-tier traffic. Documented. |
| Postgres container restarts on Ubuntu host | Low | Medium | `pgdata` is a named volume; restart is automatic via Compose `restart: unless-stopped`. |
| Cron task lost on API container restart | Low | Low | `startScheduler()` is called in `bootstrap()`; the next run fires within 1 cron interval. |
| CEO's Ubuntu server is offline | Low | High | No user data is stored (AC-10). The SPA is still served by Cloudflare Pages CDN; the only impact is `/api/*` 5xx until the server returns. |
| Wikimedia landmark URL 404s | Low | Low | `<figure>` has a fallback background colour; the layout stays stable. |
| Cloudflare Pages quota exceeded (500 builds/mo) | Low | Medium | Manual deploys from the CEO's machine, logged in CI. |

## Troubleshooting

- **`/api/health` returns `version: dev`** — the API process can't find a `.git` directory. Set `GIT_SHA` explicitly in the env, or ensure the repo is cloned (not downloaded as a tarball).
- **`docker compose up` fails with `ECONNREFUSED 127.0.0.1:5432`** — the `db` service isn't healthy yet. Wait 10s and retry, or run `docker compose up -d db` first.
- **`cloudflared` container exits immediately** — the `cloudflared_credentials` secret is missing or malformed. Recreate it with `docker secret create cloudflared_credentials - < <UUID>.json`.
- **Cloudflare Pages returns 502 for `/api/*`** — the `/api/*` → tunnel routing rule isn't set up. Configure it in the Pages Functions routing dashboard.
- **Cloudflare Pages returns 429** — exceeded 60 req / 10 min for that client IP. The `Retry-After` header tells the client when to retry.
- **Ingestion fails silently** — check `docker logs relocatewise-api` for `[ingestion] ... failed: ...`. The pipeline logs each failing URL with a `console.warn`; the failing city/dimension is recorded in the structured report.
- **CORS error in the browser** — the SPA's origin is missing from the API's `CORS_ORIGIN`. Update `.env` and `docker compose up -d` to reload.
- **Wikimedia landmark image shows broken icon** — the URL is broken. Replace it in `api/src/db/postgres.repository.ts` `LANDMARK_BY_SLUG` and rebuild.

## Rollback Procedures

```bash
# Roll back the API to a previous git SHA
ssh root@<server-ip> 'cd /srv/relocatewise && git fetch && git checkout <previous-sha> && docker compose -f docker-compose.yml -f docker-compose.cloudflared.yml up -d --build api'

# Roll back the database to a previous state
# 1. Stop the API so no writes are in flight
ssh root@<server-ip> 'cd /srv/relocatewise && docker compose -f docker-compose.yml -f docker-compose.cloudflared.yml stop api'
# 2. Restore from pg_dump
ssh root@<server-ip> 'cd /srv/relocatewise && cat /var/backups/relocatewise-YYYY-MM-DD.sql | docker exec -i relocatewise-db psql -U relocatewise relocatewise'
# 3. Restart the API
ssh root@<server-ip> 'cd /srv/relocatewise && docker compose -f docker-compose.yml -f docker-compose.cloudflared.yml up -d api'
```

For the frontend, Cloudflare Pages holds the full deploy history. Use the
Cloudflare dashboard to **Rollback to a previous deploy** on the
Pages project.

For a v0.4.0 → v0.3.0 rollback, the API would lose the 8th dimension
(matching engine falls back to 7-dim logic since the migration `002`
is not reversed). The seed `cities.json` would mismatch the DB. The
recommended path is a clean v0.3.0 deploy with the matching
`db/seeds/cities.json` from the previous commit.