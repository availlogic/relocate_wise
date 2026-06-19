---
title: "System Architecture"
version: "1.4.0"
status: draft
author: "Architecture Agent / Antigravity"
created: "2026-06-02"
updated: "2026-06-19"
related_docs:
  - "docs/Vision.md"
  - "docs/Constraints.md"
  - "docs/PRD.md"
  - "docs/Database.md"
  - "docs/API_Spec.md"
---

# RelocateWise — System Architecture

This document describes the technical design for the RelocateWise system. It is grounded in `Vision.md`, `Constraints.md`, and `PRD.md` (v3.3.0). The system is built using a decoupled, modular design consisting of a Micro-Frontend architecture on the client side and a Microservices architecture on the backend, ensuring long-term scalability and clean separation of concerns.

## 1. Design Principles

The architecture follows six rules derived from the product principles in `Vision.md` and the constraints:

1. **Modular & Decoupled Architectural Alignment** — The system is split into composable frontend parts (Micro-Frontends) and independent backend services (Microservices). They communicate exclusively via standardized API contracts or Custom Events.
2. **Decoupled Ingestion & Matching** — The matching engine runs entirely against the local PostgreSQL database containing normalized scores. Authoritative data is fetched from primary external APIs asynchronously via a background ingestion service, updating the matching database via internal API endpoints, ensuring zero runtime dependencies during user sessions.
3. **Decide once, ship once** — A deterministic matching algorithm (no ML, no LLM, no randomness) is mandatory. Same inputs ⇒ same output, always. This makes the matching engine trivially testable.
4. **Spend nothing** — No paid services. No paid data feeds. No paid monitoring. No paid auth. Cloudflare-style "richness" is achieved by a small, well-built Node + Postgres service on hardware the CEO already owns.
5. **The browser is the session** — The shortlist is held in the browser, not the server. The server therefore has no user state to manage, which removes most of typical backend complexity (no sessions, no auth, no cookies, no GDPR data inventory).
6. **Agent-Optimized Documentation** — Each architectural module maintains a structured `README.md` documenting its inputs, outputs, APIs, and folder layout. This allows future LLM-based coding agents to lazy load documentation, saving context tokens and optimizing search.

## 2. System Topology

The deployment uses a **three-tier secure deployment**: a static frontend tier on Cloudflare Pages, a proxy routing tier, and a private backend microservices tier on the Ubuntu server. All public API traffic is routed securely to the server via an outbound **Cloudflare Tunnel (`cloudflared`)**, ensuring no ports need to be opened on the host firewall.

```
                   ┌──────────────────────────────────────────────┐
                   │               Browser Client                 │
                   │    Container App (Orchestrator, i18n, state) │
                   │  ┌─────────────────┐  ┌──────────────────┐   │
                   │  │  Quiz MFE       │  │  Compare MFE     │   │
                   │  └─────────────────┘  └──────────────────┘   │
                   │  ┌─────────────────┐                         │
                   │  │  Dashboard MFE  │                         │
                   │  └─────────────────┘                         │
                   └──────────────────────┬───────────────────────┘
                                          │ HTTPS (via Cloudflare Pages)
                                          ▼
         ┌────────────────────────────────────────────────────────┐
         │                    Cloudflare Edge                     │
         │  ┌──────────────────┐     ┌─────────────────────────┐  │
         │  │  Pages CDN       │     │  Cloudflare WAF /       │  │
         │  │  Static Assets   │     │  Rate Limiting Rules    │  │
         │  └──────────────────┘     └────────────┬────────────┘  │
         └────────────────────────────────────────┼───────────────┘
                                                  │ HTTPS (Cloudflare Tunnel)
                                                  ▼
         ┌────────────────────────────────────────────────────────┐
         │        Ubuntu Server (Docker Compose Network)          │
         │  ┌───────────────────────┐                             │
         │  │ cloudflared (Tunnel)  │                             │
         │  └───────────┬───────────┘                             │
         │              │ HTTP                                    │
         │  ┌───────────▼───────────┐                             │
         │  │ API Gateway Router    │                             │
         │  └───────────┬───────────┘                             │
         │              ├─────────────────────────┐               │
         │              │ HTTP                    │ HTTP (Internal)
         │  ┌───────────▼───────────┐  ┌──────────▼────────────┐  │
         │  │ Matching Service      │  │ Data Ingestion Service│  │
         │  │ (Node.js Service)     │  │ (Node.js Service)     │  │
         │  └───────────┬───────────┘  └──────────┬────────────┘  │
         │              │                         │               │
         │        Reads │                   Writes│               │
         │        /Writes                         │               │
         │  ┌───────────▼─────────────────────────▼────────────┐  │
         │  │          PostgreSQL Database Cluster             │  │
         │  │  ┌────────────────────┐  ┌────────────────────┐  │  │
         │  │  │  matching schema   │  │  ingestion schema  │  │  │
         │  │  └────────────────────┘  └────────────────────┘  │  │
         │  └──────────────────────────────────────────────────┘  │
         └────────────────────────────────────────────────────────┘
```

**Why this topology?** Using Cloudflare Tunnel (`cloudflared`) allows us to securely route traffic from Cloudflare Edge directly into the containerized Docker network on the Ubuntu server without opening any inbound ports. The static React container loads the individual Micro-Frontends (MFE). The API Gateway routes `/api/health`, `/api/match`, and `/api/cities/*` to the Matching Service, while blocking external access to internal endpoints. PostgreSQL database access is partitioned by schemas, ensuring each microservice can only query and write to its designated tables.

## 3. Technology Stack

| Layer        | Choice                                | Notes / justification                                                                                  |
| ------------ | ------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Frontend     | **React 18 + Vite + TypeScript**      | Fast HMR; TS catches contract drift; Vite produces a small static bundle.                              |
| Orchestration| **React Lazy / Dynamic Imports**      | Simple and lightweight routing-based MFE loading without complex build-time Module Federation.         |
| Routing      | **React Router 6**                    | Standard. One stack: `/`, `/q`, `/results`, `/city/:id`, `/compare`, `/privacy`.                       |
| State        | **React Context + `useReducer`**      | Sufficient. No Redux/Zustand — keeps states local to relevant MFE modules.                             |
| Styling      | **Plain CSS modules**                 | No Tailwind. A hand-rolled token file is enough.                                                      |
| HTTP client  | Native `fetch`                        | No axios. The API has ≤5 endpoints.                                                                    |
| Backend      | **Node.js 20 LTS + TypeScript**       | Express/Fastify API servers for microservices.                                                        |
| Validation   | **Zod**                               | Schema validation for request bodies and API client payloads.                                          |
| Database     | **PostgreSQL 16 + PostGIS 3.4**       | Robust relational data, excellent geospatial extensions (PostGIS), schema-level isolation.            |
| ORM / query  | **Knex (raw query builder)**          | Lighter than Prisma; explicit SQL. Migrations run independently per schema.                           |
| Scheduling   | **Node-Cron**                         | Standard scheduler running inside the Ingestion Service.                                               |
| Tunnel       | **Cloudflare Tunnel (cloudflared)**   | Outbound-only tunnel daemon mapping public hostnames to Caddy/API Gateway inside Docker network.       |
| CI/CD        | **GitHub Actions**                    | Lint, test, build on every push. Manual `docker compose pull && up -d` on server.                      |
| Frontend CDN | **Cloudflare Pages** (free tier)      | Auto-deploy from `main`. Build settings: `npm run build`, publish `dist/`.                              |

## 4. Component Responsibilities

### 4.1 Frontend (React SPA Container & MFEs)
- **Container Orchestrator**: Manages global routing, client-side translation (i18n), and layout wrapper. Loads child MFEs dynamically.
- **Quiz MFE**: Controls the step-by-step preference questionnaire. Emits a Custom Event with the completed user profile on finish.
- **Compare MFE**: Manages the comparison dashboard, aligning the 8 dimensions. Highlight logic is executed here.
- **Dashboard MFE**: Displays individual city profiles, metric scores, flag graphics, and landmark images.
- **Shared States**: Session-based shortlist is stored in `sessionStorage` and shared across MFEs via native browser Custom Events or Context.

### 4.2 Cloudflare Edge Proxy & WAF (edge tier)
- Provide global CDN distribution and SSL/TLS termination for frontend assets.
- Enforce Web Application Firewall (WAF) rate limiting (e.g. 60 requests / 10 min per client IP) to block DDoS attempts.
- Handle edge caching for static assets and proxy `/api/*` queries to the backend tunnel.

### 4.3 API Gateway Router (Node.js Service)
- Single entry point inside the Docker network.
- Rates limit client requests at the network level and proxies public traffic to the **Matching Service**.
- Blocks access to internal service-to-service communication endpoints (e.g., internal ingestion update endpoints).

### 4.4 Matching Service (Node.js Service)
- Owns the `matching` PostgreSQL schema (including `cities` and `city_scores` tables).
- Exposes `POST /api/match` to compute deterministic matching rankings.
- Exposes `GET /api/cities` and `GET /api/cities/:slug` to query location data.
- Exposes `PUT /api/internal/cities/:slug/scores` (internal) to allow the Ingestion Service to push updated scores.

### 4.5 Data Ingestion Service (Node.js Service)
- Owns the `ingestion` PostgreSQL schema (pipeline logs and staging records).
- Runs automated tasks on a weekly/monthly cron schedule.
- Fetches raw metrics from UN, OECD, Wikipedia, Numbeo, and Travel advisories.
- Processes and normalizes metrics into 1-5 scores.
- Calls the Matching Service's internal API to update city scores, ensuring it never writes directly to the `matching` database schema.

---

## 5. Data Model & Database Segregation

Database isolation is implemented using PostgreSQL schemas. Each service connects to the database using dedicated database users with privileges restricted to their schemas.

- **`matching` Schema (Owned by Matching Service)**: Contains `cities` and `city_scores` tables.
- **`ingestion` Schema (Owned by Ingestion Service)**: Contains staging tables and execution logs.

See `docs/Database.md` for full DDL and entity schema design.

---

## 6. Matching Algorithm

See `docs/PRD.md` Section 9.1 and `docs/Architecture.md` (previous versions) for full matching weights, dimension mappings, and templated "why this fits you" logic. These remain identical and are fully owned and executed by the **Matching Service**.

---

## 7. API Surface

See `docs/API_Spec.md` for full path definitions, error structures, payload shapes, and the internal sync contract.

---

## 8. Repository Layout

```
relocatewise/
├── db/                             # Shared migrations and database configs
│   ├── migrations/
│   │   └── 001_init.sql
│   └── seeds/
│       └── cities.json
├── web/                            # Frontend Monorepo (Micro-Frontends)
│   ├── container/                  # Host orchestrator, i18n, and core styles
│   ├── quiz-mfe/                   # Questionnaire module
│   ├── compare-mfe/                # Side-by-side comparison module
│   ├── dashboard-mfe/              # City profile profiles module
│   ├── README.md                   # MFE workspace documentation
│   └── package.json
├── api/                            # Backend Monorepo (Microservices)
│   ├── gateway/                    # API Gateway service
│   ├── matching-service/           # Matching API service (owns 'matching' schema)
│   ├── ingestion-service/          # Cron harvesters (owns 'ingestion' schema)
│   ├── README.md                   # Microservices workspace documentation
│   └── package.json
├── docker-compose.yml              # Local development orchestration
└── README.md                       # Root documentation
```

## Change Log

| Date       | Version | Author             | Changes                                                                                            |
| ---------- | ------- | ------------------ | -------------------------------------------------------------------------------------------------- |
| 2026-06-02 | 1.0.0   | Architecture Agent | Initial version. |
| 2026-06-10 | 1.1.0   | Architecture Agent | Updated related docs and references to align with Database.md, API_Spec.md.                        |
| 2026-06-17 | 1.2.0   | Antigravity        | Added raw data collection background worker, node-cron scheduling layout, military safety formulas |
| 2026-06-17 | 1.3.0   | Antigravity        | Replaced Netlify with Cloudflare Pages & Tunnel, mapped military_safety to Geopolitical and Conflict Risk, added bilingual i18n & mobile layouts. |
| 2026-06-19 | 1.4.0   | Antigravity        | Shifted to GA v1.0 scope. Transitioned to modular Micro-Frontend and Microservice architectures with PostgreSQL schema segregation, and added module-level README constraints. |
