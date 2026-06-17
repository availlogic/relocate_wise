---
title: "System Architecture"
version: "1.3.0"
status: draft
author: "Architecture Agent / Antigravity"
created: "2026-06-02"
updated: "2026-06-17"
related_docs:
  - "docs/Vision.md"
  - "docs/Constraints.md"
  - "docs/PRD.md"
  - "docs/Database.md"
  - "docs/API_Spec.md"
---

# RelocateWise — System Architecture

This document describes the technical design for the RelocateWise system. It is grounded in `Vision.md`, `Constraints.md`, and `PRD.md` (v3.2.0). The dominant infrastructure constraints are the global CDN deployment for the frontend, self-hosted Docker backend, and the asynchronous scheduled worker for raw data collection.

## 1. Design Principles

The architecture follows six rules derived from the product principles in `Vision.md` and the constraints:

1. **One loop, one process** — The user interface is a single linear flow (questionnaire → results → profile/compare). The architecture reflects that: a SPA with one router and one matching API.
2. **Decoupled Ingestion & Matching** — Per `Constraints.md`, the matching engine runs entirely against the local PostgreSQL database containing normalized scores. Authoritative data is fetched from primary external APIs asynchronously via background cron jobs, ensuring zero runtime dependencies during user sessions.
3. **Decide once, ship once** — A deterministic matching algorithm (no ML, no LLM, no randomness) is mandatory. Same inputs ⇒ same output, always. This makes the matching engine trivially testable.
4. **Spend nothing** — No paid services. No paid data feeds. No paid monitoring. No paid auth. Cloudflare-style "richness" is achieved by a small, well-built Node + Postgres service on hardware the CEO already owns.
5. **The browser is the session** — The shortlist is held in the browser, not the server. The server therefore has no user state to manage, which removes most of the typical backend complexity (no sessions, no auth, no cookies, no GDPR data inventory).
6. **Primary Source Timeliness** — Data is sourced directly from primary authoritative platforms (UN, OECD, wikipedia, numbeo, government open data) and refreshed regularly via scheduled workers to maintain continuous accuracy.

## 2. System Topology

The deployment uses a **two-tier secure deployment**: a static tier on Cloudflare Pages and a private backend tier on the CEO's Ubuntu server. The Ubuntu server runs the database, API server, and scheduled ingestion worker in a Docker Compose environment. All public API traffic is routed securely to the server via an outbound **Cloudflare Tunnel (`cloudflared`)**, ensuring no ports need to be opened on the host firewall.

```
                  ┌─────────────────────────────────────────────┐
                  │                Browser (SPA)                │
                  │  React + Vite, static assets, no server     │
                  │  state, shortlist in sessionStorage         │
                  └────────────────────┬────────────────────────┘
                                       │ HTTPS (via Cloudflare Pages CDN)
                                       ▼
        ┌──────────────────────────────────────────────────────┐
        │                 Cloudflare Edge                      │
        │  ┌────────────────┐    ┌────────────────────────┐    │
        │  │  Pages CDN     │    │  Cloudflare WAF /      │    │
        │  │  Static Assets │    │  Rate Limiting Rules   │    │
        │  └────────────────┘    └─────────────┬──────────┘    │
        └──────────────────────────────────────┼───────────────┘
                                               │ HTTPS (Cloudflare Tunnel)
                                               ▼
                  ┌─────────────────────────────────────────────┐
                  │  Ubuntu server (Docker Compose)             │
                  │  ┌──────────────────────┐                   │
                  │  │ cloudflared (Tunnel) │                   │
                  │  │ Outbound daemon      │                   │
                  │  └──────────┬───────────┘                   │
                  │             │ local network (HTTP)          │
                  │  ┌──────────▼───────────┐                   │
                  │  │ caddy (Web server)   │                   │
                  │  │ Local proxy          │                   │
                  │  └──────────┬───────────┘                   │
                  │             │                               │
                  │  ┌──────────▼───────────┐                   │
                  │  │ api  (Node.js)       │                   │
                  │  │ Express/Fastify API  │                   │
                  │  └──────────┬───────────┘                   │
                  │             │                               │
                  │  ┌──────────▼───────────┐                   │
                  │  │ db (Postgres+PostGIS)│ ◄───┐             │
                  │  └──────────────────────┘     │ Updates     │
                  │             ▲                 │ database    │
                  │             │ Reads/Writes    │             │
                  │  ┌──────────┴───────────┐     │             │
                  │  │ Ingestion Worker     │ ────┘             │
                  │  │ (Node.js Scheduled)  │ ───► Pulls raw data from
                  │  └──────────────────────┘      UN, OECD, Gov portals,
                  │                                Numbeo, Wikipedia
                  └─────────────────────────────────────────────┘
```

**Why Cloudflare Tunnel?** Using Cloudflare Tunnel (`cloudflared`) allows us to securely route traffic from Cloudflare Edge directly into the containerized Docker network on the Ubuntu server without opening any inbound ports (e.g., 80 or 443) on the server's firewall. Cloudflare Pages provides free global CDN for the React SPA, and routes `/api/*` to the backend via a Page Rule/Worker proxy. Caddy acts as a lightweight local proxy for incoming traffic inside the Docker network, routing `/api/*` requests to the Fastify API. The scheduled ingestion worker runs asynchronously on the same server, triggering updates to the Postgres instance without exposing write endpoints to the public internet.

## 3. Technology Stack

| Layer        | Choice                                | Notes / justification                                                                                  |
| ------------ | ------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Frontend     | **React 18 + Vite + TypeScript**      | Fast HMR; TS catches contract drift; Vite produces a small static bundle.                              |
| Routing      | **React Router 6**                    | Standard. One stack: `/`, `/q`, `/results`, `/city/:id`, `/compare`, `/privacy`.                       |
| State        | **React Context + `useReducer`**      | Sufficient. No Redux/Zustand — adds ceremony for one screen-deep state.                                 |
| Styling      | **Plain CSS modules**                 | No Tailwind. A hand-rolled token file is enough.                                                      |
| HTTP client  | Native `fetch`                        | No axios. The API has ≤5 endpoints.                                                                    |
| Backend      | **Node.js 20 LTS + TypeScript**       | Express API server and scheduled job scheduler (using node-cron).                                     |
| Validation   | **Zod**                               | Schema validation for request bodies and API client payloads.                                          |
| Database     | **PostgreSQL 16 + PostGIS 3.4**       | Robust relational data, excellent geospatial extensions (PostGIS), ACID compliance.                     |
| ORM / query  | **Knex (raw query builder)**          | Lighter than Prisma; explicit SQL. Migrations included.                                                |
| Scheduling   | **Node-Cron**                         | Standard scheduler running inside the API/worker container.                                            |
| Local Proxy  | **Caddy** (Docker runtime)            | Acts as local reverse proxy, response compression, and development HTTPS provider.                    |
| Tunnel       | **Cloudflare Tunnel (cloudflared)**   | Outbound-only tunnel daemon mapping public hostnames to Caddy/API inside the Docker network.            |
| CI/CD        | **GitHub Actions**                    | Lint, test, build on every push. Manual `docker compose pull && up -d` on server.                      |
| Frontend CDN | **Cloudflare Pages** (free tier)      | Auto-deploy from `main`. Build settings: `npm run build`, publish `dist/`.                              |

## 4. Component Responsibilities

### 4.1 Frontend (React SPA)
- Render the five screens (landing, questionnaire, results, city profile, compare) and the legal pages.
- Own the **shortlist** in `sessionStorage`.
- Submit questionnaire answers to `POST /api/match` and render the response.
- Read city profiles from `GET /api/cities/:id`.

### 4.2 Cloudflare Edge Proxy & WAF (edge tier)
- Provide global CDN distribution and SSL/TLS termination for frontend assets.
- Enforce Web Application Firewall (WAF) rate limiting (e.g. 60 requests / 10 min per client IP) to block DDoS attempts.
- Handle edge caching for static assets and proxy `/api/*` queries to the backend tunnel.
- Cache single city profiles (`GET /api/cities/:slug`) for **60 seconds** (TTL) at the edge to optimize database load.

### 4.3 Backend API Server (Node.js API on Ubuntu)
- Accept questionnaire submissions, run the matching algorithm against the local database, return the top 10.
- Serve city profiles by ID.
- **Refuse** any request that would modify database states via online requests.
- Expose `/api/health` and `/api/match`.

### 4.4 Ingestion Worker (Scheduled Job on Ubuntu)
- Run on a weekly or monthly schedule using a node-cron job scheduler.
- Retrieve raw data (e.g. climate records, cost parameters, crime indices, geopolitical safety advisories, school indexes) directly from UN, OECD, Wikipedia, Numbeo, and government open data APIs.
- Parse, clean, and normalize raw values to standard 1–5 dimension scores.
- Execute SQL transaction blocks to update the database tables (`cities` and `city_scores`), modifying `last_updated` timestamps.

### 4.5 Database (PostgreSQL + PostGIS on Ubuntu)
- Holds the city dataset (30–50 rows) and the 8 dimension scores.
- Holds no user data.
- Seeded via `db/seeds/cities.json` on first boot; updated dynamically by the Ingestion Worker.

## 5. Data Model

### 5.1 Tables DDL

```sql
CREATE TABLE IF NOT EXISTS cities (
  id            SERIAL PRIMARY KEY,
  slug          TEXT UNIQUE NOT NULL,
  name          TEXT NOT NULL,
  country       TEXT NOT NULL,
  country_code  CHAR(2) NOT NULL,
  region        TEXT NOT NULL,
  lat           DOUBLE PRECISION NOT NULL,
  lng           DOUBLE PRECISION NOT NULL,
  geom          GEOMETRY(Point, 4326),
  description   TEXT NOT NULL,
  last_updated  DATE NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS city_scores (
  city_id     INTEGER NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
  dimension   TEXT NOT NULL CHECK (dimension IN ('climate', 'cost', 'housing', 'career', 'education', 'healthcare', 'community', 'military_safety')),
  score       SMALLINT NOT NULL CHECK (score BETWEEN 0 AND 5),
  sub_scores  JSONB,
  PRIMARY KEY (city_id, dimension)
);
```

## 6. Matching Algorithm

### 6.1 User Profile Payload

The questionnaire results map to a `UserProfile` schema:

```json
{
  "climate": "mediterranean",
  "cost_importance": 3,
  "cost_ceiling":  3,
  "housing_importance": 3,
  "housing_ceiling":  3,
  "career_industry": "tech",
  "education":       "important",
  "healthcare_importance": 2,
  "military_safety_importance": 3,
  "lifestyle_tags":  ["urban", "coastal"]
}
```

### 6.2 Per-dimension match (0..1)

For each city `c` and each dimension `d`, compute `m(c, d) ∈ [0, 1]`:

| Dimension | Formula |
| ----------- | ---------------------------------------------------------------------------------------- |
| climate     | `1.0` if `c.climate.label == user.climate`, else `0.5` if compatible group, else `0.0`. |
| cost        | `1.0` if `c.cost <= user.cost_ceiling`; else linear penalty `(5 - c.cost) / (5 - ceiling)`. |
| housing     | Same as cost.                                                                             |
| career      | `c.career[user.career_industry] / 5`, or `0.5` (neutral) if user has no industry.          |
| education   | `c.education / 5` if `user.education != "not_relevant"`, else dimension **excluded**.      |
| healthcare  | `c.healthcare / 5`.                                                                       |
| community   | `max(c.community[tag] for tag in user.lifestyle_tags) / 5`, or `0.5` if no tags chosen.   |
| military_safety | `c.military_safety / 5` (Internal representation of **Geopolitical and Conflict Risk** dimension. Lower scores heavily depress overall city match rating). |

### 6.3 Per-dimension weight

| Dimension | Weight |
| ----------- | ----------------------------------------------------------------- |
| climate     | `1` always |
| cost        | `cost_importance` mapped to `{0, 0.5, 1, 2}` |
| housing     | `housing_importance` mapped to `{0, 0.5, 1, 2}` |
| career      | `1` if user picked an industry, else `0` |
| education   | `0` if `not_relevant`, else `1` |
| healthcare  | `healthcare_importance` mapped to `{0, 0.5, 1, 2}` |
| community   | `1` if user picked ≥1 tag, else `0` |
| military_safety | `military_safety_importance` mapped to `{0, 1, 2.5, 4}` (Higher Geopolitical and Conflict Risk priority acts as a heavy filter) |

Weights are normalized: `w_d' = w_d / Σ w_d` over the **included** dimensions.

### 6.4 Overall match

`match(c) = Σ_d w_d' · m(c, d)` ∈ [0, 1]. Scaled to 0–100 and rounded to an integer for display.

### 6.5 "Why this fits you" (templated)

| Top dimension | Template |
| ------------- | --------------------------------------------------------------------- |
| climate       | "Matches your {climate} climate preference"                            |
| cost          | "Fits your housing and cost budget"                                    |
| housing       | "Fits your housing and cost budget"                                    |
| career        | "Strong {industry} job market"                                         |
| education     | "Strong schools and education options"                                 |
| healthcare    | "Strong healthcare access"                                             |
| community     | "Matches your {tag1, tag2} lifestyle"                                 |
| military_safety | "High geopolitical stability and physical safety" (Represents Geopolitical and Conflict Risk) |

## 7. API Surface

| Method | Path                  | Purpose                                  | Auth | Notes                                                       |
| ------ | --------------------- | ---------------------------------------- | ---- | ----------------------------------------------------------- |
| POST   | `/api/match`          | Rank cities from a user profile          | None | Body = §6.1 shape. Returns top 10 by `match DESC`.          |
| GET    | `/api/cities/:slug`   | City profile (8 dimensions + description) | None | One row by slug. Used by `/city/:slug` route.                |
| GET    | `/api/health`         | Liveness probe                           | None | Returns `{ "ok": true, "version": "<git-sha>" }`.           |

## 8. Frontend Architecture

### 8.1 Routes

| Path             | Screen                | Notes                                                                 |
| ---------------- | --------------------- | --------------------------------------------------------------------- |
| `/`              | Landing               | One sentence + "Start the questionnaire" button.                      |
| `/q`             | Questionnaire         | One question per screen; progress bar; Back/Skip on every screen.     |
| `/results`       | Ranked results        | Top 10 cards; "Compare" button appears when ≥2 are short-listed.      |
| `/city/:slug`    | City profile          | 8 dimensions on a 1–5 scale + description + last_updated.             |
| `/compare`       | Comparison            | 2–3 cities × 8 dimensions, best-per-row highlighted.                   |
| `/privacy`       | Privacy policy        | Static page. Linked from footer and consent banner.                   |

### 8.2 Bilingual Localization (i18n)

- Supports dynamically toggling the entire user interface between **English** (default) and **Chinese (Simplified)**.
- Localized strings are stored in static JSON translation files, bundled into the frontend assets to guarantee zero latency during language switches.

### 8.3 Responsive Layouts & Mobile Access

- Built strictly using custom media queries and modern responsive layout strategies (CSS Flexbox/Grid).
- Guaranteed full operational usability (questionnaire, cards, side-by-side comparison tables, interactive charts) on desktop, tablet, and mobile browsers (simulated iOS and Android viewports).

## 9. End-to-End Data Flow

```
User answers questionnaire -> POST /api/match -> Runs matching algorithm -> Renders Ranked Results
                                                     ▲
                                                     │ Query local PostgreSQL
                                                     ▼
Primary authoritative data sources -> Scheduled Ingestion Worker -> Writes to PostgreSQL Database
(UN, OECD, Gov Portal, Numbeo)        (runs weekly/monthly)
```

## 10. Deployment & Operations

### 10.1 Backups & Re-seeding
- The database is updated dynamically by the ingestion pipeline.
- To prevent data loss, a weekly database backup job executes `pg_dump` on the PostgreSQL container, archiving results to local storage.
- The `db/seeds/cities.json` remains in Git as a static bootstrap file to initialize fresh developer or staging environments.

## 11. Performance & Capacity

- Ranking returned in < 1 s (p95) over 40 rows. Matching algorithm complexity `O(N · D)` where `N=40`, `D=8` dimensions.
- Ingestion tasks run asynchronously and decoupled from API routing, preserving zero impact on matching request latency.
- Dataset size: 40 cities, 8 dimensions ($8 \times 40 = 320$ score rows).

## 12. Repository Layout

```
relocatewise/
├── db/
│   ├── migrations/
│   │   └── 001_init.sql
│   └── seeds/
│       └── cities.json             # bootstrap seed data
├── api/
│   ├── src/
│   │   ├── jobs/
│   │   │   ├── ingestion.ts        # scheduled raw data collection jobs
│   │   │   └── scheduler.ts        # node-cron scheduler setup
│   │   ├── server.ts
│   │   ├── routes/
│   │   │   ├── match.ts            # evaluates 8 dimensions
│   │   │   └── cities.ts
```

## Change Log

| Date       | Version | Author             | Changes                                                                                            |
| ---------- | ------- | ------------------ | -------------------------------------------------------------------------------------------------- |
| 2026-06-02 | 1.0.0   | Architecture Agent | Initial version. |
| 2026-06-10 | 1.1.0   | Architecture Agent | Updated related docs and references to align with Database.md, API_Spec.md.                        |
| 2026-06-17 | 1.2.0   | Antigravity        | Added raw data collection background worker, node-cron scheduling layout, military safety formulas |
| 2026-06-17 | 1.3.0   | Antigravity        | Replaced Netlify with Cloudflare Pages & Tunnel, mapped military_safety to Geopolitical and Conflict Risk, added bilingual i18n & mobile layouts. |
