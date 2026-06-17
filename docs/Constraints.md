---
title: "Project Constraints"
version: "1.1.0"
status: draft
author: "Human"
created: "2026-06-01"
updated: "2026-06-17"
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

## Infrastructure Constraints

- **Hosting provider**: Cloudflare or Netlify, global CDN distribution, and reliability
- **Networking requirements**: HTTPS enforced, CDN for static assets, rate limiting on API endpoints, geographic redundancy for disaster recovery

## Budget Constraints

- **Monthly infrastructure budget**: Free tier of hosting providers
- **Tool/service budget**: $0 for open-source tools and web services

## Deployment Constraints

- **Deployment method**: Containerized deployment (Docker Compose) for consistency across environments
- **CI/CD approach**: GitHub Actions for automated testing and deployment

## Additional Constraints

- **Timeline**: MVP delivery within 2 weeks; focus on core location comparison features and seed database before extending scheduled collection scripts
- **Compliance**: GDPR-compliant data handling for EU users; privacy policy and user consent flows required before launch; raw data collected from public sources must comply with data licensing agreements (e.g., Creative Commons, Numbeo API terms)
- **External dependencies & Runtime decoupling**: Minimize third-party API reliance during request time; cache external data in the backend database. All authoritative data collection (UN, OECD, open data portals, Wikipedia, Numbeo) must run asynchronously via scheduled workers (weekly or monthly) and never run synchronously within the matching API path.
- **Geopolitical & Conflict Indicators**: Must explicitly evaluate military safety as a standard dimension, lowering matching suitability for zones with active regional conflicts or heightened geopolitical instability.

## Change Log

| Date       | Version | Author      | Changes                                                                                      |
| ---------- | ------- | ----------- | -------------------------------------------------------------------------------------------- |
| 2026-06-01 | 1.0.0   | Human       | Initial version                                                                              |
| 2026-06-17 | 1.1.0   | Antigravity | Added scheduled worker and external raw data collection constraints, military safety details |
