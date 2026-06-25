# RelocateWise

A web-based decision-support tool for relocation. Answer a short questionnaire about climate, cost, career, and community priorities; get a ranked shortlist of cities that match.

This is the **Minimum Viable Product** described in `docs/PRD.md` and implemented per `docs/Architecture.md`. The dominant constraints: a **3-day delivery window** and a **$0 tooling budget**.

---

## Quick start

You have two equivalent local paths. Both end up with the SPA on <http://localhost:5173> and the API on <http://localhost:3000> — the SPA uses **relative `/api/*` URLs** and the Vite dev server proxies them to the API (configured in `web/vite.config.ts`). Pick the path that matches your environment.

### Option A — full local stack with Docker (recommended)

This is what CI runs against and what the production stack mirrors. Postgres+PostGIS, the Fastify API, and Caddy all come up in one command.

```bash
# 1. Clone and install (one-time).
git clone <your-repo-url> relocatewise
cd relocatewise
npm install

# 2. Bring up Postgres + PostGIS, the Fastify API, and Caddy.
docker compose up -d
```

The first boot applies the migration in `db/migrations/001_init.sql` and seeds the 40-city dataset automatically. The API listens on `:3000` (the `api.ports` mapping in `docker-compose.yml`) and     Caddy listens on `:8080` (mapped to container `:80`; use `:8443` for TLS).

```bash
# 3. In another terminal, run the SPA in dev mode.
cd web
npm install
npm run dev
```

Open <http://localhost:5173>.

### Option B — no Docker, in-memory seed (fastest for a quick look)

If you don't want to install Docker, the API falls back to the in-memory seed (40 cities, identical dataset). The shape of the dev workflow is the same.

```bash
# 1. Clone and install (one-time).
git clone <your-repo-url> relocatewise
cd relocatewise
npm install

# 2. Run the API in one terminal.
cd api
npm run dev   # listens on :3000, no DB needed, in-memory seed
```

```bash
# 3. In another terminal, run the SPA.
cd web
npm install
npm run dev
```

Open <http://localhost:5173>.

### Option C — point the SPA at a different API host

To use a remote API (e.g. a staging server, or a teammate's local box):

```bash
cd web
VITE_API_BASE=https://staging.example.com npm run dev
```

`VITE_API_BASE` is the only SPA-side override. The Vite proxy is bypassed because the SPA now calls the absolute URL directly.

### Verify the local stack is wired correctly

Once the SPA is up at <http://localhost:5173>, run these checks in a third terminal. If they all return the expected values, the whole pipeline is working.

```bash
# 1. The SPA itself is up.
curl -sI http://localhost:5173/ | head -1
# → HTTP/1.1 200 OK

# 2. The API is up, directly on its port.
curl -s http://localhost:3000/api/health
# → {"ok":true,"version":"<git-sha>","timestamp":"..."}

# 3. The Vite proxy is forwarding /api/* to the API.
curl -s http://localhost:5173/api/cities | python3 -c "import sys, json; print(len(json.load(sys.stdin)['cities']))"
# → 40

# 4. The matching engine round-trips a profile (should return 10).
curl -s -X POST -H 'Content-Type: application/json' \
  -d '{"climate":"mediterranean","career_industry":"tech","lifestyle_tags":["urban","coastal"]}' \
  http://localhost:3000/api/match | python3 -c "import sys, json; print(len(json.load(sys.stdin)['results']))"
# → 10
```

Now open <http://localhost:5173> in a browser. The expected first-visit flow:

1. **Consent banner** appears at the top (no cookies set; click *Accept* or *Decline*).
2. **Landing page** shows the one-sentence value prop and a **Start the questionnaire** button.
3. **Questionnaire** has 8 sections (climate, cost, housing, career, education, healthcare, lifestyle, safety). You can *Skip* any question.
4. **Results** page shows your top 10 matches as cards with a 0–100 score and a templated "why this fits you" line.
5. **Add to compare** on any 2 or 3 cards, then click the **Compare** link in the header to see the side-by-side table with the best per row highlighted.
6. **View full profile** on any card to see the 8 dimension bars and the qualitative description.

If step 2 or 3 fails, the issue is the API → Vite proxy. Check the `proxy: { '/api': … }` block in `web/vite.config.ts` and confirm the API is reachable on `localhost:3000`.

### Optional: use Caddy on `:8080` instead of the direct API port

If you'd rather have the SPA talk to the production-shaped stack (Caddy-fronted), set the proxy target to the Caddy port. The Caddy container exposes host `:8080` (mapped to container `:80`; use `:8443` for TLS in production):

```bash
cd web
API_PROXY_TARGET=http://localhost:8080 npm run dev
```

The SPA still uses relative URLs and Vite still proxies — but the target is now Caddy on `:8080` instead of the API on `:3000`. In dev this only matters if you want to exercise Caddy's behaviour (e.g. response compression) before deploying.

---

## Repository layout

```
.
├── api/                       Node 20 + Fastify + TypeScript
│   ├── src/
│   │   ├── server.ts          App builder + bootstrap (DB on/off)
│   │   ├── routes/            /api/health, /api/cities, /api/cities/:slug, /api/match
│   │   ├── matching/          Pure deterministic engine + "why" templating
│   │   │   ├── score.ts       8-dimension scoring, weight normalization
│   │   │   ├── why.ts         Templated "why this fits you" (Architecture §6.5)
│   │   │   ├── defaults.ts    Default weights for skipped questions
│   │   │   └── result.ts      Wire-format projection
│   │   ├── db/
│   │   │   ├── repository.ts  In-memory CityRepository + CityRepository interface
│   │   │   ├── cache.ts       60s TTL wrapper (Architecture §5.2)
│   │   │   ├── pool.ts        pg.Pool factory
│   │   │   ├── postgres.repository.ts  PostgresCityRepository + PostGIS
│   │   │   ├── migrate.ts     SQL migration runner
│   │   │   ├── seed.ts        Idempotent boot-time seed
│   │   │   └── cities.seed.ts 40-city dataset (TS source of truth)
│   │   └── schemas/           Zod request validation
│   ├── test/                  Vitest (incl. testcontainers + Postgres)
│   ├── scripts/               export-cities-json.ts (rebuilds db/seeds/cities.json)
│   └── Dockerfile
│
├── web/                       React 18 + Vite + TypeScript SPA
│   ├── src/
│   │   ├── App.tsx            Router + ConsentBanner + footer
│   │   ├── pages/             Landing, ProfileForm, Results, Compare, City, Privacy, NotFound
│   │   ├── components/        ProfileForm, RankCard, CityDimensions, ConsentBanner, …
│   │   ├── state/shortlist.tsx Session-scoped compare shortlist (max 3)
│   │   └── api.ts             Typed client for the 4 API endpoints
│   └── test/                  Vitest + Testing Library
│
├── shared/                    TypeScript types shared between api/ and web/
│   ├── types.ts               UserProfile, City, MatchResult, ApiError
│   └── climate.ts             Climate compatibility table (Architecture §15 OAD 1)
│
├── db/
│   ├── migrations/001_init.sql  Schema with PostGIS extension
│   └── seeds/cities.json        Versioned 40-city source of truth
│
├── docs/                      Vision, Constraints, PRD, Architecture
│
├── docker-compose.yml             api + db + caddy (local + production)
├── docker-compose.cloudflared.yml Production overlay: adds the cloudflared tunnel daemon
├── cloudflared/                   Tunnel config sample (production deploy)
├── Caddyfile                      TLS reverse proxy
├── web/wrangler.toml              Cloudflare Pages project config
├── .dockerignore                  Keeps the API image build context small
├── .github/workflows/ci.yml       CI: typecheck, test, build, smoke build
├── .github/workflows/deploy-pages.yml  Manual Cloudflare Pages deploy
├── .env.example                   Local development env defaults
└── README.md
```

---

## API surface

| Method | Path                | Purpose                                            |
| ------ | ------------------- | -------------------------------------------------- |
| GET    | `/api/health`       | Liveness probe — `{ ok, version, timestamp }`      |
| GET    | `/api/cities`       | List all cities (slim projection)                  |
| GET    | `/api/cities/:slug` | One city profile, 404 if unknown                   |
| POST   | `/api/match`        | Rank cities from a `UserProfile`, top 10 returned  |

All responses are `application/json`. All errors return `{ error: string, message: string }` with an appropriate HTTP status.

---

## Environment variables

| Var               | Scope             | Required          | Default                  | Notes                                              |
| ----------------- | ----------------- | ----------------- | ------------------------ | -------------------------------------------------- |
| `DATABASE_URL`    | API               | In production     | unset → in-memory seed   | `postgres://user:pass@host:5432/db`                |
| `PORT`            | API               |                   | `3000`                   | API listen port                                    |
| `HOST`            | API               |                   | `0.0.0.0`                | API bind address                                   |
| `GIT_SHA`         | API               |                   | auto via `git rev-parse` | Returned by `/api/health`                          |
| `CORS_ORIGIN`     | API               | In production     | echo any (dev)           | Comma-separated allowed origins                    |
| `VITE_API_BASE`   | SPA dev/build     |                   | unset → relative `/api/*` (uses Vite proxy in dev, Cloudflare Pages routing in prod) | Override the API base; set to a full URL to point at a remote API. |
| `API_PROXY_TARGET` | Vite dev only     |                   | `http://localhost:3000`  | Where Vite forwards `/api/*` in dev. Set to `http://localhost:8080` to use Caddy on host :8080 instead. |
| `CLOUDFLARE_API_TOKEN` | GitHub Actions  | For deploy workflow | unset                  | Cloudflare API token with `Pages: Edit` + `Account: Read` permissions. |
| `CLOUDFLARE_ACCOUNT_ID` | GitHub Actions  | For deploy workflow | unset                  | Cloudflare account ID for the deploy-pages workflow. |

The `docker-compose.yml` reads `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `CORS_ORIGIN`, and `GIT_SHA` from the host environment (or `.env` at the project root). See `.env.example` for local defaults.

---

## Tests

```bash
npm test           # all workspaces (api + web)
```

The `api` workspace includes a testcontainers-based integration test that spins up a real `postgis/postgis:16-3.4-alpine` container per run. It is **skipped** when the Docker socket at `/var/run/docker.sock` is absent (CI runners without Docker, or contributors on hosts without Docker). On a developer machine with Docker installed the suite takes ~10 s longer; in CI on a GitHub-hosted runner it's already a normal step.

A small drift check (`cities.seed-sync.test.ts`) keeps the in-memory TS array and the versioned `db/seeds/cities.json` byte-identical. Re-run `npm -w @relocatewise/matching-service run db:export` after any edit to `cities.seed.ts`.

### Backend workspace layout (Phase B, v1.0.0 GA)

The `api/` directory is split into three sibling npm workspaces (per `docs/Architecture.md` v1.4.0 §8):

| Workspace | Role |
| --- | --- |
| `@relocatewise/matching-service` | Owns the `matching` schema, the public REST surface, and the bearer-token-gated internal sync endpoint. |
| `@relocatewise/ingestion-service` | Owns the `ingestion` schema, the cron scheduler, and the HTTP-backed scores writer that PUTs to the matching service's internal endpoint. |
| `@relocatewise/gateway` | The only service on the public ingress. Refuses to forward `/api/internal/*` from any source (ITC-9 step 3). |

The shared `@relocatewise/shared` package holds the types and climate tables that both services consume.

Run any workspace's tests in isolation:

```bash
npm -w @relocatewise/matching-service test
npm -w @relocatewise/ingestion-service test
npm -w @relocatewise/gateway test
```

Each workspace has its own `Dockerfile` and README; see the workspace-level docs for inputs/outputs/API surface.

---

## Deploy

There are two deploy targets. Both must be live for the app to work end-to-end:

| Target  | Where                                     | What it serves                                            |
| ------- | ----------------------------------------- | --------------------------------------------------------- |
| Frontend | Cloudflare Pages (free tier)              | The React/Vite SPA, served from Cloudflare's global CDN |
| Backend  | CEO's Ubuntu server, Docker Compose       | The Fastify + Postgres + PostGIS API, fronted by Caddy, exposed via Cloudflare Tunnel |

The two are connected by a single HTTPS call: the browser talks to the Cloudflare Pages deployment, which (for `/api/*`) routes calls through Cloudflare Tunnel to the Ubuntu API.

### Frontend — Cloudflare Pages

#### Prerequisites

- A GitHub repository containing this code (the user has the local checkout; push it up first).
- A Cloudflare account (<https://dash.cloudflare.com>). The free tier is enough.
- The backend **must already be deployed and reachable** via the Cloudflare Tunnel hostname (see [Backend — Ubuntu server](#backend--ubuntu-server) below). Cloudflare Pages won't be able to serve `/api/*` until the tunnel is up.

#### 1. Connect the repo

1. Sign in to <https://dash.cloudflare.com>.
2. Go to **Workers & Pages → Create application → Pages → Connect to Git**.
3. Pick the GitHub repo and authorize Cloudflare to read it.
4. Select the RelocateWise repository.

#### 2. Configure build settings

`web/wrangler.toml` pins the project name (`relocatewise`). In the Pages project **Settings → Builds**:

| Setting               | Value          | Notes                                       |
| --------------------- | -------------- | ------------------------------------------- |
| Build command         | `npm run build` | Runs `tsc -b && vite build` via the workspace `npm run build` |
| Build output directory| `dist`         | Vite's default output                       |
| Root directory        | `web`          | Where the SPA's `package.json` lives         |
| Environment variables | `NODE_VERSION=20` | Forces Node 20 in the build env          |

#### 3. Configure `/api/*` routing

In the Pages project → **Settings → Functions → Routes**, add:
- Route: `/api/*`
- Worker / Function: `relocatewise-api-proxy` (a Cloudflare Worker that
  forwards `/api/*` requests to `https://api.<ceo-domain>`).

The Worker source is trivial (see `artifacts/Deployment_Report.md` for the
exact code). Cloudflare then maps the Worker to the `/api/*` route on
your Pages project.

#### 4. (Optional) Custom domain

In Cloudflare DNS, add a CNAME for `<ceo-domain>` pointing at
`<project>.pages.dev`. Cloudflare provisions a Let's Encrypt cert
automatically.

#### 5. (Optional) Manual deploy from the CEO's machine

```bash
cd web
npm ci
npm run build
npx wrangler pages deploy ./dist --project-name=relocatewise --branch=main
```

The deploy requires `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`
in the environment.

#### 6. (Recommended) Enable Deploy Previews

Under **Settings → Build configurations**, enable **Preview deployments**
for non-`main` branches. Every PR gets its own preview URL that runs
against the production tunnel.

#### 7. Smoke-test the deployment

Once the first deploy is green, run through this checklist (everything
should take under 60 seconds):

```bash
# Replace <project> with your Cloudflare Pages subdomain (or your
# custom <ceo-domain>).

# 1. SPA loads.
curl -sI https://<project>.pages.dev/ | head -1
# → HTTP/2 200

# 2. Health endpoint (proxied through the tunnel).
curl -s https://<project>.pages.dev/api/health
# → {"ok":true,"version":"<git-sha>","timestamp":"..."}

# 3. City list (proxied).
curl -s https://<project>.pages.dev/api/cities | python3 -c "import sys, json; print(len(json.load(sys.stdin)['cities']))"
# → 40

# 4. Single city (proxied + cached for 60s on the second call).
curl -s https://<project>.pages.dev/api/cities/lisbon-pt | python3 -c "import sys, json; print(json.load(sys.stdin)['slug'])"
# → lisbon-pt

# 5. Match endpoint (proxied + bilingual).
curl -s -X POST -H 'Content-Type: application/json' \
  -d '{"climate":"mediterranean","language":"zh","lifestyle_tags":["urban","coastal"]}' \
  https://<project>.pages.dev/api/match | python3 -c "import sys, json; r=json.load(sys.stdin); print(r['results'][0]['why_key'])"
# → community
```

If any of these fail, the problem is almost always one of:

- **CORS** — the Ubuntu API's `CORS_ORIGIN` env var doesn't include the Pages domain. Fix: update `CORS_ORIGIN` on the server and `docker compose up -d` to pick it up.
- **Tunnel unreachable** — `cloudflared` isn't running. Check `docker logs relocatewise-cloudflared`.
- **Wrong tunnel hostname** — the Pages `/api/*` → tunnel hostname mapping isn't set up. Fix: configure it in the Pages Functions routing dashboard.

### Backend — Ubuntu server (Cloudflare Pages + Tunnel topology)

The MVP backend is exposed to the internet through a Cloudflare Tunnel
(see `Architecture v1.3.0` §2). No inbound ports need to be opened on
the host firewall — the `cloudflared` daemon initiates the tunnel
outbound-only.

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

Then copy `cloudflared/CONFIG.example.yml` from this repo to
`~/.cloudflared/config.yml` and substitute `<TUNNEL-UUID>` and
`<DOMAIN>` with the values from step 2.

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

# Git SHA returned by /api/health. The deploy script updates this.
GIT_SHA=$(git -C /srv/relocatewise rev-parse --short HEAD)

# Ingestion cadence (default monthly at 03:00 UTC on the 1st).
INGESTION_CRON=0 3 1 * * *
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

This starts `db` (PostGIS), `api` (Fastify), `caddy` (internal Docker
network only — no host port mappings), and `cloudflared` (outbound
tunnel to Cloudflare's edge).

The first boot pulls four images:
- `postgis/postgis:16-3.4-alpine` (~80 MB)
- `node:20-alpine` (build stage, ~50 MB; the runtime image is built locally)
- `caddy:2-alpine` (~40 MB)
- `cloudflare/cloudflared:2026.6.1` (~50 MB)

The API container then runs migrations (`db/migrations/001_init.sql`)
and seeds the 40-city dataset. **This is idempotent** — re-running on
a database that already has data is a no-op.

#### 6. Smoke-test the API

```bash
# Direct (local) — should work without the tunnel.
curl -s http://localhost:3000/api/health

# Via the tunnel — should also work and be encrypted.
curl -s https://api.<ceo-domain>/api/health
```

If the tunnel is up but the Cloudflare proxy returns 502, check
`docker logs relocatewise-cloudflared`. The most common cause is
incorrect tunnel credentials or hostname misconfiguration.

#### 7. Subsequent deploys

The CEO (or whoever has SSH access) runs one command on the server:

```bash
ssh root@<server-ip> 'cd /srv/relocatewise && git pull && \
  docker compose -f docker-compose.yml -f docker-compose.cloudflared.yml pull && \
  docker compose -f docker-compose.yml -f docker-compose.cloudflared.yml up -d'
```

This rebuilds the API image with the latest code, runs any new
migrations, and restarts the containers. Postgres data is preserved on
the named volume `pgdata`.

For zero-downtime deploys, the architecture doc leaves room for
`docker compose up -d --no-deps --scale api=2` followed by a rolling
restart; that's a Day-2 optimization and not in the MVP.

#### 8. Backups

None required. The dataset is in git (`db/seeds/cities.json`); the
database is a build artifact. RPO = 0, RTO = re-run
`docker compose -f docker-compose.yml -f docker-compose.cloudflared.yml up -d`
on a fresh box (~15 minutes).

### Wiring the two halves together

After both halves are deployed, verify the end-to-end loop:

```bash
# 1. SPA loads
curl -sI https://<ceo-domain>/ | head -1
# → HTTP/2 200

# 2. /api/* is proxied through Cloudflare Pages + Tunnel to the Ubuntu API
curl -s https://<ceo-domain>/api/health
# → {"ok":true,"version":"<git-sha>","timestamp":"..."}

# 3. The shared secret matches
docker logs --tail 20 relocatewise-api 2>&1 | grep -i "401\|unauthorized" || echo "no auth errors"
# → "no auth errors"
```

If step 1 returns 200 but step 2 doesn't, the issue is on the Cloudflare Pages side (Pages routing rule, or the tunnel isn't connected). If step 2 returns 200 but the SPA shows network errors in the browser, the issue is CORS (the SPA's origin isn't in `CORS_ORIGIN` on the server).

---

## Acceptance criteria (PRD §8)

| AC  | What it means                                                                          | Where it's enforced                                                 |
| --- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| 1   | First-visit end-to-end loop in under 10 minutes                                        | Manual smoke walkthrough                                            |
| 2   | Questionnaire has 8–12 questions, completable in 5 minutes                              | `web/src/components/ProfileForm.tsx`                                |
| 3   | Exactly 10 results returned                                                            | `api/src/matching/score.ts:336` (`topN ?? 10`)                      |
| 4   | Identical inputs ⇒ identical ranking                                                   | Pure function; `api/test/matching.score.test.ts`                    |
| 5   | Each result card shows city/country/score/why                                          | `web/src/components/RankCard.tsx`                                   |
| 6   | City profile shows 8 dimensions + description + last_updated                           | `web/src/pages/CityPage.tsx`, `api/src/routes/city.ts`              |
| 7   | Max 3 cities in shortlist; 4th is rejected                                             | `web/src/state/shortlist.tsx:26` (`SHORTLIST_MAX = 3`)              |
| 8   | Comparison view highlights best per row                                                 | `web/src/pages/ComparePage.tsx:163` (`--best` class)                |
| 9   | Submit or tab-close clears the shortlist                                               | Shortlist lives in React state, not storage                         |
| 10  | No personal data leaves the server                                                     | API logs no body / IP / UA; questionnaire discarded after response  |
| 11  | Consent banner on first visit, no cookies before consent                               | `web/src/components/ConsentBanner.tsx`                              |
| 12  | Privacy page linked from footer and banner                                             | `web/src/App.tsx`, `ConsentBanner.tsx`                              |
| 13  | Single-command Docker Compose startup, documented                                       | `docker compose up` + this README                                   |
| 14  | Public URL on free tier with HTTPS                                                      | Cloudflare Pages + Tunnel (deploy steps above)                       |
| 15  | CI runs typecheck + tests + smoke build on every push to `main`                        | `.github/workflows/ci.yml`                                          |

---

## Troubleshooting

- **API returns `invalid_profile` (HTTP 400)** — the Zod schema rejected the request body. The `details` array in the response tells you which field. Check `api/src/schemas/profile.ts` for the allowed values.
- **`/api/health` returns `version: dev`** — the API process couldn't find a `.git` directory. Set `GIT_SHA` explicitly in the env, or ensure the repo is cloned (not downloaded as a tarball).
- **`docker compose up` fails on the API with `connect ECONNREFUSED 127.0.0.1:5432`** — the `db` service isn't healthy yet. Wait 10 seconds and retry, or run `docker compose up -d db` first, then `docker compose up -d api caddy`.
- **Caddy says `msg="no certificate available"`** — the DNS A record isn't pointing at this server, or the port-80 ACME challenge is blocked. Verify with `dig api.<ceo-domain> +short` and `curl -v http://api.<ceo-domain>/.well-known/acme-challenge/test`.
- **Cloudflare Pages returns 502 for `/api/*`** — the `/api/*` → tunnel routing rule isn't set up in the Pages Functions routing dashboard. Verify the Worker is bound to `/api/*` and that it forwards to `https://api.<ceo-domain>`.
- **CORS error in the browser console** — the SPA's origin is missing from the API's `CORS_ORIGIN`. Update `.env` and `docker compose up -d` to reload.

---

## Further reading

- `docs/Vision.md` — what the product is and isn't.
- `docs/PRD.md` — requirements, scope, and acceptance criteria.
- `docs/Constraints.md` — the budget and technology boundaries.
- `docs/Architecture.md` — the technical design (this README defers to it for depth).
- `docs/Database.md` — PostgreSQL and PostGIS database schema and configuration.
- `docs/API_Spec.md` — API endpoints, payloads, validation, caching, and rate limits.
- `docs/Module_Map.md` — monorepo structure and package boundaries.
