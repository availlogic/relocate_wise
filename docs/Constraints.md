---
title: "Project Constraints"
version: "1.3.0"
status: draft
author: "Human"
created: "2026-06-01"
updated: "2026-06-19"
reviewers: []
related_docs:
  - "docs/Vision.md"
---

# Project Constraints

## Technology Constraints

| Layer    | Technology     | Rationale                                                                 |
| -------- | -------------- | ------------------------------------------------------------------------- |
| Backend  | Node.js        | JavaScript ubiquity, extensive ecosystem, strong JSON handling, async I/O; hosts both API server and scheduled worker jobs |
| Frontend | React          | Component reusability, large community, SEO-friendly SSR option          |
| Database | PostgreSQL     | Robust relational data, excellent geospatial extensions (PostGIS), ACID compliance |

## Architectural Constraints

- **Modular Design**:
  - **Frontend**: Adoption of a "Micro-Frontend" architecture. Major components on the page must be broken into independent, composable parts that interact via API interfaces.
  - **Backend**: Adoption of a "Microservices" architecture. Each functional component must operate as an independent service and communicate via API interfaces.
  - **Database Segregation**: While hosted on the same database instance, data access must be partitioned by schema or tables. Each microservice must only access its own exclusive schemas and tables.
- **Module Documentation & Laziness**:
  - Each micro-frontend and microservice module must maintain a `README.md` file documenting its functions, API, and other module-specific details.
  - This modular documentation enables coding agents to lazy-load modules (saving agent context).
  - Any future change to a module must update its corresponding `README.md` file concurrently.

## Infrastructure Constraints

- **Hosting provider**: Cloudflare, global CDN distribution, and reliability
- **Networking requirements**: HTTPS enforced, CDN for static assets, rate limiting on API endpoints, geographic redundancy for disaster recovery. Cloudflare Tunnel integration must be used to securely route and expose the application backend/frontend.

## Budget Constraints

- **Monthly infrastructure budget**: Free tier of hosting providers
- **Tool/service budget**: $0 for open-source tools and web services

## Deployment Constraints

- **Deployment method**: Containerized deployment (Docker Compose) for consistency across environments
- **CI/CD approach**: GitHub Actions for automated testing and deployment

## Additional Constraints

- **Timeline & Product Stage**: Treat as a GA (v1.0) release. The development timeline is not limited to two weeks; priority is given to delivering a high-quality product meeting all functional and performance requirements without using temporary hacks or shortcuts.
- **Compliance**: GDPR-compliant data handling for EU users; privacy policy and user consent flows required before launch; raw data collected from public sources must comply with data licensing agreements (e.g., Creative Commons, Numbeo API terms)
- **External dependencies & Runtime decoupling**: Minimize third-party API reliance during request time; cache external data in the backend database. All authoritative data collection (UN, OECD, open data portals, Wikipedia, Numbeo) must run asynchronously via scheduled workers (weekly or monthly) and never run synchronously within the matching API path.
- **Geopolitical & Conflict Indicators**: Must explicitly evaluate geopolitical and conflict risk as a standard dimension, lowering matching suitability for zones with active regional conflicts or heightened geopolitical instability.
- **Internationalization (i18n)**: Codebase must be structured to support both English (default) and Chinese languages with a manual UI toggle. Text strings must be localized rather than hardcoded.
- **Responsive Layout Design**: The frontend application must be built responsively to ensure full usability on mobile devices, alongside optimal display on desktop browsers.

## Change Log

| Date       | Version | Author      | Changes                                                                                                                      |
| ---------- | ------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 2026-06-01 | 1.0.0   | Human       | Initial version                                                                                                              |
| 2026-06-17 | 1.1.0   | Antigravity | Added scheduled worker and external raw data collection constraints, military safety details                                 |
| 2026-06-17 | 1.2.0   | Antigravity | Updated hosting provider to Cloudflare, added Cloudflare Tunnel constraints, and renamed military safety to geopolitical and conflict risk. |
| 2026-06-19 | 1.3.0   | Antigravity | Shifted to GA (v1.0) stage, removed strict timeline limit, and added modular micro-frontend and microservices architecture constraints. |
