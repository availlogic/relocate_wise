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
3. **Questionnaire** has 7 sections (climate, cost, housing, career, education, healthcare, lifestyle). You can *Skip* any question.
4. **Results** page shows your top 10 matches as cards with a 0–100 score and a templated "why this fits you" line.
5. **Add to compare** on any 2 or 3 cards, then click the **Compare** link in the header to see the side-by-side table with the best per row highlighted.
6. **View full profile** on any card to see the 7 dimension bars and the qualitative description.

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
│   │   │   ├── score.ts       7-dimension scoring, weight normalization
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
├── netlify/                   Edge function (proxies /api/* to the Ubuntu API)
│   ├── functions/proxy.ts     Pass-through with 60s in-memory cache for /cities/:slug
│   └── test/proxy.test.ts     6 tests for forward, CORS, cache, 502
│
├── db/
│   ├── migrations/001_init.sql  Schema with PostGIS extension
│   └── seeds/cities.json        Versioned 40-city source of truth
│
├── docs/                      Vision, Constraints, PRD, Architecture
│
├── docker-compose.yml         api + db + caddy (local + production)
├── Caddyfile                  TLS reverse proxy
├── netlify.toml               SPA build + /api/* redirect to the edge function
├── .dockerignore              Keeps the API image build context small
├── .github/workflows/ci.yml   CI: typecheck, test, build, smoke build
├── .env.example               Local development env defaults
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
| `VITE_API_BASE`   | SPA dev/build     |                   | unset → relative `/api/*` (uses Vite proxy or Netlify redirect) | Override the API base; set to a full URL to point at a remote API. |
| `API_PROXY_TARGET` | Vite dev only     |                   | `http://localhost:3000`  | Where Vite forwards `/api/*` in dev. Set to `http://localhost:8080` to use Caddy on host :8080 instead. |
| `API_ORIGIN`      | Netlify function  | Yes, in prod      | —                        | Where the proxy forwards `/api/*`                  |
| `API_SECRET`      | Netlify function  | Yes, in prod      | —                        | Shared header secret to the Ubuntu API             |

The `docker-compose.yml` reads `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `CORS_ORIGIN`, and `GIT_SHA` from the host environment (or `.env` at the project root). See `.env.example` for local defaults.

---

## Tests

```bash
npm test           # all workspaces (api + web + netlify)
```

The `api` workspace includes a testcontainers-based integration test that spins up a real `postgis/postgis:16-3.4-alpine` container per run. It is **skipped** when the Docker socket at `/var/run/docker.sock` is absent (CI runners without Docker, or contributors on hosts without Docker). On a developer machine with Docker installed the suite takes ~10 s longer; in CI on a GitHub-hosted runner it's already a normal step.

A small drift check (`cities.seed-sync.test.ts`) keeps the in-memory TS array and the versioned `db/seeds/cities.json` byte-identical. Re-run `npm -w @relocatewise/api run db:export` after any edit to `cities.seed.ts`.

---

## Deploy

There are two deploy targets. Both must be live for the app to work end-to-end:

| Target  | Where                                     | What it serves                                            |
| ------- | ----------------------------------------- | --------------------------------------------------------- |
| Frontend | Netlify (free tier)                        | The React/Vite SPA, served from a global CDN             |
| Backend  | CEO's Ubuntu server, Docker Compose       | The Fastify + Postgres + PostGIS API, fronted by Caddy    |

The two are connected by a single HTTPS call: the browser talks to the Netlify-hosted SPA, which (for `/api/*`) hits a Netlify Function that forwards to the Ubuntu API.

### Frontend — Netlify

#### Prerequisites

- A GitHub repository containing this code (the user has the local checkout; push it up first).
- A Netlify account (<https://app.netlify.com>). The free tier is enough.
- The backend **must already be deployed and reachable** at `https://api.<ceo-domain>` (see [Backend — Ubuntu server](#backend--ubuntu-server) below). Netlify won't be able to serve `/api/*` until the API is up.

#### 1. Connect the repo

1. Sign in to <https://app.netlify.com>.
2. Click **Add new site → Import an existing project**.
3. Pick **GitHub** and authorize Netlify to read the repo.
4. Select the RelocateWise repository.

#### 2. Configure build settings

The build is driven by the root `netlify.toml`, so most of the configuration is already in the repo. Verify (or set) the following on the **Site configuration → Build & deploy** page:

| Setting               | Value          | Notes                                       |
| --------------------- | -------------- | ------------------------------------------- |
| Base directory        | `web`          | Where the SPA's `package.json` lives         |
| Build command         | `npm run build` | Runs `tsc -b && vite build` via the workspace `npm run build` |
| Publish directory     | `dist`         | Vite's default output                       |
| Functions directory   | `netlify/functions` | Auto-detected; explicit for clarity     |
| Node version          | `20`           | Set in `[build.environment] NODE_VERSION`   |

If you don't see Node 20 as the default, add `NODE_VERSION=20` in **Environment variables** (see step 3) — it overrides Netlify's default. Alternatively set it in the build image settings.

#### 3. Set environment variables

Go to **Site configuration → Environment variables** and add the following. **Do not** put them in source or in the public repo.

| Key            | Value (example)                          | Where it lands                              |
| -------------- | ---------------------------------------- | ------------------------------------------- |
| `API_ORIGIN`   | `https://api.example.com`                | Netlify function — where to forward `/api/*` |
| `API_SECRET`   | (a long random string, 32+ chars)        | Sent in the `x-relocatewise-secret` header  |
| `NODE_VERSION` | `20`                                     | Forces Node 20 in the build env             |

Use **Generate a value** for `API_SECRET`, or paste a random string from `openssl rand -hex 32`. The same value must be set on the Ubuntu server (see step 4 below).

You can set values per-deploy-context (Production, Deploy Previews, Branch deploys). For an MVP, scoping to **Production** is fine.

#### 4. Deploy

Click **Deploy site**. Netlify will:

1. Clone the repo.
2. Run `npm ci` in `web/` (the base directory).
3. Run `npm run build` (which runs `tsc -b && vite build`).
4. Publish `web/dist/` to the CDN.
5. Discover `netlify/functions/proxy.ts` and bundle it as a Netlify Function.

The first build takes 2–4 minutes. Watch the deploy log; if it fails, the log is the first place to look. Common failures:

- **"Cannot find module '@relocatewise/shared'"** — the base directory is wrong. Fix it to `web` in step 2.
- **"Functions bundler error"** — usually a TypeScript error in `netlify/functions/proxy.ts`. Run `npm -w @relocatewise/netlify run typecheck` locally to reproduce.
- **"Build script returned non-zero exit code"** — usually a missing env var. Set `NODE_VERSION=20` explicitly.

#### 5. Add a custom domain (optional but recommended)

1. Buy the domain (Cloudflare Registrar, Namecheap, or your registrar of choice).
2. In Netlify: **Domain settings → Add a domain alias** → enter `<ceo-domain>`.
3. Netlify will show the DNS records to add. For an apex domain (`example.com`), add the A record it shows. For a subdomain (`www.example.com`), add the CNAME.
4. Wait for DNS to propagate (a few minutes to 48 hours). Netlify provisions a Let's Encrypt cert automatically.

> The Netlify free tier provisions a `*.netlify.app` URL for you on first deploy. You can demo the app on that URL even before the custom domain is wired up.

#### 6. (Recommended) Enable Deploy Previews

Under **Site configuration → Deploy contexts**, enable **Branch deploys** and **Deploy Previews**. Every PR will get its own preview URL (`https://deploy-preview-42--<site>.netlify.app`) that runs against the **production** `API_ORIGIN`. This is the cheapest way to test changes before merging.

#### 7. Smoke-test the deployment

Once the first deploy is green, run through this checklist (everything should take under 60 seconds):

```bash
# Replace <site> with your Netlify subdomain and <ceo-domain> with the real one.

# 1. SPA loads.
curl -sI https://<site>.netlify.app/ | head -1
# → HTTP/2 200

# 2. Health endpoint (proxied through the Netlify function).
curl -s https://<site>.netlify.app/api/health
# → {"ok":true,"version":"<git-sha>","timestamp":"..."}

# 3. City list (proxied).
curl -s https://<site>.netlify.app/api/cities | python3 -c "import sys, json; print(len(json.load(sys.stdin)['cities']))"
# → 40

# 4. Single city (proxied + cached for 60s on the second call).
curl -s https://<site>.netlify.app/api/cities/lisbon-pt | python3 -c "import sys, json; print(json.load(sys.stdin)['slug'])"
# → lisbon-pt

# 5. Match endpoint (proxied).
curl -s -X POST -H 'Content-Type: application/json' \
  -d '{"climate":"mediterranean","career_industry":"tech","lifestyle_tags":["urban","coastal"]}' \
  https://<site>.netlify.app/api/match | python3 -c "import sys, json; print(len(json.load(sys.stdin)['results']))"
# → 10
```

If any of these fail, the problem is almost always one of:

- **CORS** — the Ubuntu API's `CORS_ORIGIN` env var doesn't include the Netlify domain. Fix: update `CORS_ORIGIN` on the server and `docker compose up -d` to pick it up.
- **DNS / TLS** — the Netlify function can't reach `API_ORIGIN`. Check with `curl -v https://<ceo-domain>/api/health` from any machine.
- **Wrong secret** — the API returns 401. The header `x-relocatewise-secret` sent by the function must match the value the Ubuntu API expects.

#### 8. Continuous deployment

Netlify watches `main` by default. After the first deploy, every push to `main` triggers a new production deploy, and every PR gets a preview URL. No further action is needed.

### Backend — Ubuntu server

#### Prerequisites

- An Ubuntu 22.04+ server reachable from the public internet (any VPS — Hetzner, DigitalOcean, Vultr, OVH; the cheapest tier is enough).
- A DNS A record for `api.<ceo-domain>` pointing at the server's public IP.
- A `CEO_DOMAIN` placeholder (replace with the real domain throughout this section).

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

#### 2. Clone the repo

```bash
mkdir -p /srv/relocatewise
cd /srv/relocatewise
git clone <your-github-repo-url> .
```

#### 3. Configure the production `.env`

Create `/srv/relocatewise/.env` (the same path `docker-compose.yml` reads from):

```bash
cat > /srv/relocatewise/.env <<EOF
# Postgres
POSTGRES_USER=relocatewise
POSTGRES_PASSWORD=$(openssl rand -hex 24)
POSTGRES_DB=relocatewise

# CORS — comma-separated. The Netlify domain must be in here.
CORS_ORIGIN=https://<ceo-domain>,https://<site>.netlify.app

# Git SHA returned by /api/health. The deploy script updates this.
GIT_SHA=$(git -C /srv/relocatewise rev-parse --short HEAD)
EOF
chmod 600 /srv/relocatewise/.env
```

The CEO's domain goes here too — set `CEO_DOMAIN` as a host env var so Caddy can pick it up:

```bash
echo 'export CEO_DOMAIN=api.example.com' > /etc/profile.d/relocatewise.sh
. /etc/profile.d/relocatewise.sh
```

#### 4. Set the Caddy domain

Edit `Caddyfile` so the `{$API_DOMAIN}` placeholder resolves correctly. The default in the file is `{$API_DOMAIN:api.example.com}` — for production, set the env var on the host so the placeholder expands to the real domain:

```bash
echo 'export API_DOMAIN=api.example.com' >> /etc/profile.d/relocatewise.sh
. /etc/profile.d/relocatewise.sh
```

The first non-`#` line of the `Caddyfile` is `{$API_DOMAIN:api.example.com} {`. The `{$API_DOMAIN:default}` syntax means "use `API_DOMAIN` if set, else fall back to `default`". Caddy will provision a Let's Encrypt cert automatically once DNS resolves.

#### 5. Bring the stack up

```bash
cd /srv/relocatewise
docker compose up -d
```

The first boot pulls three images:

- `postgis/postgis:16-3.4-alpine` (~80 MB)
- `node:20-alpine` (build stage, ~50 MB; the runtime image is built locally, not pulled)
- `caddy:2-alpine` (~40 MB)

Then the API container runs migrations (`db/migrations/001_init.sql`) and seeds the 40-city dataset. **This is idempotent** — re-running on a database that already has data is a no-op.

#### 6. Open the firewall

```bash
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

Caddy listens on 80/443 and provisions the cert via the ACME HTTP-01 challenge on port 80. If port 80 is blocked, certificate issuance fails.

#### 7. Smoke-test the API

```bash
# Health
curl -s https://api.<ceo-domain>/api/health
# → {"ok":true,"version":"<git-sha>","timestamp":"..."}

# Match
curl -s -X POST -H 'Content-Type: application/json' \
  -d '{"climate":"mediterranean","career_industry":"tech","lifestyle_tags":["urban","coastal"]}' \
  https://api.<ceo-domain>/api/match | python3 -c "import sys, json; print(len(json.load(sys.stdin)['results']))"
# → 10

# Direct (non-proxied) connection works
curl -s https://api.<ceo-domain>/api/cities/lisbon-pt | python3 -c "import sys, json; print(json.load(sys.stdin)['slug'])"
# → lisbon-pt
```

If Caddy is up but cert issuance is failing, check `docker compose logs caddy`. The most common cause is DNS not yet pointing at the server.

#### 8. Subsequent deploys

The CEO (or whoever has SSH access) runs one command on the server:

```bash
ssh root@<server-ip> 'cd /srv/relocatewise && git pull && docker compose pull && docker compose up -d'
```

This rebuilds the API image with the latest code, runs any new migrations, and restarts the containers. Postgres data is preserved on the named volume `pgdata`.

For zero-downtime deploys, the architecture doc leaves room for `docker compose up -d --no-deps --scale api=2` followed by a rolling restart; that's a Day-2 optimization and not in the MVP.

#### 9. Backups

None required. The dataset is in git (`db/seeds/cities.json`); the database is a build artifact. RPO = 0, RTO = re-run `docker compose up -d` on a fresh box (~15 minutes).

### Wiring the two halves together

After both halves are deployed, verify the end-to-end loop:

```bash
# 1. SPA loads
curl -sI https://<ceo-domain>/ | head -1
# → HTTP/2 200

# 2. /api/* is proxied through Netlify to the Ubuntu API
curl -s https://<ceo-domain>/api/health
# → {"ok":true,"version":"<git-sha>","timestamp":"..."}

# 3. The shared secret matches
docker logs --tail 20 relocatewise-api 2>&1 | grep -i "401\|unauthorized" || echo "no auth errors"
# → "no auth errors"
```

If step 1 returns 200 but step 2 doesn't, the issue is on the Netlify side (function env, routing). If step 2 returns 200 but the SPA shows network errors in the browser, the issue is CORS (the SPA's origin isn't in `CORS_ORIGIN` on the server).

---

## Acceptance criteria (PRD §8)

| AC  | What it means                                                                          | Where it's enforced                                                 |
| --- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| 1   | First-visit end-to-end loop in under 10 minutes                                        | Manual smoke walkthrough                                            |
| 2   | Questionnaire has 8–12 questions, completable in 5 minutes                              | `web/src/components/ProfileForm.tsx`                                |
| 3   | Exactly 10 results returned                                                            | `api/src/matching/score.ts:336` (`topN ?? 10`)                      |
| 4   | Identical inputs ⇒ identical ranking                                                   | Pure function; `api/test/matching.score.test.ts`                    |
| 5   | Each result card shows city/country/score/why                                          | `web/src/components/RankCard.tsx`                                   |
| 6   | City profile shows 7 dimensions + description + last_updated                           | `web/src/pages/CityPage.tsx`, `api/src/routes/city.ts`              |
| 7   | Max 3 cities in shortlist; 4th is rejected                                             | `web/src/state/shortlist.tsx:26` (`SHORTLIST_MAX = 3`)              |
| 8   | Comparison view highlights best per row                                                 | `web/src/pages/ComparePage.tsx:163` (`--best` class)                |
| 9   | Submit or tab-close clears the shortlist                                               | Shortlist lives in React state, not storage                         |
| 10  | No personal data leaves the server                                                     | API logs no body / IP / UA; questionnaire discarded after response  |
| 11  | Consent banner on first visit, no cookies before consent                               | `web/src/components/ConsentBanner.tsx`                              |
| 12  | Privacy page linked from footer and banner                                             | `web/src/App.tsx`, `ConsentBanner.tsx`                              |
| 13  | Single-command Docker Compose startup, documented                                       | `docker compose up` + this README                                   |
| 14  | Public URL on free tier with HTTPS                                                      | Netlify + Caddy/Let's Encrypt (deploy steps above)                  |
| 15  | CI runs typecheck + tests + smoke build on every push to `main`                        | `.github/workflows/ci.yml`                                          |

---

## Troubleshooting

- **API returns `invalid_profile` (HTTP 400)** — the Zod schema rejected the request body. The `details` array in the response tells you which field. Check `api/src/schemas/profile.ts` for the allowed values.
- **`/api/health` returns `version: dev`** — the API process couldn't find a `.git` directory. Set `GIT_SHA` explicitly in the env, or ensure the repo is cloned (not downloaded as a tarball).
- **`docker compose up` fails on the API with `connect ECONNREFUSED 127.0.0.1:5432`** — the `db` service isn't healthy yet. Wait 10 seconds and retry, or run `docker compose up -d db` first, then `docker compose up -d api caddy`.
- **Caddy says `msg="no certificate available"`** — the DNS A record isn't pointing at this server, or the port-80 ACME challenge is blocked. Verify with `dig api.<ceo-domain> +short` and `curl -v http://api.<ceo-domain>/.well-known/acme-challenge/test`.
- **Netlify function returns 502 `upstream_unreachable`** — `API_ORIGIN` is wrong, the API is down, or the Caddy certificate hasn't been issued yet. Check `curl -v https://api.<ceo-domain>/api/health` from any machine.
- **CORS error in the browser console** — the SPA's origin is missing from the API's `CORS_ORIGIN`. Update `.env` and `docker compose up -d` to reload.

---

## Further reading

- `docs/Vision.md` — what the product is and isn't.
- `docs/PRD.md` — requirements, scope, and acceptance criteria.
- `docs/Constraints.md` — the budget and technology boundaries.
- `docs/Architecture.md` — the technical design (this README defers to it for depth).
