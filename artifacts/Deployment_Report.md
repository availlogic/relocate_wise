# RelocateWise — Deployment Report

> v1.0.0 GA (PRD v3.4.0 / Architecture v1.4.0 / Visual-Guidelines v1.4.0 alignment).
>
> Phases A through F delivered:
> - Phase A — schema segregation + role isolation
> - Phase B — 3 microservice containers (matching / ingestion / gateway)
> - Phase C — internal sync endpoint + HTTP-backed ingestion writer
> - Phase D — 4 micro-frontend workspaces (container / quiz / compare / dashboard)
> - Phase E — module READMEs
> - Phase F — dark glassmorphism → light claymorphism (visual only)
> - Phase G — `api/` + `web/` redirect markers
>
> See `artifacts/Implementation_Report.md` for the full changelog.

## Project Overview

RelocateWise is a web-based decision-support tool that helps individuals and families discover cities that match their lifestyle preferences. The GA v1.0.0 release is a single linear flow (8-question bilingual questionnaire → top-10 results → city profile → side-by-side compare) with a curated 40-city dataset, an 8-dimension deterministic matching engine, and an automated ingestion pipeline that keeps the city scores fresh from primary, free, no-key sources.

The deployment is a **three-tier secure deployment** per `docs/Architecture.md` v1.4.0 §2:

1. **Frontend tier** — React 18 + Vite + TypeScript SPA, deployed to **Cloudflare Pages** (free tier). Serves the static bundle via Cloudflare's global CDN. Pages Functions route `/api/*` calls to the Ubuntu API via the tunnel.
2. **Backend tier** — 3 Node 20 + Fastify + TypeScript microservices + PostgreSQL 16 + PostGIS, deployed via **Docker Compose** on the CEO's **Ubuntu server**:
   - `@relocatewise/matching-service` (Fastify HTTP API; owns the `matching` schema)
   - `@relocatewise/ingestion-service` (cron worker; owns the `ingestion` schema; PUTs scores via the matching service's internal endpoint)
   - `@relocatewise/gateway` (port 3000, the only service on the public ingress; refuses `/api/internal/*`)
   - `@relocatewise/shared` (TypeScript types + climate tables, built first and consumed by every other workspace)
   - `db` (Postgres + PostGIS, with schema segregation enforced at the role level)

The **frontend tier** runs on Cloudflare Pages but the SPA itself is split into 4 micro-frontend workspaces that the `web-container` workspace lazy-loads as separate JS chunks:
   - `@relocatewise/web-container` (the host shell — router, i18n, providers, container-rendered pages)
   - `@relocatewise/web-quiz-mfe` (the 8-step ProfileForm wizard)
   - `@relocatewise/web-compare-mfe` (the side-by-side comparison matrix)
   - `@relocatewise/web-dashboard-mfe` (the ranked results + city profile pages)
3. **Edge tunnel** — A `cloudflared` daemon establishes an outbound tunnel from the Ubuntu server to Cloudflare's edge. The edge tier enforces a 60 req / 10 min per-IP rate limit via WAF rules.

## Environment Requirements

| Requirement | Value |
|---|---|
| Node.js | 20.x LTS (per each workspace's `engines.node`) |
| npm | 10+ (workspace-aware) |
| Docker | 24+ (with Compose v2 plugin) |
| Postgres image | `postgis/postgis:16-3.4-alpine` |
| cloudflared image | `cloudflare/cloudflared:2026.6.1` |
| Cloudflare account | Free tier (Pages + Tunnel) |

The `web/` and `api/` parent directories each ship a stub `package.json` that prints a redirect banner — they are not workspaces themselves. Always run npm commands from the **repo root** or target a specific workspace with `npm -w <name>`. See README.md "Read this first — monorepo layout".

## Required Environment Variables

The docker-compose stack reads `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `CORS_ORIGIN`, `GIT_SHA`, `INGESTION_DISABLED`, `INGESTION_CRON`, and `API_SECRET` from the host environment (or `.env` at the project root). See `.env.example` for local defaults.

| Var | Scope | Required | Default | Notes |
|---|---|---|---|---|
| `POSTGRES_USER` | db | Yes | `relocatewise` | Superuser; used by the migration runner / boot seed only. |
| `POSTGRES_PASSWORD` | db | Yes | `relocatewise` | Local dev default; override in production. |
| `POSTGRES_DB` | db | Yes | `relocatewise` | Database name. |
| `ADMIN_DATABASE_URL` | matching-service (boot only) | No | derived | Connects as the superuser to run migrations + seed. Not exported as a service env by default. |
| `MATCHING_DATABASE_URL` | matching-service | Yes | derived | Connects as `matching_service` (R/W on `matching.*`; SELECT-only on `ingestion.*`). |
| `INGESTION_DATABASE_URL` | ingestion-service | Yes | derived | Connects as `ingestion_service` (SELECT-only on `matching.*`; R/W on `ingestion.*`). |
| `INGESTION_TARGET_URL` | ingestion-service | Yes (in production) | unset → noop | URL the ingestion worker PUTs each dimension's score to. In the docker stack this is `http://matching:3000`; in single-container dev it is `http://localhost:3000`. |
| `INGESTION_TARGET_TOKEN` | ingestion-service | Yes (in production) | unset → noop | Bearer token. Must equal `API_SECRET` on the matching service. |
| `INGESTION_DISABLED` | ingestion-service | No | `0` (enabled) | Set to `1` to skip the scheduled cron worker. The CLI ingestion (`npm -w @relocatewise/ingestion-service run ingest`) still works. |
| `INGESTION_CRON` | ingestion-service | No | `0 3 1 * *` (monthly) | Standard 5-field `node-cron` expression. E.g. `*/10080 * * * *` for weekly. |
| `PORT` | matching-service + gateway | No | `3000` | Service listen port. |
| `HOST` | matching-service + gateway | No | `0.0.0.0` | Bind address. |
| `GIT_SHA` | matching-service | No | `dev` | Returned by `/api/health`. |
| `CORS_ORIGIN` | matching-service + gateway | Yes (in production) | `http://localhost:5173` | Comma-separated allowed origins. Must match the Cloudflare Pages domain in production. |
| `API_SECRET` | matching-service + gateway + ingestion-service | Yes (in production) | `local-dev-secret` | Bearer for `PUT /api/internal/cities/:slug/scores` (matching) and the optional public `x-relocatewise-secret` gate (gateway). |
| `API_PUBLIC_SECRET` | gateway | Optional | unset → no-op | When set, the gateway requires `x-relocatewise-secret` on every public request. Belt-and-suspenders on top of Cloudflare Tunnel. |
| `MATCHING_URL` | gateway | Yes | `http://localhost:3000` | Where the gateway forwards public traffic. In docker compose this is `http://matching:3000`. |
| `ENABLE_RATE_LIMIT` | matching-service + gateway | No | enabled (`0` to disable) | Per-process token-bucket rate limit on top of the Cloudflare edge WAF. Test paths use `app.inject()` which is in-process and does not trigger the IP-based limit. |
| `VITE_API_BASE` | web-container | No | unset → relative `/api/*` | Override the API base at build time; set to a full URL to point at a remote API. |
| `API_PROXY_TARGET` | web-container (dev only) | No | `http://localhost:3000` | Where Vite forwards `/api/*` in dev. |
| `CLOUDFLARE_API_TOKEN` | GitHub Actions | For deploy workflow | unset | Cloudflare API token with `Pages: Edit` + `Account: Read` permissions. |
| `CLOUDFLARE_ACCOUNT_ID` | GitHub Actions | For deploy workflow | unset | Cloudflare account ID. |

## Local Development Setup

### Option A — full local stack with Docker (recommended)

This is what CI runs against and what the production stack mirrors. Postgres+PostGIS, the 3 microservices, and the cloudflared tunnel all come up in one command.

```bash
# 1. Clone and install — from the repo root.
git clone <your-repo-url> relocatewise
cd relocatewise
npm install

# 2. Bring up Postgres + PostGIS, the 3 microservices, and the cloudflared tunnel.
docker compose -f docker-compose.yml -f docker-compose.cloudflared.yml up -d
```

The first boot applies the migrations in `db/migrations/` (matching schema, ingestion schema, role grants) and seeds the 40-city dataset. The **gateway** is the only service with a host port mapping (`3000:3000`); the matching + ingestion services + db are reachable only on the internal Docker network.

```bash
# 3. In another terminal, run the SPA in dev mode — from the repo root.
npm -w @relocatewise/web-container run dev
```

Open <http://localhost:5173>. The Vite dev server proxies `/api/*` to `http://localhost:3000` (the gateway) per `web/container/vite.config.ts`.

### Option B — no Docker, in-memory seed (fastest for a quick look)

If you don't want to install Docker, the matching service falls back to the in-memory seed (40 cities, identical dataset). The gateway isn't required for dev — you can point the SPA's Vite proxy directly at the matching service.

```bash
# 1. Clone and install — from the repo root.
git clone <your-repo-url> relocatewise
cd relocatewise
npm install

# 2. Run the matching service in one terminal (in-memory seed, no DB).
npm -w @relocatewise/matching-service run dev
# The matching service listens on :3000.

# Optional second terminal: ingestion worker (cron + manual CLI).
# Without INGESTION_TARGET_URL set, the worker logs but does not push scores.
INGESTION_DISABLED=1 npm -w @relocatewise/ingestion-service run dev

# Optional third terminal: API gateway in front of the matching service.
# Without this, the SPA's Vite proxy can point at the matching service directly.
npm -w @relocatewise/gateway run dev
# The gateway listens on :3001 by default and forwards to MATCHING_URL.

# 3. In another terminal, run the SPA — from the repo root.
API_PROXY_TARGET=http://localhost:3000 npm -w @relocatewise/web-container run dev
# (or http://localhost:3001 if you started the gateway)
```

Open <http://localhost:5173>.

> **Note**: do NOT `cd api` or `cd web` before running these commands. Those directories are parents of multiple sibling workspaces and ship a redirect marker that exits with a self-explanatory message (see README.md "Read this first — monorepo layout").

### Option C — point the SPA at a different API host

To use a remote API (e.g. a staging server, or a teammate's local box):

```bash
VITE_API_BASE=https://staging.example.com npm -w @relocatewise/web-container run dev
```

`VITE_API_BASE` is the only SPA-side override. The Vite proxy is bypassed because the SPA now calls the absolute URL directly.

### Verify the local stack is wired correctly

Once the SPA is up at <http://localhost:5173>, run these checks in a third terminal. If they all return the expected values, the whole pipeline is working.

```bash
# 1. The SPA itself is up.
curl -sI http://localhost:5173/ | head -1
# → HTTP/1.1 200 OK

# 2. The matching service is up, directly on its port.
curl -s http://localhost:3000/api/health
# → {"ok":true,"version":"<git-sha>","timestamp":"..."}

# 3. The Vite proxy is forwarding /api/* to the matching service.
curl -s http://localhost:5173/api/cities | python3 -c "import sys, json; print(len(json.load(sys.stdin)['cities']))"
# → 40

# 4. The matching engine round-trips a profile (should return 10).
curl -s -X POST -H 'Content-Type: application/json' \
  -d '{"climate":"mediterranean","career_industry":"tech","lifestyle_tags":["urban","coastal"]}' \
  http://localhost:3000/api/match | python3 -c "import sys, json; print(len(json.load(sys.stdin)['results']))"
# → 10

# 5. The gateway refuses /api/internal/* (ITC-9 step 3).
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3001/api/internal/cities/lisbon-pt/scores
# → 404
```

Now open <http://localhost:5173> in a browser. The expected first-visit flow:

1. **Consent banner** appears at the top (no cookies set; click *Accept* or *Decline*).
2. **Landing page** shows the claymorphic hero with a **Start the questionnaire** button.
3. **Questionnaire** has 8 sections (climate, cost, housing, career, education, healthcare, lifestyle, geopolitics & conflict risk). You can *Skip* any question.
4. **Results** page shows your top 10 matches as clay cards with a 0–100 score and a templated "why this fits you" line.
5. **Add to compare** on any 2 or 3 cards, then click the **Compare** link in the header to see the side-by-side matrix with the best per row highlighted.
6. **View full profile** on any card to see the 8 dimension bars, the qualitative description, the landmark photo, and the country flag SVG.

## Build Instructions

```bash
# From the repo root.
npm install             # workspace-aware install (8 workspaces)
npm run build           # builds shared → matching/ingestion/gateway + web container
npm run typecheck       # tsc --noEmit across all 8 workspaces
npm run lint            # eslint across all 8 workspaces
npm test                # vitest across all 8 workspaces (426 tests)
```

The `web/container` build emits `web/container/dist/index.html` + the three lazy-loaded MFE chunks (`quiz-mfe-*.js`, `compare-mfe-*.js`, `dashboard-mfe-*.js`) plus the container shell. Cloudflare Pages serves this directory directly.

The 3 api Dockerfiles (`api/{matching,ingestion,gateway}/Dockerfile`) build the matching node modules from the repo root with `npm ci --include=dev`, then run `tsc -p tsconfig.build.json` for each workspace and copy only `dist/`, `db/`, and `shared/dist` into the runtime image.

## Docker Instructions

Each of the 3 api services has its own Dockerfile; build them individually or via `docker compose`.

```bash
# Smoke build (same as CI).
docker build -f api/matching-service/Dockerfile  -t relocatewise-matching:ci-smoke  .
docker build -f api/ingestion-service/Dockerfile -t relocatewise-ingestion:ci-smoke .
docker build -f api/gateway/Dockerfile          -t relocatewise-gateway:ci-smoke   .

# Or via docker compose (uses the Dockerfiles referenced from docker-compose.yml).
docker compose -f docker-compose.yml build
```

The Dockerfile pattern is the same for all 3 services:
1. `node:20-alpine` build stage.
2. Install all workspace deps via `npm ci --include=dev` from the repo root (the Dockerfile copies each workspace's `package.json` then runs `npm ci`).
3. Build `shared/` then the workspace via `tsc -p tsconfig.build.json`.
4. Prune dev deps.
5. Copy `db/`, `shared/dist`, and the workspace's `dist/` into the runtime image.
6. Entry point: `node dist/server.js` (matching + ingestion) or `node dist/server.js` (gateway).
7. Healthcheck hits `http://127.0.0.1:3000/api/health` (matching + gateway).

## Production Deployment Steps

### Frontend — Cloudflare Pages

#### 1. Create the Cloudflare Pages project

1. Sign in to <https://dash.cloudflare.com>.
2. Go to **Workers & Pages → Create application → Pages → Connect to Git**.
3. Pick the GitHub repo and authorize Cloudflare to read it.
4. Select the RelocateWise repository.

#### 2. Configure build settings

`web/wrangler.toml` pins the project name (`relocatewise`) and the build output directory. In the Pages project **Settings → Builds**:

| Setting | Value | Notes |
|---|---|---|
| Build command | `npm -w @relocatewise/web-container run build` | Runs only the container workspace build, which emits the shell + 3 MFE chunks. |
| Build output directory | `container/dist` | The container workspace's Vite output (set in `web/wrangler.toml` via `pages_build_output_dir`). |
| Root directory | `web` | Where the SPA lives. |
| Environment variables | `NODE_VERSION=20` | Forces Node 20 in the build env. |

#### 3. Configure `/api/*` routing

In the Pages project → **Settings → Functions → Routes**, add:
- Route: `/api/*`
- Worker / Function: `relocatewise-api-proxy` (a Cloudflare Worker that forwards `/api/*` requests to `https://api.<ceo-domain>`).

The Worker source is trivial (see "Cloudflare Worker example" below). Cloudflare then maps the Worker to the `/api/*` route on your Pages project.

#### 4. (Optional) Custom domain

In Cloudflare DNS, add a CNAME for `<ceo-domain>` pointing at `<project>.pages.dev`. Cloudflare provisions a Let's Encrypt cert automatically.

#### 5. (Optional) Manual deploy from the CEO's machine

```bash
# From the repo root.
npm ci
npm -w @relocatewise/web-container run build
npx wrangler pages deploy ./web/container/dist --project-name=relocatewise --branch=main
```

The deploy requires `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` in the environment.

#### 6. (Recommended) Enable Deploy Previews

Under **Settings → Build configurations**, enable **Preview deployments** for non-`main` branches. Every PR gets its own preview URL that runs against the production tunnel.

#### Cloudflare Worker example

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

Bind the Worker to `/api/*` in the Pages Functions routing.

#### 7. Smoke-test the deployment

Once the first deploy is green, run through this checklist (everything should take under 60 seconds):

```bash
# Replace <project> with your Cloudflare Pages subdomain (or your custom <ceo-domain>).

# 1. SPA loads.
curl -sI https://<project>.pages.dev/ | head -1
# → HTTP/2 200

# 2. Health endpoint (proxied through the tunnel → gateway → matching).
curl -s https://<project>.pages.dev/api/health
# → {"ok":true,"version":"<git-sha>","timestamp":"..."}

# 3. City list (proxied).
curl -s https://<project>.pages.dev/api/cities | python3 -c "import sys, json; print(len(json.load(sys.stdin)['cities']))"
# → 40

# 4. Single city (proxied).
curl -s https://<project>.pages.dev/api/cities/lisbon-pt | python3 -c "import sys, json; print(json.load(sys.stdin)['slug'])"
# → lisbon-pt

# 5. Match endpoint (proxied + bilingual).
curl -s -X POST -H 'Content-Type: application/json' \
  -d '{"climate":"mediterranean","language":"zh","lifestyle_tags":["urban","coastal"]}' \
  https://<project>.pages.dev/api/match | python3 -c "import sys, json; r=json.load(sys.stdin); print(r['results'][0]['why_key'])"
# → community

# 6. Gateway refuses /api/internal/* (ITC-9 step 3).
curl -s -o /dev/null -w "%{http_code}\n" https://<project>.pages.dev/api/internal/cities/lisbon-pt/scores
# → 404
```

If any of these fail, the problem is almost always one of:
- **CORS** — the matching service's `CORS_ORIGIN` env var doesn't include the Pages domain. Fix: update `CORS_ORIGIN` on the server and `docker compose up -d` to pick it up.
- **Tunnel unreachable** — `cloudflared` isn't running. Check `docker logs relocatewise-cloudflared`.
- **Wrong tunnel hostname** — the Pages `/api/*` → tunnel hostname mapping isn't set up. Fix: configure it in the Pages Functions routing dashboard.

### Backend — Ubuntu server (Docker Compose + Cloudflare Tunnel)

The MVP backend is exposed to the internet through a Cloudflare Tunnel. No inbound ports need to be opened on the host firewall — the `cloudflared` daemon initiates the tunnel outbound-only.

#### Prerequisites

- An Ubuntu 22.04+ server reachable from the public internet (any VPS — Hetzner, DigitalOcean, Vultr, OVH; the cheapest tier is enough).
- A `CEO_DOMAIN` placeholder (replace with the real domain throughout this section).
- A Cloudflare account + tunnel credentials (see step 2 below).

#### 1. Install Docker

```bash
ssh root@<server-ip>
apt update && apt -y install ca-certificates curl gnupg
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  > /etc/apt/sources.list.d/docker.list
apt update && apt -y install docker-ce docker-ce-cli containerd.io docker-compose-plugin
```

Verify with `docker --version` and `docker compose version`.

#### 2. One-time: create the Cloudflare Tunnel

```bash
# On the CEO's machine (or any client with cloudflared installed)
cloudflared tunnel login    # interactive; opens the browser
cloudflared tunnel create relocatewise-prod
# Writes ~/.cloudflared/<UUID>.json with the tunnel credentials.
```

Then copy `cloudflared/CONFIG.example.yml` from this repo to `~/.cloudflared/config.yml` and substitute `<TUNNEL-UUID>` and `<DOMAIN>` with the values from step 2. The example config points the tunnel at the `gateway` container (port 3000), which is the only service on the public ingress.

#### 3. Store the tunnel credentials as Docker secrets

```bash
docker swarm init    # one-time
cat ~/.cloudflared/<UUID>.json \
  | docker secret create cloudflared_credentials -
docker secret create cloudflared_config - < ~/.cloudflared/config.yml
```

#### 4. Clone the repo and create `.env`

```bash
mkdir -p /srv/relocatewise
cd /srv/relocatewise
git clone <your-github-repo-url> .

cat > /srv/relocatewise/.env <<EOF
POSTGRES_USER=relocatewise
POSTGRES_PASSWORD=$(openssl rand -hex 24)
POSTGRES_DB=relocatewise

# CORS — comma-separated. The Cloudflare Pages domain must be in here.
CORS_ORIGIN=https://relocatewise.pages.dev,https://<ceo-domain>

# Shared secret the gateway sends on every request and the matching
# service checks on /api/internal/*.
API_SECRET=$(openssl rand -hex 32)

# URL the ingestion worker PUTs to. Set to the internal Docker hostname
# so the worker talks directly to the matching service, not the gateway.
INGESTION_TARGET_URL=http://matching:3000
INGESTION_TARGET_TOKEN=$API_SECRET

# Git SHA returned by /api/health. The deploy script updates this.
GIT_SHA=$(git -C /srv/relocatewise rev-parse --short HEAD)

# Ingestion cadence (default monthly at 03:00 UTC on the 1st).
INGESTION_CRON=0 3 1 * *
EOF
chmod 600 /srv/relocatewise/.env
```

#### 5. Bring the stack up

```bash
cd /srv/relocatewise
docker compose \
  -f docker-compose.yml \
  -f docker-compose.cloudflared.yml \
  up -d
```

This starts `db` (PostGIS), `matching` / `ingestion` / `gateway` (Fastify microservices on the internal Docker network), and `cloudflared` (outbound tunnel to Cloudflare's edge). The gateway is the only service with a host port mapping.

The first boot pulls images:
- `postgis/postgis:16-3.4-alpine` (~80 MB)
- `node:20-alpine` (build stage for the matching / ingestion / gateway Dockerfiles; runtime image is built locally)
- `cloudflare/cloudflared:2026.6.1` (~50 MB)

The matching container then runs migrations and seeds the 40-city dataset. **This is idempotent** — re-running on a database that already has data is a no-op.

#### 6. Smoke-test the API

```bash
# Direct (local, via the gateway) — should work without the tunnel.
curl -s http://localhost:3000/api/health

# Direct (local, bypassing the gateway) — should also work.
docker exec -it relocatewise-matching \
  curl -s http://localhost:3000/api/health

# Via the tunnel — should also work and be encrypted.
curl -s https://api.<ceo-domain>/api/health
```

If the tunnel is up but the Cloudflare proxy returns 502, check `docker logs relocatewise-cloudflared`. The most common cause is incorrect tunnel credentials or hostname misconfiguration.

#### 7. Subsequent deploys

The CEO (or whoever has SSH access) runs one command on the server:

```bash
ssh root@<server-ip> 'cd /srv/relocatewise && git pull && \
  docker compose -f docker-compose.yml -f docker-compose.cloudflared.yml build && \
  docker compose -f docker-compose.yml -f docker-compose.cloudflared.yml up -d'
```

This rebuilds the 3 service images with the latest code, runs any new migrations, and restarts the containers. Postgres data is preserved on the named volume `pgdata`.

For zero-downtime deploys, the architecture doc leaves room for `docker compose up -d --no-deps --scale matching=2` followed by a rolling restart; that's a Day-2 optimization and not in the MVP.

#### 8. Backups

None required. The dataset is in git (`db/seeds/cities.json`); the database is a build artifact. RPO = 0, RTO = re-run `docker compose -f docker-compose.yml -f docker-compose.cloudflared.yml up -d` on a fresh box (~15 minutes).

## Ingestion Pipeline

The `ingestion-service` container runs `node-cron` inside the same process. On boot it arms the cron task (default `0 3 1 * *` = 03:00 UTC on the 1st of every month). At each tick it:

1. Reads all 40 cities from the `cities` table (via the `ingestion_service` role, SELECT-only on `matching.*`).
2. For each city, fetches the 8 dimensions from primary sources:
   - **Climate**: Wikipedia summary → matches canonical label.
   - **Cost / Housing**: Wikipedia `Economy_of_<city>` summary.
   - **Career**: Wikipedia summary (default 3).
   - **Education / Healthcare / Community**: static neutral 3.
   - **Geopolitical and Conflict Risk** (`military_safety`): curated seed score, capped down if the latest travel advisory is more pessimistic.
3. Normalises the values into 1-5 scores and writes them to `ingestion.pipeline_logs` (the only write the `ingestion_service` role performs on its own schema).
4. **Does NOT write directly to `matching.city_scores`** (Phase A — schema segregation). Instead, it PUTs each dimension triple to the matching service's internal endpoint: `PUT /api/internal/cities/:slug/scores` with `Authorization: Bearer $INGESTION_TARGET_TOKEN`. The matching service is the only writer to `matching.*`.
5. On success, the matching service UPSERTs the score into `matching.city_scores` and bumps `matching.cities.last_updated = CURRENT_DATE`.
6. On failure, the ingestion service logs the failing dimension name + city into `ingestion.pipeline_logs`.

To run the pipeline ad-hoc:

```bash
npm -w @relocatewise/ingestion-service run ingest                       # all cities
npm -w @relocatewise/ingestion-service run ingest -- --city=lisbon-pt    # one city
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

## Rate Limiting

Two independent tiers per `docs/API_Spec.md` §3.2:

| Tier | Limit | Implementation | Notes |
|---|---|---|---|
| Edge (Cloudflare Pages WAF) | 60 req / 10 min per client IP | Cloudflare WAF rule on `/api/*` | Configured in the Cloudflare dashboard. Per-PoP, not global — acceptable for free-tier traffic. |
| Backend (Fastify) | 100 req / 1 min per client IP | `@fastify/rate-limit` on matching-service + gateway | Enabled by default on both services. Opt-out via `ENABLE_RATE_LIMIT=0`. Test paths use `app.inject()` which is in-process and not subject to the IP limit. |

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

## Caching

| Path | TTL | Implementation |
|---|---|---|
| `GET /api/cities/:slug` | 60s | `TtlCachedCityRepository` (per-process) on the matching-service side |
| `GET /api/cities` | 60s | `TtlCachedCityRepository` (per-process) on the matching-service side |
| `POST /api/match` | never | Dynamic per-request |
| `PUT /api/internal/cities/:slug/scores` | never | Internal sync — bypasses the TTL cache |
| Static SPA assets | Cache-Control: public, max-age=31536000, immutable | Vite's hashed filenames + Cloudflare's CDN |
| Country flag SVGs | Same as SPA assets | Bundled in `web/container/public/flags/*.svg`, served by Cloudflare CDN |
| Wikimedia landmark thumbnails | Per-image HTTP cache headers | Direct from Wikimedia Commons (the SPA `<img loading="lazy">` defers them) |

## Operational Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Cloudflare Tunnel daemon crashes | Low | High | Docker `restart: unless-stopped` policy on `cloudflared`. Cloudflare's edge retries the connection automatically. |
| Ingestion upstream (Wikipedia) returns 5xx | Low | Low | Pipeline is tolerant: prior scores are kept on failure. |
| Cloudflare WAF rate limit underestimates global cap | Low | Low | Acceptable for free-tier traffic. Documented. |
| Postgres container restarts on Ubuntu host | Low | Medium | `pgdata` is a named volume; restart is automatic via Compose `restart: unless-stopped`. |
| Cron task lost on ingestion container restart | Low | Low | `startScheduler()` is called in `bootstrap()`; the next run fires within 1 cron interval. |
| CEO's Ubuntu server is offline | Low | High | No user data is stored (AC-10). The SPA is still served by Cloudflare Pages CDN; the only impact is `/api/*` 5xx until the server returns. |
| Wikimedia landmark URL 404s | Low | Low | `<figure>` has a fallback background colour; the layout stays stable. |
| Cloudflare Pages quota exceeded (500 builds/mo) | Low | Medium | Manual deploys from the CEO's machine, logged in CI. |
| `cloudflared` Docker secret missing | Low | High | Pre-deploy validation in the runbook; recreate with `docker secret create cloudflared_credentials - < <UUID>.json`. |

## Monitoring Recommendations

The MVP has no paid monitoring. A minimal observability setup on the Ubuntu server (no cost):

```bash
# In /etc/cron.d/relocatewise-health
*/5 * * * * curl -fsS https://api.<ceo-domain>/api/health || echo "relocatewise-api-down $(date -Iseconds)" | mail -s "relocatewise down" root@localhost
```

For richer observability, scrape `/api/health`, `/api/cities`, and `/api/match` (POST with a stub profile) from a free UptimeRobot or Betterstack probe. Log scraping is `docker logs --tail 100 relocatewise-matching` — structured enough for `grep` on the version.

## Logging Recommendations

- The matching + ingestion + gateway containers log to stdout in JSON or pretty mode (`logger: true` in production).
- The ingestion worker logs to stdout via `console.log` — pipe to `docker logs` or a log scraper.
- The Cloudflare Pages dashboard shows edge logs.
- For local dev with `npm -w @relocatewise/matching-service run dev`, output goes to the terminal.

For richer structured logging, replace `console.log` with `pino` and configure the Fastify `logger` accordingly. Not required for MVP.

## Troubleshooting

- **`cd api && npm run dev` (or `cd web && npm run dev`) fails with `ENOENT … package.json`** — `api/` and `web/` are not workspaces; they're parents of sibling workspaces. Always run from the repo root. Each parent ships a stub `package.json` that explains the redirect.
- **`/api/health` returns `version: dev`** — the matching process couldn't find a `.git` directory. Set `GIT_SHA` explicitly in the env, or ensure the repo is cloned (not downloaded as a tarball).
- **`docker compose up` fails with `connect ECONNREFUSED 127.0.0.1:5432`** — the `db` service isn't healthy yet. Wait 10 seconds and retry, or run `docker compose up -d db` first, then `docker compose up -d matching ingestion gateway`.
- **Gateway returns `401 Unauthorized` for a public request** — `API_PUBLIC_SECRET` is set on the gateway but not on the client. Either unset `API_PUBLIC_SECRET` (Cloudflare Tunnel is the primary auth) or send `x-relocatewise-secret: <value>` in the SPA's fetch headers.
- **Ingestion returns `401 Unauthorized`** — `INGESTION_TARGET_TOKEN` on the ingestion container doesn't match `API_SECRET` on the matching container. Re-export both from `.env` and `docker compose up -d`.
- **`cloudflared` container exits immediately** — the `cloudflared_credentials` secret is missing or malformed. Recreate it with `docker secret create cloudflared_credentials - < <UUID>.json`.
- **Cloudflare Pages returns 502 for `/api/*`** — the `/api/*` → tunnel routing rule isn't set up in the Pages Functions routing dashboard. Verify the Worker is bound to `/api/*` and that it forwards to `https://api.<ceo-domain>`.
- **Cloudflare Pages returns 429** — exceeded 60 req / 10 min for that client IP. The `Retry-After` header tells the client when to retry.
- **Gateway returns 404 for `/api/internal/*`** — by design (ITC-9 step 3). The internal sync endpoint is only reachable from the ingestion-service container via the internal Docker network, never from the public ingress.
- **Ingestion fails silently** — check `docker logs relocatewise-ingestion` for `[ingestion] ... failed: ...`. The pipeline logs each failing URL with a `console.warn`; the failing city/dimension is recorded in `ingestion.pipeline_logs` with the dimension name in the `error_details` column.
- **CORS error in the browser** — the SPA's origin is missing from the matching service's `CORS_ORIGIN`. Update `.env` and `docker compose up -d` to reload.
- **Wikimedia landmark image shows broken icon** — the URL is broken. Replace it in `api/matching-service/src/db/postgres.repository.ts` `LANDMARK_BY_SLUG` and rebuild.

## Rollback Procedures

```bash
# Roll back the API to a previous git SHA (all 3 services)
ssh root@<server-ip> 'cd /srv/relocatewise && git fetch && git checkout <previous-sha> && \
  docker compose -f docker-compose.yml -f docker-compose.cloudflared.yml up -d --build matching ingestion gateway'

# Roll back the database to a previous state
# 1. Stop the matching service so no writes are in flight
ssh root@<server-ip> 'cd /srv/relocatewise && \
  docker compose -f docker-compose.yml -f docker-compose.cloudflared.yml stop matching'

# 2. Restore from pg_dump (if you have one)
ssh root@<server-ip> 'cd /srv/relocatewise && \
  cat /var/backups/relocatewise-YYYY-MM-DD.sql | docker exec -i relocatewise-db \
  psql -U relocatewise relocatewise'

# 3. Restart the matching service
ssh root@<server-ip> 'cd /srv/relocatewise && \
  docker compose -f docker-compose.yml -f docker-compose.cloudflared.yml up -d matching'
```

For the frontend, Cloudflare Pages holds the full deploy history. Use the Cloudflare dashboard to **Rollback to a previous deploy** on the Pages project.

For a v1.0.0 GA → v0.4.0 rollback, the API would lose the 8th dimension (matching engine falls back to 7-dim logic since the migration `002` is not reversed). The seed `cities.json` would mismatch the DB. The recommended path is a clean v0.4.0 deploy with the matching `db/seeds/cities.json` from the previous commit.