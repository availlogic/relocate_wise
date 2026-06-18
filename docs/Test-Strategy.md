---
title: "Test Strategy"
version: "1.1.0"
status: draft
author: "QA Agent / Antigravity"
created: "2026-06-10"
updated: "2026-06-17"
related_docs:
  - "docs/PRD.md"
  - "docs/Architecture.md"
---

# RelocateWise — Test Strategy

This document outlines the testing methodology, tools, environments, test levels, risk-based priorities, and Test-Driven Development (TDD) protocols for the RelocateWise MVP.

---

## 1. Testing Scope

The scope of testing encompasses all frontend and backend components of the RelocateWise application:
*   **Frontend SPA**: Questionnaire flow, results presentation, profile views, side-by-side comparison matrix, state persistence in `sessionStorage`, and cookie consent tracking.
*   **Cloudflare Edge Layer**: Cloudflare WAF rate-limiting, CORS configuration, edge caching rules, and Cloudflare Tunnel routing.
*   **Backend Node.js API**: Zod request schema validation, token-bucket rate-limiting, Caddy internal routing, and health liveness probes.
*   **Matching Engine**: The deterministic weighted matching algorithm and templated "why this fits you" copy generator.
*   **Database Tier**: Schema migration integrity and automatic seeding execution from version-controlled JSON data.

---

## 2. Testing Levels & Coverage Targets

We employ a multi-layered testing pyramid to verify functional correctness and prevent regressions.

| Testing Level | Scope / Objective | Tooling | Coverage Target |
|---|---|---|---|
| **Unit Testing** | Verify isolated utility functions, React hooks, Zod validation schemas, matching calculations, and templated text generation. | **Vitest** (both sides) + **React Testing Library** | 90% Statement Coverage on business logic (matching engine & reducer state) |
| **Integration Testing** | Verify database migrations, seed loading, Repository-to-DB queries, and API-to-database contracts. | **Vitest** + **Supertest** (Node.js API container) | 80% Endpoint Coverage |
| **End-to-End (E2E)** | Simulate complete browser sessions (cookie acceptance, questionnaire completion, results shortlisting, comparison views, and session clearing). | **Playwright** | 100% Critical User Flows |
| **System/Operations** | Verify Caddy local proxy, cloudflared tunnel connection, and Cloudflare Pages redirection rules. | Manual Verification CLI / scripts | Verify zero downtime deployment path |

---

## 3. Risk-Based Testing Priorities

Due to the 3-day MVP delivery timeframe, testing resources are prioritized based on functional risk and compliance impact:

### Priority 1 (P1): Core Matching & Determinism (High Risk)
*   **Risk**: Minor errors in the matching logic will result in incorrect city rankings, destroying user trust.
*   **Verification focus**: Exhaustive unit testing of the `scoreMatching()` function using diverse questionnaire inputs, verifying exact sorting order and deterministic outputs.

### Priority 2 (P2): GDPR & State Leakage (High Compliance Risk)
*   **Risk**: Persisting user inputs or shortlists on the server or letting session state leak across users violates the GDPR-compliant state requirements.
*   **Verification focus**: Integration tests proving no write operations exist on the server, and E2E tests verifying that session state is completely purged when the browser tab closes.

### Priority 3 (P3): User Session Shortlist & Comparison Matrix (Medium Risk)
*   **Risk**: UI bugs in the comparison matrix could lead to incorrect columns showing up, layout overflow on mobile, or incorrect winner cell highlights.
*   **Verification focus**: Playwright UI tests validating shortlist boundaries (maximum of 3), redirection triggers, and horizontal scroll preservation on mobile viewports.

---

## 4. Automation & TDD Guidance

Downstream Coding Agents must adhere to strict Test-Driven Development (TDD) practices:

### The TDD Cycle
1.  **RED**: Write a failing unit or integration test defining the expected behavior. For example, before implementing `matching/score.ts`, write a test that passes a mock questionnaire profile and asserts the correct ranking sequence.
2.  **GREEN**: Write the minimal implementation code required to make the test pass.
3.  **REFACTOR**: Clean up the code structure, ensure proper typing, and eliminate redundancy while keeping the test suite green.

### Mocking Guidelines
*   **Database Mocking**: Avoid mocking PostgreSQL during database integration tests; integration tests must run against a local test database container spun up in the Docker Compose testing environment.
*   **External Service Mocking**: In E2E tests, mock the Cloudflare Edge layer or proxy endpoint results if testing the frontend in isolation, but ensure that at least one E2E suite verifies the live, unmocked network flow between the React client and the backend server.
*   **Time and Randomness**: Since matching is 100% deterministic, tests must assert exact output matches. Avoid random seed generators in test cases.

---

## 5. Upstream Document Issue Log

The following discrepancies were identified and resolved during the cross-domain validation:

| ID | Source Document | Description | Severity | Resolution |
|---|---|---|---|---|
| QA-ISS-1 | `docs/PRD.md` | PRD v3.2.0 renamed "Military Safety" to "Geopolitical and Conflict Risk", but underlying database schema (`Database.md`) and codebase use `'military_safety'` / `military_safety_importance`. | **MEDIUM** | Standardized `'military_safety'` as the internal database/API key representation, mapping it to "Geopolitical and Conflict Risk" in all user-facing UI and documentation. |
| QA-ISS-2 | `docs/API_Spec.md` | API spec referenced legacy Netlify Functions edge proxy headers (`API_SECRET`, `x-relocatewise-secret`), which are redundant in the Cloudflare Tunnel setup. | **LOW** | Removed Netlify function secret headers. Documented that Cloudflare Tunnel private ingress resolves edge-to-backend security. |
| QA-ISS-3 | `docs/UI-Layouts.md` | Lack of mobile design guidelines for side-by-side comparison tables, risking layout break on narrow screens. | **LOW** | Added responsive UI functional and E2E test cases to mandate horizontal scrolling or adaptive columns for mobile viewports. |
| QA-ISS-4 | `web/src/i18n` | Mismatch between backend `whyKey: 'military_safety'` and i18n JSON files `"militarySafety"`, causing translation failure. | **HIGH** | Updated QA plan to standardize i18n JSON keys to `"military_safety"`. |
| QA-ISS-5 | `docs/API_Spec.md` | Lack of structured support for dual-dimension match reasons (returning pre-rendered English string in `why_vars.secondary`). | **HIGH** | Updated API specification to introduce `secondary_key` and `secondary_vars` nested under `why_vars`, and added frontend localized concatenation logic. |
| QA-ISS-6 | `db/seeds/cities.json` | Broken landmark image links for Vancouver and Tel Aviv due to Wikimedia Commons case-sensitivity or referrer blocks. | **HIGH** | Directed coding agent to correct direct URLs and verify case-sensitivity in the seed files. |
| QA-ISS-7 | `web/src/i18n` | Development doc reference `(PRD §6.1 D8)` leaked into user-facing translation strings. | **LOW** | Removed references from translation JSON help strings. |
| QA-ISS-8 | `docs/Screen-Specs.md` | Step 6 questionnaire lacked a visual "No Preference" option card, displaying warning subtext instead. | **MEDIUM** | Added a "No Preference" card choice to Screen Specs and updated functional test cases. |
| QA-ISS-9 | `docs/UI-Layouts.md` | Detail page layout photo size too large and clashing with future details columns. | **MEDIUM** | Restructured Section 5 to use a split layout with the image on the right (halved in size) and metrics below. |
