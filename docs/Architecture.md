---
title: "System Architecture"
version: "1.0.0"
status: draft
author: "Architecture Agent"
created: "2026-06-02"
updated: "2026-06-02"
related_docs:
  - "docs/Vision.md"
  - "docs/Constraints.md"
  - "docs/PRD.md"
  - "docs/Database.md"
  - "docs/API_Spec.md"
  - "docs/Module_Map.md"
---

# RelocateWise — System Architecture

This document describes the technical design for the **Minimum Viable Product (MVP)** of RelocateWise. It is grounded in `Vision.md`, `Constraints.md`, and `PRD.md` (v2.0.0). The dominant constraints are the **3-day delivery window** and the **$0 budget**; every choice below is justified against those.

> Open questions from the PRD (§9) have been resolved by the CEO on 2026-06-02:
> 1. Frontend tier runs on **Netlify + Netlify Functions**; backend runs in **Docker Compose on a personal Ubuntu server**.
> 2. Initial dataset uses **global coverage** (≈40 cities, distribution defined in §5.2).
> 3. "Why this fits you" uses **templated text generation**.

## 1. Design Principles

The architecture follows five rules derived from the product principles in `Vision.md` and the constraints:

1. **One loop, one process** — The MVP is a single linear flow (questionnaire → results → profile/compare). No dashboards, no settings, no multi-page app. The architecture reflects that: a SPA with one router and one API.
2. **Data on the box** — Per `Constraints.md` ("Minimize third-party API reliance") and `PRD.md` FR-7 ("no external API call shall be required to produce rankings"), the matching engine runs entirely against local, curated data. No third-party calls at request time.
3. **Decide once, ship once** — A deterministic algorithm (no ML, no LLM, no randomness) is mandatory (PRD FR-6). Same inputs ⇒ same output, always. This makes the system trivially testable.
4. **Spend nothing** — No paid services. No paid data feeds. No paid monitoring. No paid auth. Cloudflare-style "richness" is achieved by a small, well-built Node + Postgres service on hardware the CEO already owns.
5. **The browser is the session** — Per PRD §3.1 S7, the shortlist is held in the browser, not the server. The server therefore has no user state to manage, which removes most of the typical backend complexity (no sessions, no auth, no cookies, no GDPR data inventory).

## 2. System Topology

The MVP uses a **two-tier hybrid deployment**: a static + edge tier on Netlify, and a private backend tier on the CEO's Ubuntu server.

```
                  ┌─────────────────────────────────────────────┐
                  │                Browser (SPA)                │
                  │  React + Vite, static assets, no server     │
                  │  state, shortlist in sessionStorage         │
                  └────────────────────┬────────────────────────┘
                                       │ HTTPS (JSON over fetch)
                                       ▼
        ┌──────────────────────────────────────────────────────┐
        │          Netlify (free tier)                         │
        │  ┌────────────────┐    ┌────────────────────────┐    │
        │  │  Static CDN    │    │  Netlify Functions      │   │
        │  │  /app/*        │    │  /api/*  (proxy + edge)  │   │
        │  └────────────────┘    └─────────────┬──────────┘   │
        └──────────────────────────────────────┼───────────────┘
                                               │ HTTPS (server-to-server)
                                               ▼
                  ┌─────────────────────────────────────────────┐
                  │  Ubuntu server (Docker Compose)             │
                  │  ┌──────────────────────┐                   │
                  │  │ api  (Node.js)       │  ◄── TLS via Caddy │
                  │  │ Express or Fastify   │      (Let's Encrypt)│
                  │  └──────────┬───────────┘                   │
                  │             │                               │
                  │  ┌──────────▼───────────┐                   │
                  │  │ db (Postgres+PostGIS)│                   │
                  │  └──────────────────────┘                   │
                  └─────────────────────────────────────────────┘
```

**Why hybrid?** The CEO's Ubuntu server is the only place we can run PostgreSQL with PostGIS on a $0 budget (per CEO decision on PRD §9 Q1). Netlify gives us free global CDN and TLS for the static SPA. The two are connected by a single HTTPS API call.

**Why not talk to the Ubuntu server directly from the browser?** We can, and the MVP does — see §4.3. Netlify Functions are kept thin and optional so we can add edge logic later (caching, redirects, SSR for city profile pages) without changing the call pattern.

## 3. Technology Stack

| Layer        | Choice                                | Notes / justification                                                                                  |
| ------------ | ------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Frontend     | **React 18 + Vite + TypeScript**      | Fast HMR for the 3-day window; TS catches contract drift; Vite produces a small static bundle.        |
| Routing      | **React Router 6**                    | Standard. One stack: `/`, `/q`, `/results`, `/city/:id`, `/compare`, `/privacy`.                       |
| State        | **React Context + `useReducer`**      | Sufficient for the MVP. No Redux/Zustand — adds ceremony for one screen-deep state.                    |
| Styling      | **Plain CSS modules**                 | No Tailwind, no design system. MVP has ~5 screens; a hand-rolled token file is enough.                 |
| HTTP client  | Native `fetch`                        | No axios. The API has ≤5 endpoints.                                                                    |
| Backend      | **Node.js 20 LTS + TypeScript**       | Per `Constraints.md`. Express is the default; Fastify is a one-line swap if we want stricter typing.   |
| Validation   | **Zod**                               | One schema for the request body, shared types in `/shared/types.ts` consumed by the frontend.          |
| Database     | **PostgreSQL 16 + PostGIS 3.4**       | Per `Constraints.md`. PostGIS is provisioned for future "near X" features, not used by MVP queries.   |
| ORM / query  | **Knex (raw query builder)**          | Lighter than Prisma; we have one table layout and want explicit SQL. Migrations included.              |
| Object store | **None**                              | No S3 needed. Static assets are in the repo or on Netlify.                                             |
| TLS          | **Caddy on Ubuntu** (auto Let's Encrypt) | One container, zero config, automatic renewal.                                                     |
| CI/CD        | **GitHub Actions**                    | Per `Constraints.md`. Lint, test, build on every push. Manual `docker compose pull && up -d` on server. |
| Frontend CDN | **Netlify** (free tier)               | Auto-deploy from `main`. Build settings: `npm run build`, publish `dist/`.                              |
| Monitoring   | None (server) + Netlify analytics (frontend, after consent) | Per $0 constraint. Uptime is verified manually during the 3-day window.                                |
| Tests        | **Vitest** (backend) + **Vitest + Testing Library** (frontend) | Same runner on both sides; minimal config.                                              |
| Lint         | **ESLint + Prettier**                 | Single config, both sides.                                                                             |

## 4. Component Responsibilities

### 4.1 Frontend (React SPA)

Owned by Netlify as a static bundle. Responsibilities are limited to:

- Render the five screens (landing, questionnaire, results, city profile, compare) and the legal pages (privacy).
- Own the **shortlist** in `sessionStorage`. Read/write only here; the server never sees it.
- Submit questionnaire answers to `POST /api/match` and render the response.
- Read city profiles from `GET /api/cities/:id`.
- Show the cookie consent banner and the privacy policy link.
- **Not** responsible for: authentication, persistence, analytics storage.

### 4.2 Netlify Functions (edge tier)

A single function (`/api/proxy`) is the default entry point for all browser → backend calls. It exists to:

- Provide a **single CORS origin** for the SPA (the function is same-origin with the static site).
- Add a **short-lived in-memory cache** for `GET /api/cities/:id` (60s TTL) to absorb any future traffic spikes.
- Add **rate limiting** at the edge by client IP (e.g., 60 requests / 10 min) before traffic reaches the Ubuntu server.
- Forward to the Ubuntu server over HTTPS using a shared secret in a header.

The function is **stateless** and warm-cold tolerant. If the function layer is bypassed in development (we will), the SPA talks to the Ubuntu server directly via a CORS-allowed origin in dev.

### 4.3 Backend (Node.js API on Ubuntu)

A single Node.js service exposing a small REST surface. Responsibilities:

- Accept questionnaire submissions, run the matching algorithm against the local dataset, return the top 10.
- Serve city profiles by ID.
- **Refuse** any request that would create persistent state (no write endpoints in the MVP).
- Emit structured JSON logs to stdout; no third-party log shipper.

### 4.4 Database (PostgreSQL + PostGIS on Ubuntu)

- Holds the city dataset (30–50 rows) and the dimension scores.
- Holds no user data in the MVP.
- Migrations live in `db/migrations/`; seed data lives in `db/seeds/cities.json` and is loaded on first boot.
- PostGIS extension is installed (per `Constraints.md`) but **not used by any MVP query**. The geometry column exists for forward compatibility (e.g., post-MVP "within 50 km of X" filtering).

## 5. Data Model

### 5.1 Schema (canonical)

```sql
-- Enable PostGIS even though MVP doesn't use it; it's a one-line setup cost and
-- Vision/Constraints commit us to it.
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE cities (
  id            SERIAL PRIMARY KEY,
  slug          TEXT UNIQUE NOT NULL,           -- url-safe id, e.g. "lisbon-pt"
  name          TEXT NOT NULL,
  country       TEXT NOT NULL,
  country_code  CHAR(2) NOT NULL,               -- ISO 3166-1 alpha-2
  region        TEXT NOT NULL,                  -- e.g. "Europe", "Asia-Pacific"
  lat           DOUBLE PRECISION NOT NULL,
  lng           DOUBLE PRECISION NOT NULL,
  geom          GEOMETRY(Point, 4326),         -- PostGIS, populated from lat/lng
  description   TEXT NOT NULL,                  -- 2–3 sentence qualitative summary
  last_updated  DATE NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One row per (city, dimension). A normalized design keeps scores consistent
-- and lets us add a new dimension without a migration.
CREATE TABLE city_scores (
  city_id     INTEGER NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
  dimension   TEXT NOT NULL,                    -- 'climate' | 'cost' | 'housing'
                                               -- | 'career' | 'education'
                                               -- | 'healthcare' | 'community'
  score       SMALLINT NOT NULL CHECK (score BETWEEN 1 AND 5),
  -- Sub-scores for multi-valued dimensions (career, community, climate label).
  -- Stored as a normalized key→score map. NULL for single-valued dimensions.
  sub_scores  JSONB,
  PRIMARY KEY (city_id, dimension)
);

CREATE INDEX cities_region_idx      ON cities (region);
CREATE INDEX city_scores_dimension_idx ON city_scores (dimension);
```

A representative row pair:

```json
// cities row
{ "id": 17, "slug": "lisbon-pt", "name": "Lisbon", "country": "Portugal",
  "country_code": "PT", "region": "Europe", "lat": 38.7223, "lng": -9.1393,
  "description": "Coastal capital with mild weather, walkable neighborhoods, and
                  a growing tech scene. Housing is increasingly tight in the
                  center but affordable in the surrounding parishes.",
  "last_updated": "2026-05-15" }

// city_scores rows for Lisbon
{ "city_id": 17, "dimension": "climate",    "score": 4, "sub_scores": {"label": "Mediterranean"} }
{ "city_id": 17, "dimension": "cost",       "score": 3, "sub_scores": null }
{ "city_id": 17, "dimension": "housing",    "score": 3, "sub_scores": null }
{ "city_id": 17, "dimension": "career",     "score": 4, "sub_scores": {"tech": 4, "finance": 3, "healthcare": 3, "creative": 5, "manufacturing": 2} }
{ "city_id": 17, "dimension": "education",  "score": 4, "sub_scores": null }
{ "city_id": 17, "dimension": "healthcare", "score": 4, "sub_scores": null }
{ "city_id": 17, "dimension": "community",  "score": 5, "sub_scores": {"urban": 5, "coastal": 5, "arts_culture": 5, "expat_friendly": 5} }
```

### 5.2 Dataset scope (per CEO decision, 2026-06-02)

40 cities, distributed globally:

| Region         | Count | Examples (placeholder)                                  |
| -------------- | ----- | ------------------------------------------------------- |
| North America  | 15    | NYC, Austin, Toronto, Vancouver, Mexico City …          |
| Europe         | 10    | Lisbon, Berlin, Amsterdam, Tallinn, Madrid …            |
| Asia-Pacific   |  5    | Singapore, Tokyo, Sydney, Seoul, Bangkok …               |
| Latin America  |  5    | São Paulo, Buenos Aires, Medellín, Santiago, Lima …      |
| Other          |  5    | Cape Town, Dubai, Tel Aviv, Istanbul, Casablanca …       |

Final city list is captured in `db/seeds/cities.json` and is the single source of truth. Coverage of 3 continents and 10+ cities outside any assumed home market satisfies PRD §6.2.

### 5.3 Seed & refresh

- On first boot, the API container runs `npm run db:seed`, which loads `db/seeds/cities.json` if `cities` is empty.
- `last_updated` is a column, not a generated field; the team updates the JSON file and re-seeds to refresh.
- No continuous refresh, no cron, no automation in MVP (per PRD §3.2).

## 6. Matching Algorithm

The algorithm is **deterministic** (PRD FR-6) and **local** (PRD FR-7). It runs in a single SQL query plus a deterministic in-process aggregation step.

### 6.1 User profile shape

The questionnaire produces a JSON object sent to `POST /api/match`:

```json
{
  "climate":         "temperate",                // enum: tropical|temperate|mediterranean|continental|cold|arid|no_preference
  "cost_importance": 3,                          // 0..3 (None..High)
  "cost_ceiling":    3,                          // 1..5, only if cost_importance > 0
  "housing_importance": 3,
  "housing_ceiling":  3,
  "career_industry": "tech",                     // enum or null
  "education":       "important",                // not_relevant|somewhat|important
  "healthcare_importance": 2,
  "lifestyle_tags":  ["urban", "coastal"]        // 0..N from the fixed tag set
}
```

### 6.2 Per-dimension match (0..1)

For each city `c` and each dimension `d`, compute `m(c, d) ∈ [0, 1]`:

| Dimension   | Formula                                                                                  |
| ----------- | ---------------------------------------------------------------------------------------- |
| climate     | `1.0` if `c.climate.label == user.climate`, else `0.5` if compatible group, else `0.0`. |
| cost        | `1.0` if `c.cost <= user.cost_ceiling`; else linear penalty `(5 - c.cost) / (5 - ceiling)`. |
| housing     | Same as cost.                                                                             |
| career      | `c.career[user.career_industry] / 5`, or `0.5` (neutral) if user has no industry.          |
| education   | `c.education / 5` if `user.education != "not_relevant"`, else dimension **excluded**.      |
| healthcare  | `c.healthcare / 5`.                                                                       |
| community   | `max(c.community[tag] for tag in user.lifestyle_tags) / 5`, or `0.5` if no tags chosen.   |

### 6.3 Per-dimension weight

| Dimension   | Weight                                                            |
| ----------- | ----------------------------------------------------------------- |
| climate     | `1` always                                                        |
| cost        | `cost_importance` mapped to `{0, 0.5, 1, 2}`                      |
| housing     | `housing_importance` mapped to `{0, 0.5, 1, 2}`                   |
| career      | `1` if user picked an industry, else `0`                          |
| education   | `0` if `not_relevant`, else `1`                                   |
| healthcare  | `healthcare_importance` mapped to `{0, 0.5, 1, 2}`                |
| community   | `1` if user picked ≥1 tag, else `0`                               |

Weights are normalized: `w_d' = w_d / Σ w_d` over the **included** dimensions. Excluded dimensions are dropped before normalization, so the overall score always sums to 1.

### 6.4 Overall match

`match(c) = Σ_d w_d' · m(c, d)` ∈ [0, 1]. Scaled to 0–100 and rounded to an integer for display.

### 6.5 "Why this fits you" (templated per CEO decision)

For the top 1–2 dimensions by **contribution** `w_d' · m(c, d)`, emit a template string:

| Top dimension | Template                                                              |
| ------------- | --------------------------------------------------------------------- |
| climate       | "Matches your {climate} climate preference"                            |
| cost          | "Fits your housing and cost budget"                                    |
| housing       | "Fits your housing and cost budget"                                    |
| career        | "Strong {industry} job market"                                         |
| education     | "Strong schools and education options"                                 |
| healthcare    | "Strong healthcare access"                                             |
| community     | "Matches your {tag1, tag2} lifestyle"                                 |

When two dimensions tie within 10% of each other, both are emitted, joined with " and ". The template is the only source of these strings; there is no hand-authored copy in MVP.

### 6.6 Determinism guarantee

The algorithm is pure: no `Date.now()`, no `Math.random()`, no async I/O between input and output. The query result is sorted by `(match DESC, name ASC)`. Identical inputs ⇒ byte-identical output, satisfying PRD AC-4.

## 7. API Surface

The API is small by design. All responses are `application/json`. All errors return `{ "error": "<code>", "message": "<human>" }` with an appropriate HTTP status.

| Method | Path                  | Purpose                                  | Auth | Notes                                                       |
| ------ | --------------------- | ---------------------------------------- | ---- | ----------------------------------------------------------- |
| POST   | `/api/match`          | Rank cities from a user profile          | None | Body = §6.1 shape. Returns top 10 by `match DESC`.          |
| GET    | `/api/cities/:slug`   | City profile (7 dimensions + description) | None | One row by slug. Used by `/city/:slug` route.                |
| GET    | `/api/health`         | Liveness probe                           | None | Returns `{ "ok": true, "version": "<git-sha>" }`.           |

No write endpoints in MVP. There is intentionally no `POST /api/leads`, no `POST /api/analytics`, no `POST /api/anything-else`.

### 7.1 Example: `POST /api/match`

Request:

```json
{
  "climate": "mediterranean",
  "cost_importance": 3, "cost_ceiling": 3,
  "housing_importance": 3, "housing_ceiling": 3,
  "career_industry": "tech",
  "education": "important",
  "healthcare_importance": 2,
  "lifestyle_tags": ["urban", "coastal"]
}
```

Response (abridged):

```json
{
  "results": [
    { "city": { "slug": "lisbon-pt", "name": "Lisbon", "country": "Portugal" },
      "score": 87,
      "why":  "Matches your Mediterranean climate and strong tech job market" },
    { "city": { "slug": "barcelona-es", "name": "Barcelona", "country": "Spain" },
      "score": 84,
      "why":  "Matches your Mediterranean climate and strong tech job market" }
    /* …8 more… */
  ]
}
```

## 8. Frontend Architecture

### 8.1 Routes

| Path             | Screen                | Notes                                                                 |
| ---------------- | --------------------- | --------------------------------------------------------------------- |
| `/`              | Landing               | One sentence + "Start the questionnaire" button.                      |
| `/q`             | Questionnaire         | One question per screen; progress bar; Back/Skip on every screen.     |
| `/results`       | Ranked results        | Top 10 cards; "Compare" button appears when ≥2 are short-listed.      |
| `/city/:slug`    | City profile          | 7 dimensions on a 1–5 scale + description + last_updated.             |
| `/compare`       | Comparison            | 2–3 cities × 7 dimensions, best-per-row highlighted.                   |
| `/privacy`       | Privacy policy        | Static page. Linked from footer and consent banner.                   |

### 8.2 State

Two pieces of state, both client-side:

- **`SessionState`** (React Context): current step index, current answers, submission result, shortlist. Held in `useReducer`. On `submit`, the reducer also writes the **shortlist** to `sessionStorage` and clears the answers.
- **Shortlist persistence**: a small `sessionStorage` key (`rw:shortlist`) holding an array of up to 3 city slugs. Read on app mount; written on add/remove. Cleared on `submit` and on tab close (browser default).

There is no global store, no Redux, no Zustand. The state surface is small enough to keep in a single reducer (see §1 principle 1).

### 8.3 API client

A single `src/api.ts` module exports typed functions:

```ts
postMatch(profile: UserProfile): Promise<MatchResult>
getCity(slug: string): Promise<CityProfile>
```

The functions point at `import.meta.env.VITE_API_BASE` in dev (the Ubuntu server) and at `/api` in production (the Netlify function proxy). All errors surface to a single toast.

## 9. End-to-End Data Flow: the "happy path"

1. User opens `/`. The landing page is a static asset served by Netlify CDN.
2. User clicks **Start**. The router navigates to `/q` and the questionnaire reducer initializes to step 0.
3. User answers (or skips) ~10 questions. On each step, the reducer updates `answers` in memory only; nothing leaves the browser.
4. On the last question, user clicks **See results**. The reducer calls `postMatch(answers)` against `/api` (Netlify function in prod, Ubuntu server in dev).
5. The function proxies to `POST https://api.<ceo-domain>/api/match` on the Ubuntu server.
6. The Node API:
   1. Validates the body with Zod.
   2. Runs a single SQL query that returns all 40 cities with their `city_scores`.
   3. Applies the matching algorithm in-memory (§6).
   4. Sorts, slices to 10, formats the response, returns JSON.
7. The reducer stores the result, clears `answers`, navigates to `/results`.
8. User clicks a card → router navigates to `/city/:slug` → `getCity(slug)` fetches the profile.
9. User checks two cards → shortlist is `{lisbon-pt, barcelona-es}` → "Compare" button appears.
10. User clicks **Compare** → router navigates to `/compare` → renders the side-by-side table from the in-memory shortlist.
11. User closes the tab. `sessionStorage` is cleared. Nothing was ever persisted on the server.

Median request budget for step 6: **< 200 ms** server-side, comfortably within the 1 s p95 budget (PRD §7) after network overhead.

## 10. Deployment & Operations

### 10.1 Local development

```bash
git clone <repo>
cd relocatewise
docker compose up           # api + db on localhost
cd web && npm install && npm run dev   # Vite dev server on :5173
```

Vite is configured to proxy `/api/*` to `http://localhost:3000`. One command per process; documented in `README.md`. This satisfies PRD AC-13.

### 10.2 CI (GitHub Actions, per `Constraints.md`)

A single workflow on every push to `main` and on PRs:

1. `npm ci` in `api/`, `web/`, and `shared/`.
2. `npm run lint` in each.
3. `npm run test` in each (unit tests; the matching algorithm has full coverage).
4. `npm run build` in `web/`.
5. `docker build` in `api/` (smoke build; no push).

No automatic deploy to production from CI in the 3-day window — the workflow ends with a green check (PRD AC-15).

### 10.3 Production topology

| Component    | Host                          | Deploy step                                                                |
| ------------ | ----------------------------- | -------------------------------------------------------------------------- |
| SPA          | Netlify (free tier)           | Auto-deploy from `main` via Netlify Git integration.                       |
| Netlify Fn   | Netlify (free tier)           | Same. Bundled with the SPA repo (`netlify/functions/proxy.ts`).            |
| API          | Ubuntu server (CEO-owned)     | `ssh server 'cd /srv/relocatewise && docker compose pull && up -d'`.        |
| DB           | Ubuntu server (CEO-owned)     | Same `docker compose up`. PostGIS image; data persisted in a named volume. |
| TLS (API)    | Caddy (container)             | Auto Let's Encrypt via Caddy; CEO's domain points an A record at the box.  |
| TLS (SPA)    | Netlify                       | Automatic.                                                                  |
| DNS          | Cloudflare (free) or registrar | One A record for `api.<ceo-domain>`, CNAME for `<ceo-domain>` → Netlify.  |

Deploys to the Ubuntu server are triggered **manually** in the 3-day window, by running one command over SSH. No auto-rollback, no canary, no blue/green — explicitly out of scope.

### 10.4 Backups

The city dataset is **versioned in git** (`db/seeds/cities.json`). The database is therefore a build artifact, not a source of truth. Backups are not required for the MVP. A one-line note in the README explains how to re-seed from scratch.

### 10.5 Disaster recovery

Single Ubuntu server = single point of failure. The CEO accepts this in the MVP (per `Vision.md` "best-effort, no formal SLA" framing). Recovery procedure: re-run `docker compose up` on a fresh box; the seed data rebuilds the dataset from git. RPO = 0 (data is in git); RTO = ~15 min.

## 11. Security & Compliance

| Concern                | Mitigation                                                                                                         |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Transport encryption   | HTTPS enforced on both tiers (Netlify + Caddy/Let's Encrypt).                                                      |
| CORS                   | The Ubuntu API allows only the SPA origin and the Netlify function origin. No wildcard.                            |
| Authentication         | None. There is no login, no signup, no token, no cookie.                                                           |
| Personal data          | None collected. Questionnaire answers are never sent until the user clicks **Submit**, then sent over TLS, and **discarded from server memory after the response is sent**. No logs persist the body. |
| Server logs            | Access logs include request method, path, status, and **truncated** path; no body, no IP, no user agent.            |
| Rate limiting          | Enforced at the Netlify function layer (60 req / 10 min / IP) and at the Ubuntu API (token bucket, 100 req / min / IP). |
| Dependency hygiene     | `npm audit` runs in CI; `package-lock.json` is committed.                                                          |
| Container hygiene      | Official Node 20-alpine and PostGIS 3.4-alpine base images; images rebuilt on deploy.                              |
| GDPR                   | Cookie consent banner is the only cookie-related surface, and it sets no cookie before consent. Privacy Policy is linked from footer and banner. No data subject access requests are possible because no data is stored. |
| Secrets                | One shared secret in the Netlify function → Ubuntu API direction; stored as a GitHub Actions secret and a `docker compose` env file. Never in source. |

This satisfies PRD AC-10, AC-11, AC-12, AC-14.

## 12. Performance & Capacity

| Target (PRD §7, §8)                           | How it's met                                                                                                |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Ranking returned in < 1 s (p95)              | One SQL query over 40 rows; algorithm is O(N · D) with N=40, D=7. Measured budget: < 200 ms server, < 600 ms E2E on broadband. |
| Pages interactive in < 2 s                    | SPA bundle is small (no design system, no chart library, no map). Lighthouse target: Performance ≥ 90.       |
| 10 ranked results returned                    | Hard slice to 10 in the API (PRD AC-3).                                                                    |
| Determinism                                  | Pure function; sorted by `(match DESC, name ASC)` (PRD AC-4).                                              |
| Dataset size                                 | 40 cities, one row per dimension (7 rows × 40 = 280 score rows). Trivial for Postgres.                      |

Capacity planning beyond the MVP is out of scope. The architecture comfortably supports 10k MAU on a single 1-vCPU Ubuntu box with the current data size.

## 13. Observability

Per the $0 budget, we do not run any paid monitoring. What we do have:

- **Health endpoint**: `GET /api/health` returns 200 + version. The CEO's manual smoke test hits it on every deploy.
- **Structured stdout logs** in the API container, picked up by `docker compose logs`. Rotation via `logrotate` on the host (default Ubuntu config).
- **Netlify deploy logs** and **function logs** in the Netlify dashboard (free).
- **GitHub Actions** retains CI logs for 90 days (free tier).

Uptime is verified manually during the 3-day window. There is no alerting, no dashboard, no APM. This is acceptable for the MVP per `Vision.md`'s "best-effort" framing.

## 14. Repository Layout

A proposed layout, for reference. The implementer can adjust, but the split is meaningful.

```
relocatewise/
├── README.md
├── docker-compose.yml              # api + db
├── .github/workflows/ci.yml
├── db/
│   ├── migrations/
│   │   └── 001_init.sql
│   └── seeds/
│       └── cities.json             # source of truth for the dataset
├── shared/
│   └── types.ts                    # UserProfile, CityProfile, MatchResult
├── api/
│   ├── Dockerfile
│   ├── package.json
│   ├── src/
│   │   ├── server.ts
│   │   ├── routes/
│   │   │   ├── match.ts
│   │   │   ├── cities.ts
│   │   │   └── health.ts
│   │   ├── matching/
│   │   │   ├── score.ts            # implements §6
│   │   │   ├── why.ts              # templated "why this fits you"
│   │   │   └── score.test.ts
│   │   ├── db/
│   │   │   ├── client.ts
│   │   │   └── seed.ts
│   │   └── middleware/
│   │       ├── rateLimit.ts
│   │       └── validate.ts
│   └── tsconfig.json
├── web/
│   ├── netlify.toml
│   ├── package.json
│   ├── index.html
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── api.ts
│   │   ├── state/
│   │   │   └── session.tsx         # Context + reducer
│   │   ├── routes/
│   │   │   ├── Landing.tsx
│   │   │   ├── Questionnaire.tsx
│   │   │   ├── Results.tsx
│   │   │   ├── CityProfile.tsx
│   │   │   ├── Compare.tsx
│   │   │   └── Privacy.tsx
│   │   ├── components/
│   │   │   ├── ConsentBanner.tsx
│   │   │   ├── ResultCard.tsx
│   │   │   ├── DimensionBar.tsx    # 1–5 visualization
│   │   │   └── ProgressBar.tsx
│   │   └── styles/
│   │       └── tokens.css
│   └── tsconfig.json
└── netlify/
    └── functions/
        └── proxy.ts                # thin proxy /api/* → Ubuntu server
```

## 15. Open Architectural Decisions

These are small and Day-1 resolvable. They are not blockers but should be answered before the matching engine is implemented.

1. **Climate compatibility table** — The match function in §6.2 uses a "compatible group" fallback for climate (e.g., `mediterranean` and `temperate` get a 0.5 instead of 0). The exact groups are a content call, not a code call. Default: define 3 groups (`warm`, `temperate`, `cold`) and pre-compute the matrix in `shared/climate.ts`. **Resolve on Day 1.**
2. **Career industry sub-scores in DB** — `city_scores.sub_scores` for `career` will be a JSON map keyed by industry. Should it include industries that the user can never pick (forward-compat) or only the current 5? **Default: only the 5; expand when we add industries.**
3. **Community tag taxonomy** — Same question for community tags. **Default: ship the 7 tags listed in PRD §6.1; expand later.**
4. **Netlify function: keep or cut?** — The function is currently a thin proxy. If the simpler design (browser → Ubuntu server directly with CORS) works in the 3 days, drop the function. **Default: keep the function; the cost is low and it gives us a place to add caching, redirects, and post-MVP SSR.** Revisit on Day 2 if it's blocking delivery.
5. **PostGIS usage** — The geometry column is provisioned but unused in MVP. **Default: keep the column; do not add a query that uses it.** Add a one-line note in the migration explaining the choice.
6. **Server-side state for analytics** — Per PRD AC-10, no analytics data leaves the server. If we later want a page-view counter, it must be on the client (e.g., Netlify Analytics or Plausible free tier) and gated by consent. **Default: do not build this in the MVP.**

## 16. Change Log

| Date       | Version | Author             | Changes                                                                                            |
| ---------- | ------- | ------------------ | -------------------------------------------------------------------------------------------------- |
| 2026-06-02 | 1.0.0   | Architecture Agent | Initial version. Derived from `Vision.md` v1.0.0, `Constraints.md` v1.0.0, and `PRD.md` v2.0.0. Resolved CEO decisions from PRD §9: Netlify + Netlify Functions (frontend), Docker Compose on Ubuntu server (backend), global 40-city coverage, templated "why this fits you". Defined hybrid two-tier topology, deterministic matching algorithm, and the data model. |
| 2026-06-10 | 1.1.0   | Architecture Agent | Updated related docs and references to align with Database.md, API_Spec.md, and Module_Map.md. |
