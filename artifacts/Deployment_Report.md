# RelocateWise — Deployment Report

## Project Overview

RelocateWise is a web-based decision-support tool that helps individuals and
families discover cities that match their lifestyle preferences. The MVP
is a single linear flow (questionnaire → results → profile → compare) with
a curated 40-city dataset and a deterministic matching engine.

The deployment is a two-tier hybrid per `docs/Architecture.md` §2:

1. **Frontend**: React 18 + Vite + TypeScript SPA, deployed to **Netlify**
   (free tier). Serves the static bundle via global CDN.
2. **Backend**: Node 20 + Fastify + TypeScript API + PostgreSQL 16 +
   PostGIS, deployed via **Docker Compose** on the CEO's **Ubuntu
   server**. Fronted by **Caddy** for automatic Let's Encrypt TLS.
3. **Edge proxy**: A single Netlify Function
   (`netlify/functions/proxy.ts`) forwards `/api/*` browser calls to
   the Ubuntu API, with a 60s in-memory cache for
   `GET /api/cities/:slug` and an injected `x-relocatewise-secret`
   shared header for authentication.

## Environment Requirements

| Requirement | Value |
|---|---|
| Node.js | 20.x LTS (per `api/package.json` `engines.node`) |
| npm | 10+ (workspace-aware) |
| Docker | 24+ (with Compose v2 plugin) |
| Postgres image | `postgis/postgis:16-3.4-alpine` (pinned in `docker-compose.yml`) |
| Caddy image | `caddy:2-alpine` |
| Browser target | Modern evergreen (Chrome, Firefox, Safari) |
| TLS | Caddy auto-provisions Let's Encrypt via ACME HTTP-01 |
| Domain | A record for `api.<ceo-domain>` pointing at the server's public IP |

## Required Environment Variables

### API container (`docker-compose.yml`)
| Var | Required | Default | Notes |
|---|---|---|---|
| `DATABASE_URL` | yes (prod) | unset → in-memory | `postgres://user:pass@db:5432/db` |
| `PORT` | no | `3000` | API listen port |
| `HOST` | no | `0.0.0.0` | API bind address |
| `CORS_ORIGIN` | yes (prod) | `http://localhost:5173` | Comma-separated allowed origins |
| `GIT_SHA` | no | `dev` | Returned by `/api/health` |
| `API_SECRET` | yes (prod) | unset | Shared secret (enables the `/api/*` gate) |
| `ENABLE_RATE_LIMIT` | no | unset | `1` enables `@fastify/rate-limit` at 100 req/min/IP |

### Netlify function (`netlify.toml`)
| Var | Required | Default | Notes |
|---|---|---|---|
| `API_ORIGIN` | yes (prod) | — | `https://api.<ceo-domain>` (no trailing slash) |
| `API_SECRET` | yes (prod) | — | Same value as the Ubuntu API |

### Host (`/etc/profile.d/relocatewise.sh`)
| Var | Required | Notes |
|---|---|---|
| `API_DOMAIN` | yes (prod) | e.g. `api.example.com` — picked up by the Caddyfile placeholder |
| `CEO_DOMAIN` | yes (prod) | e.g. `example.com` — used in the README's curl examples |

## Local Development Setup

```bash
git clone <your-repo-url> relocatewise
cd relocatewise
npm install
docker compose up -d              # API + DB + Caddy on :8080 (HTTP)
cd web
npm install
npm run dev                       # Vite dev server on :5173
```

Open <http://localhost:5173>.

Alternative (no Docker):

```bash
cd api
npm run dev                       # in-memory 40-city seed
# in another terminal:
cd web
npm run dev
```

## Local Build Steps

```bash
npm run build                     # builds shared/, api/, web/
```

The web build emits `web/dist/` (gzipped JS ~62 kB, CSS ~5 kB) and
`netlify/functions/proxy.ts` is auto-bundled by Netlify.

## Local Validation Steps

```bash
npm run lint                      # ESLint across all 4 workspaces
npm run typecheck                 # tsc --noEmit across all 4 workspaces
npm test                          # Vitest unit + integration
npm -w @relocatewise/web run e2e  # Playwright E2E (boots API + preview)
docker build -f api/Dockerfile -t relocatewise-api:ci-smoke .
```

## Docker Build Instructions

The api image is built from the repo root (so the build context
includes `shared/` and `db/`):

```bash
docker build -f api/Dockerfile -t relocatewise-api:latest .
```

Multi-stage build: `node:20-alpine` build stage, slim runtime with
`dist/`, `node_modules/` (pruned), `db/`, and `shared/dist/`.

## Docker Compose Instructions

```bash
docker compose up -d
docker compose ps
docker compose logs -f api
```

The first boot:
1. Spins up Postgres+PostGIS on a named volume `pgdata`.
2. The api container waits for the `db` healthcheck.
3. The api runs migrations + idempotent seed.
4. Caddy reverse-proxies `api:3000` on host `:8080` (HTTP) and `:8443` (HTTPS in prod).

## Production Deployment Steps

### Frontend — Netlify

1. Sign in to <https://app.netlify.com>.
2. **Add new site → Import an existing project** → GitHub.
3. Select the RelocateWise repo.
4. **Site configuration → Build & deploy**:
   - Base directory: `web`
   - Build command: `npm run build`
   - Publish directory: `dist`
   - Functions directory: `netlify/functions`
   - Node version: `20` (set in `.env` or build image settings)
5. **Environment variables**:
   - `API_ORIGIN` = `https://api.<ceo-domain>`
   - `API_SECRET` = `(openssl rand -hex 32)` — share with the Ubuntu server
   - `NODE_VERSION` = `20`
6. **Deploy site**. First build takes 2-4 min.
7. (Optional) Add a custom domain: `Domain settings → Add a domain alias`.

### Backend — Ubuntu server

```bash
ssh root@<server-ip>

# 1. Install Docker
apt update && apt -y install ca-certificates curl gnupg
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" > /etc/apt/sources.list.d/docker.list
apt update && apt -y install docker-ce docker-ce-cli containerd.io docker-compose-plugin
docker --version && docker compose version

# 2. Clone the repo
mkdir -p /srv/relocatewise
cd /srv/relocatewise
git clone <your-github-repo-url> .

# 3. Configure the production .env
cat > /srv/relocatewise/.env <<EOF
POSTGRES_USER=relocatewise
POSTGRES_PASSWORD=$(openssl rand -hex 24)
POSTGRES_DB=relocatewise
CORS_ORIGIN=https://<ceo-domain>,https://<site>.netlify.app
GIT_SHA=$(git -C /srv/relocatewise rev-parse --short HEAD)
API_SECRET=<the same value as Netlify's>
EOF
chmod 600 /srv/relocatewise/.env

# 4. Set the CEO domain
echo 'export CEO_DOMAIN=<ceo-domain>' > /etc/profile.d/relocatewise.sh
echo 'export API_DOMAIN=api.<ceo-domain>' >> /etc/profile.d/relocatewise.sh
. /etc/profile.d/relocatewise.sh

# 5. Open the firewall
ufw allow 22/tcp
ufw allow 80/tcp    # ACME HTTP-01 challenge
ufw allow 443/tcp   # HTTPS
ufw enable

# 6. Bring the stack up
cd /srv/relocatewise
docker compose up -d
```

## Rollback Procedures

### Frontend
Netlify keeps a deploy history. To roll back:
- **Deploys → Publish deploy → … → Publish deploy** to revert to a
  previous build. No data impact (the SPA is stateless).

### Backend
1. `ssh root@<server-ip> 'cd /srv/relocatewise && docker compose pull'`
2. `git checkout <previous-tag>` (or `git pull` to a specific commit)
3. `docker compose up -d --force-recreate api`
4. Verify: `docker compose logs -f api` and `curl https://api.<ceo-domain>/api/health`

Postgres data persists in the named `pgdata` volume; rolling back the
application code does **not** roll back the database. The seed is
idempotent (won't overwrite), so a re-seed is safe but unnecessary.

### API data restore
The 40-city dataset is versioned in git (`db/seeds/cities.json`).
To force a re-seed from scratch:
```bash
docker compose exec -T db psql -U relocatewise -d relocatewise \
  -c "TRUNCATE city_scores, cities RESTART IDENTITY CASCADE;"
docker compose restart api
```
The api's `seedIfEmpty()` no-ops because the table is empty after truncate,
so re-seeding requires running the CLI seed:
```bash
docker compose exec api npm run db:seed
```

## Backup Strategy

| Component | Backup | RPO | RTO |
|---|---|---|---|
| Postgres data | None required (build artifact) | 0 (rebuilt from git) | ~15 min (re-deploy) |
| 40-city dataset | Versioned in git (`db/seeds/cities.json`) | 0 | 0 (git checkout) |
| Code | GitHub | 0 | 0 |
| `.env` secrets | Off-server backup (1Password, etc.) | manual | manual |

The dataset is a build artifact, not a source of truth. The
`README.md` documents this explicitly. The CEO accepts this in the
MVP per `docs/Architecture.md` §10.4.

## Monitoring Recommendations

Per `docs/Architecture.md` §13, the MVP has no paid monitoring. What
is in place:

- **Liveness probe**: `GET /api/health` returns `{ ok, version, timestamp }`.
  The Dockerfile's `HEALTHCHECK` hits this every 30s.
- **Structured stdout logs** in the api container. Tailed via
  `docker compose logs -f api`. Rotation via the host's `logrotate`
  (Ubuntu default).
- **Netlify deploy logs** and **function logs** in the Netlify
  dashboard (free).
- **GitHub Actions** retains CI logs for 90 days (free tier).

**Recommended additions** (post-MVP, all free):
- Set up [UptimeRobot](https://uptimerobot.com) (free) to ping
  `https://<ceo-domain>/api/health` every 5 min and email on failure.
- Set up [BetterStack](https://betterstack.com) free tier (50 MB log
  ingest) to ship the api container's stdout to a queryable
  dashboard. Requires setting a `LOG_DESTINATION` env var in the
  api container.

## Logging Recommendations

The API already emits structured JSON to stdout (one event per
request via Fastify's default logger). For better searchability,
recommend the following convention (no code change required — just
grep-friendly messages):

- `request:method=POST path=/api/match status=200 duration_ms=42` —
  one line per request, easy to grep for slow requests or error
  status codes.
- Server errors emit stack traces which are also captured by the
  default Fastify error handler.

For the SPA, the client only emits a single console warning per
session (when the consent banner is shown). No user-identifying
data is logged, in line with the GDPR-aligned privacy posture.

## Operational Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Ubuntu server hardware failure | Low | High (single point of failure, no failover) | RPO=0, RTO=~15 min. Provision a 2nd VM in a different region; update DNS A record. |
| Postgres data corruption (theoretical, since data is rebuilt from git) | Very low | Low | Re-seed from `db/seeds/cities.json` |
| Netlify outage | Low | Medium (frontend down) | The Netlify function proxies to Ubuntu — if Netlify is down, the SPA can still serve cached assets. Direct API calls from the browser fail; redirect to a status page. |
| Let's Encrypt renewal failure | Low | High (cert expires, browser shows untrusted) | Caddy auto-renews; set up UptimeRobot to ping `/api/health` over HTTPS; alert on cert expiry. |
| Shared secret leak | Low | High (any client can call API) | Rotate `API_SECRET` in both Netlify env and the Ubuntu `.env`, redeploy Netlify, then `docker compose up -d --force-recreate api`. No data loss. |
| Database connection exhaustion | Very low (40 cities, 280 score rows) | Medium | The api uses `pg.Pool` with `max: 5` connections. Add PgBouncer for future scale. |
| DDoS | Low (no public IP exposed except via Netlify) | Medium | Netlify absorbs L3/L4 attacks at the edge. Add a 5s rate limit at the Ubuntu API if abuse is observed. |