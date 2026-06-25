# RelocateWise

A web-based decision-support tool for relocation. Answer a short questionnaire about climate, cost, career, and community priorities; get a ranked shortlist of cities that match.

This is the **GA v1.0** release described in `docs/PRD.md` and implemented per `docs/Architecture.md`. The dominant constraints: a **modular micro-frontend + micro-service monorepo** and a **$0 tooling budget**.

---

## ⚠️ Read this first — monorepo layout

The repository is a **npm workspaces monorepo with 8 sibling workspaces**, declared in the root `package.json` `workspaces` array. The two top-level directories (`api/` and `web/`) are **not** themselves workspaces — they're **parents** of multiple sibling workspaces each. Always run npm commands from the **repo root** unless you target a specific workspace with `npm -w <name>`.

```
.                                ← run `npm install`, `npm test`, `npm run build` here
├── shared/                     → @relocatewise/shared
├── api/                        ← NOT a workspace (just a parent directory)
│   ├── matching-service/       → @relocatewise/matching-service
│   ├── ingestion-service/      → @relocatewise/ingestion-service
│   └── gateway/                → @relocatewise/gateway
└── web/                        ← NOT a workspace (just a parent directory)
    ├── container/              → @relocatewise/web-container
    ├── quiz-mfe/               → @relocatewise/web-quiz-mfe
    ├── compare-mfe/            → @relocatewise/web-compare-mfe
    └── dashboard-mfe/          → @relocatewise/web-dashboard-mfe
```

> If you `cd api` or `cd web` and run `npm install` / `npm run dev`, npm will fail with `ENOENT … no such file or directory … package.json`. Each of those folders now ships a stub `package.json` (see `api/package.json` and `web/package.json`) that explains the redirect. Always run commands from the repo root.

---

## Quick start

You have two equivalent local paths. Both end up with the SPA on <http://localhost:5173> and the API on <http://localhost:3000> — the SPA uses **relative `/api/*` URLs** and the Vite dev server proxies them to the API (configured in `web/container/vite.config.ts`). Pick the path that matches your environment.

### Option A — full local stack with Docker (recommended)

This is what CI runs against and what the production stack mirrors. Postgres+PostGIS, the three Fastify microservices (matching / ingestion / gateway), and the cloudflared tunnel all come up in one command.

```bash
# 1. Clone and install (one-time) — ALWAYS from the repo root.
git clone <your-repo-url> relocatewise
cd relocatewise
npm install

# 2. Bring up Postgres + PostGIS, the three microservices, and cloudflared.
docker compose -f docker-compose.yml -f docker-compose.cloudflared.yml up -d
```

The first boot applies the migrations in `db/migrations/` and seeds the 40-city dataset automatically. The gateway listens on `:3000` (mapped via `gateway.ports` in `docker-compose.yml`); only the gateway is on the public ingress.

```bash
# 3. In another terminal, run the SPA in dev mode — from the repo root, with `-w`.
npm -w @relocatewise/web-container run dev
```

Open <http://localhost:5173>.

### Option B — no Docker, in-memory seed (fastest for a quick look)

If you don't want to install Docker, the matching service falls back to the in-memory seed (40 cities, identical dataset). The shape of the dev workflow is the same.

```bash
# 1. Clone and install (one-time) — ALWAYS from the repo root.
git clone <your-repo-url> relocatewise
cd relocatewise
npm install

# 2. Run the API services in one terminal (3 sibling workspaces).
npm -w @relocatewise/matching-service run dev   # matching service on :3000
# Optional second terminal:
npm -w @relocatewise/ingestion-service run dev  # ingestion worker + cron
npm -w @relocatewise/gateway run dev            # gateway on :3001 → forwards to matching
```

```bash
# 3. In another terminal, run the SPA.
npm -w @relocatewise/web-container run dev
```

Open <http://localhost:5173>. For dev simplicity, point the SPA's Vite proxy at the matching service directly:

```bash
# Optional: bypass the gateway for local dev.
API_PROXY_TARGET=http://localhost:3000 npm -w @relocatewise/web-container run dev
```

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

If step 2 or 3 fails, the issue is the API → Vite proxy. Check the `proxy: { '/api': … }` block in `web/container/vite.config.ts` and confirm the API is reachable on `localhost:3000`.

---

## Workspace map (8 npm workspaces, declared in root `package.json`)

| Workspace | Directory | Role |
| --- | --- | --- |
| `@relocatewise/shared` | `shared/` | TypeScript types + climate compatibility table consumed by every other workspace. |
| `@relocatewise/matching-service` | `api/matching-service/` | Owns the `matching` PostgreSQL schema. Exposes the public REST surface (`/api/health`, `/api/cities`, `/api/cities/:slug`, `POST /api/match`) and the bearer-token-gated `PUT /api/internal/cities/:slug/scores`. |
| `@relocatewise/ingestion-service` | `api/ingestion-service/` | Owns the `ingestion` PostgreSQL schema. Runs the cron scheduler, fetches raw indicators from primary sources, and pushes normalised scores to the matching service via its internal sync endpoint. |
| `@relocatewise/gateway` | `api/gateway/` | The only service on the public ingress. Forwards the four public endpoints to the matching service and **refuses** `/api/internal/*` from any source (ITC-9 step 3). |
| `@relocatewise/web-container` | `web/container/` | The host shell. Owns the router, i18n bootstrap, global providers (toast, shortlist), and lazy-loads the three MFEs via `React.lazy(() => import('@relocatewise/web-{quiz,compare,dashboard}-mfe'))`. |
| `@relocatewise/web-quiz-mfe` | `web/quiz-mfe/` | The 8-step ProfileForm wizard. Dispatches a `rw:quiz_completed` Custom Event on submit. |
| `@relocatewise/web-compare-mfe` | `web/compare-mfe/` | The side-by-side comparison matrix with the best-per-row highlight. |
| `@relocatewise/web-dashboard-mfe` | `web/dashboard-mfe/` | The ranked results page + the city profile page. |

### Run any workspace in isolation

```bash
# Tests
npm -w @relocatewise/matching-service test
npm -w @relocatewise/ingestion-service test
npm -w @relocatewise/gateway test
npm -w @relocatewise/web-container test
npm -w @relocatewise/web-quiz-mfe test
npm -w @relocatewise/web-compare-mfe test
npm -w @relocatewise/web-dashboard-mfe test

# Dev / build / lint / typecheck — replace `test` with the script name.
npm -w @relocatewise/web-container run dev
npm -w @relocatewise/matching-service run build
```

Each workspace has its own `Dockerfile` and `README.md` documenting its inputs, outputs, API surface, and event contracts.

---

## Repository layout

```
.
├── api/                              Parent of the 3 API workspaces (NOT itself a workspace)
│   ├── package.json                  Redirect stub — see "Read this first" above
│   ├── matching-service/             @relocatewise/matching-service
│   │   ├── src/                      Fastify server + routes + matching engine + DB layer
│   │   ├── test/                     Vitest + Supertest (testcontainers)
│   │   ├── Dockerfile
│   │   └── README.md
│   ├── ingestion-service/            @relocatewise/ingestion-service
│   │   ├── src/                      Cron scheduler + ingestion orchestrator + HTTP scores writer
│   │   ├── test/
│   │   ├── Dockerfile
│   │   └── README.md
│   └── gateway/                      @relocatewise/gateway
│       ├── src/                      Minimal Fastify reverse proxy (refuses /api/internal/*)
│       ├── test/
│       ├── Dockerfile
│       └── README.md
│
├── web/                              Parent of the 4 web workspaces (NOT itself a workspace)
│   ├── package.json                  Redirect stub — see "Read this first" above
│   ├── wrangler.toml                 Cloudflare Pages project config
│   ├── playwright.config.ts          E2E test runner config
│   ├── e2e/                          Playwright specs (shared across all web workspaces)
│   ├── container/                    @relocatewise/web-container
│   │   ├── src/                      App shell, router, i18n, providers, container-rendered pages
│   │   ├── test/
│   │   └── README.md
│   ├── quiz-mfe/                     @relocatewise/web-quiz-mfe
│   ├── compare-mfe/                  @relocatewise/web-compare-mfe
│   └── dashboard-mfe/                @relocatewise/web-dashboard-mfe
│
├── shared/                           @relocatewise/shared (single workspace)
│   ├── types.ts                      UserProfile, City, MatchResult, ApiError
│   └── climate.ts                    Climate compatibility table
│
├── db/
│   ├── migrations/                   Schema DDL (PostGIS + matching/ingestion schemas)
│   └── seeds/cities.json             Versioned 40-city source of truth
│
├── docs/                             Vision, Constraints, PRD, Architecture
│
├── docker-compose.yml                3 api services + db
├── docker-compose.cloudflared.yml    Production overlay: adds the cloudflared tunnel daemon
├── cloudflared/                      Tunnel config sample (production deploy)
├── .dockerignore                     Keeps the API image build context small
├── .github/workflows/ci.yml          CI: typecheck, test, build, smoke build
├── .github/workflows/deploy-pages.yml  Manual Cloudflare Pages deploy
├── .env.example                      Local development env defaults
├── package.json                      Root workspace manifest (the 8 workspaces)
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
| `DATABASE_URL`    | matching-service  | In production     | unset → in-memory seed   | `postgres://user:pass@host:5432/db`                |
| `PORT`            | matching-service  |                   | `3000`                   | matching-service listen port                       |
| `HOST`            | matching-service  |                   | `0.0.0.0`                | Bind address                                       |
| `GIT_SHA`         | matching-service  |                   | auto via `git rev-parse` | Returned by `/api/health`                          |
| `CORS_ORIGIN`     | matching-service  | In production     | echo any (dev)           | Comma-separated allowed origins                    |
| `INGESTION_TARGET_URL` | ingestion-service | In production  | unset → noop scores writer | The matching-service base URL the ingestion worker PUTs to. |
| `INGESTION_TARGET_TOKEN` | ingestion-service | In production | unset → noop scores writer | The bearer token the ingestion worker sends. |
| `INGESTION_DISABLED` | ingestion-service |               | enabled                   | Skip the scheduled ingestion worker.               |
| `INGESTION_CRON`  | ingestion-service |                   | `0 3 1 * *` (monthly)    | Standard 5-field `node-cron` expression.           |
| `API_SECRET`      | matching-service + gateway | Optional | unset → free pass      | Shared secret for the gateway's x-relocatewise-secret gate and the matching service's `/api/internal/*` bearer. |
| `VITE_API_BASE`   | web-container     |                   | unset → relative `/api/*` | Override the API base; set to a full URL.        |
| `API_PROXY_TARGET` | web-container dev only |            | `http://localhost:3000`  | Where Vite forwards `/api/*` in dev.               |
| `CLOUDFLARE_API_TOKEN` | GitHub Actions | For deploy workflow | unset                  | Cloudflare API token.                              |
| `CLOUDFLARE_ACCOUNT_ID` | GitHub Actions | For deploy workflow | unset                  | Cloudflare account ID.                             |

---

## Tests

```bash
npm test           # all 8 workspaces
```

Each workspace runs its own `vitest` suite. The matching-service includes a testcontainers-based integration test that spins up a real `postgis/postgis:16-3.4-alpine` container per run. It is **skipped** when the Docker socket at `/var/run/docker.sock` is absent.

A small drift check (`cities.seed-sync.test.ts`) keeps the in-memory TS array and the versioned `db/seeds/cities.json` byte-identical. Re-run `npm -w @relocatewise/matching-service run db:export` after any edit to `cities.seed.ts`.

### E2E (Playwright)

```bash
npm -w @relocatewise/web-container run build         # build the SPA first
npm -w @relocatewise/matching-service run dev &      # api
npm -w @relocatewise/web-container run preview &     # serve dist/
npm -w @relocatewise/web-e2e exec -- npx playwright test
```

The Playwright specs live at `web/e2e/` and run against the preview build.

---

## Deploy

There are two deploy targets. Both must be live for the app to work end-to-end:

| Target  | Where                                     | What it serves                                            |
| ------- | ----------------------------------------- | --------------------------------------------------------- |
| Frontend | Cloudflare Pages (free tier)              | The React/Vite SPA (container workspace), served via Cloudflare's global CDN |
| Backend  | CEO's Ubuntu server, Docker Compose       | The 3 Fastify microservices + Postgres + PostGIS, fronted by the gateway + cloudflared |

The two are connected by a single HTTPS call: the browser talks to the Cloudflare Pages deployment, which (for `/api/*`) routes calls through Cloudflare Tunnel to the Ubuntu gateway.

### Frontend — Cloudflare Pages

#### Prerequisites

- A GitHub repository containing this code (the user has the local checkout; push it up first).
- A Cloudflare account (<https://dash.cloudflare.com>). The free tier is enough.
- The backend **must already be deployed and reachable** via the Cloudflare Tunnel hostname. Cloudflare Pages won't be able to serve `/api/*` until the tunnel is up.

#### 1. Connect the repo

1. Sign in to <https://dash.cloudflare.com>.
2. Go to **Workers & Pages → Create application → Pages → Connect to Git**.
3. Pick the GitHub repo and authorize Cloudflare to read it.
4. Select the RelocateWise repository.

#### 2. Configure build settings

`web/wrangler.toml` pins the project name (`relocatewise`) and the build output directory. In the Pages project **Settings → Builds**:

| Setting               | Value          | Notes                                       |
| --------------------- | -------------- | ------------------------------------------- |
| Build command         | `npm run build` | Runs the root workspace `npm run build`, which builds each web workspace in turn |
| Build output directory| `container/dist` | The container workspace's Vite output (set in `web/wrangler.toml`) |
| Root directory        | `web`          | Where the SPA lives                          |
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
# From the repo root — no `cd web` needed.
npm ci
npm -w @relocatewise/web-container run build
npx wrangler pages deploy ./container/dist --project-name=relocatewise --branch=main
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

The MVP backend is exposed to the internet through a Cloudflare Tunnel.
No inbound ports need to be opened on the host firewall — the `cloudflared`
daemon initiates the tunnel outbound-only.

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
`~/.cloudflared/config.yml` and substitute `<TUNNEL-UUID>` and `<DOMAIN>`
with the values from step 2. The example config points the tunnel at the
`gateway` container (port 3000), which is the only service on the public
ingress.

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
# Direct (local, bypassing the gateway) — should work without the tunnel.
curl -s http://localhost:3000/api/health

# Via the gateway (also local) — should work without the tunnel.
curl -s http://localhost:3001/api/health

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
  docker compose -f docker-compose.yml -f docker-compose.cloudflared.yml build && \
  docker compose -f docker-compose.yml -f docker-compose.cloudflared.yml up -d'
```

This rebuilds the 3 service images with the latest code, runs any new
migrations, and restarts the containers. Postgres data is preserved on
the named volume `pgdata`.

For zero-downtime deploys, the architecture doc leaves room for
`docker compose up -d --no-deps --scale matching=2` followed by a rolling
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

# 2. /api/* is proxied through Cloudflare Pages + Tunnel to the gateway → matching
curl -s https://<ceo-domain>/api/health
# → {"ok":true,"version":"<git-sha>","timestamp":"..."}

# 3. The shared secret matches
docker logs --tail 20 relocatewise-matching 2>&1 | grep -i "401\|unauthorized" || echo "no auth errors"
# → "no auth errors"
```

If step 1 returns 200 but step 2 doesn't, the issue is on the Cloudflare Pages side (Pages routing rule, or the tunnel isn't connected). If step 2 returns 200 but the SPA shows network errors in the browser, the issue is CORS (the SPA's origin isn't in `CORS_ORIGIN` on the server).

---

## Acceptance criteria (PRD §11)

Each AC below is verifiable in a single manual or automated test. The full table lives at `docs/Acceptance-Criteria.md`.

| AC  | What it means                                                                          | Where it's enforced                                                 |
| --- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| 1   | First-visit end-to-end loop in under 10 minutes                                        | Manual smoke walkthrough                                            |
| 2   | Questionnaire has 8–12 questions, completable in 5 minutes                              | `web/quiz-mfe/src/components/ProfileForm.tsx`                       |
| 3   | Exactly 10 results returned                                                            | `api/matching-service/src/matching/score.ts`                       |
| 4   | Identical inputs ⇒ identical ranking                                                   | Pure function; `api/matching-service/test/matching.score.test.ts`  |
| 5   | Each result card shows city/country/score/why                                          | `web/dashboard-mfe/src/components/RankCard.tsx`                    |
| 6   | City profile shows 8 dimensions + description + last_updated                           | `web/dashboard-mfe/src/components/CityPage.tsx`                     |
| 7   | Max 3 cities in shortlist; 4th is rejected                                             | `web/container/src/state/shortlist.tsx` (`SHORTLIST_MAX = 3`)       |
| 8   | Comparison view highlights best per row                                                 | `web/compare-mfe/src/ComparePage.tsx` (`--best` class)              |
| 9   | Submit or tab-close clears the shortlist                                               | Shortlist lives in React state, not storage                         |
| 10  | No personal data leaves the server                                                     | API logs no body / IP / UA; questionnaire discarded after response  |
| 11  | Consent banner on first visit, no cookies before consent                               | `web/container/src/components/ConsentBanner.tsx`                    |
| 12  | Privacy page linked from footer and banner                                             | `web/container/src/App.tsx` + `ConsentBanner.tsx`                   |
| 13  | Single-command Docker Compose startup, documented                                       | `docker compose up` + this README                                   |
| 14  | Public URL on free tier with HTTPS                                                      | Cloudflare Pages + Tunnel (deploy steps above)                      |
| 15  | CI runs typecheck + tests + smoke build on every push to `main`                        | `.github/workflows/ci.yml`                                          |
| 16  | Background ingestion job executes and updates scores                                   | `api/ingestion-service/src/jobs/ingestion.ts`                       |
| 17  | EN/中文 toggle works without page reload or state loss                                | `web/container/src/components/LanguageToggle.tsx`                   |
| 18  | Responsive mobile layout                                                                | CSS media queries in every component                                |
| 19  | Modular MFE + MS topology with segregated schemas                                      | 8 workspaces, 3 api services, 4 web workspaces                      |
| 20  | Every microservice / micro-frontend has a `README.md`                                 | Workspace-level READMEs + `web/container/test/module-readmes.test.ts` |
| 21  | Claymorphic / soft 3D neumorphism visual style                                          | `web/container/src/styles/tokens.css` + global.css                  |
| 22  | Specified color palette (lilac / off-white / pastel accents)                           | `web/container/src/styles/tokens.css`                               |
| 23  | Selected questionnaire options transition to a "pressed" state                          | `web/quiz-mfe/src/components/ProfileForm.css` (`--shadow-pressed`)  |
| 24  | Layout uses 24-32px radii + 9999px pills + 20-28px gaps + 24-32px padding              | `web/container/src/styles/tokens.css` (`--radius-*`)               |

---

## Troubleshooting

- **`cd api && npm install` (or `cd web && npm install`) fails with `ENOENT … package.json`** — `api/` and `web/` are not workspaces; they're parents of sibling workspaces. Always run from the repo root. Each parent ships a stub `package.json` that explains the redirect (run `npm install` from the parent directory and the stub will print the right command).
- **API returns `invalid_profile` (HTTP 400)** — the Zod schema rejected the request body. The `details` array in the response tells you which field. Check `api/matching-service/src/schemas/profile.ts` for the allowed values.
- **`/api/health` returns `version: dev`** — the matching process couldn't find a `.git` directory. Set `GIT_SHA` explicitly in the env, or ensure the repo is cloned (not downloaded as a tarball).
- **`docker compose up` fails with `connect ECONNREFUSED 127.0.0.1:5432`** — the `db` service isn't healthy yet. Wait 10 seconds and retry, or run `docker compose up -d db` first, then `docker compose up -d matching ingestion gateway`.
- **Gateway says `401 Unauthorized` for an internal sync call** — `INGESTION_TARGET_TOKEN` on the ingestion container doesn't match `API_SECRET` on the matching container. Re-export both from `.env` and `docker compose up -d`.
- **Cloudflare Pages returns 502 for `/api/*`** — the `/api/*` → tunnel routing rule isn't set up in the Pages Functions routing dashboard. Verify the Worker is bound to `/api/*` and that it forwards to `https://api.<ceo-domain>`.
- **CORS error in the browser console** — the SPA's origin is missing from the matching service's `CORS_ORIGIN`. Update `.env` and `docker compose up -d` to reload.

---

## Further reading

- `docs/Vision.md` — what the product is and isn't.
- `docs/PRD.md` — requirements, scope, and acceptance criteria.
- `docs/Constraints.md` — the budget and technology boundaries.
- `docs/Architecture.md` — the technical design (this README defers to it for depth).
- `docs/Database.md` — PostgreSQL and PostGIS database schema and configuration.
- `docs/API_Spec.md` — API endpoints, payloads, validation, caching, and rate limits.
- `docs/Module_Map.md` — monorepo structure and package boundaries.
- Each workspace's `README.md` (matching-service / ingestion-service / gateway / web-container / web-quiz-mfe / web-compare-mfe / web-dashboard-mfe) documents its inputs, outputs, API surface, and event contracts.
