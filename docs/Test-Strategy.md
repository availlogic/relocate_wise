---
title: "Test Strategy"
version: "1.0.0"
status: draft
author: "QA Agent"
created: "2026-06-10"
updated: "2026-06-10"
related_docs:
  - "docs/PRD.md"
  - "docs/Architecture.md"
  - "docs/Review-Findings.md"
---

# RelocateWise — Test Strategy

This document outlines the testing methodology, tools, environments, test levels, risk-based priorities, and Test-Driven Development (TDD) protocols for the RelocateWise MVP.

---

## 1. Testing Scope

The scope of testing encompasses all frontend and backend components of the RelocateWise application:
*   **Frontend SPA**: Questionnaire flow, results presentation, profile views, side-by-side comparison matrix, state persistence in `sessionStorage`, and cookie consent tracking.
*   **Netlify Proxy Layer**: Edge rate-limiting, CORS validation, and API forwarding secret header handling.
*   **Backend Node.js API**: Zod request schema validation, token-bucket rate-limiting, Caddy TLS configurations, and health liveness probes.
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
| **System/Operations** | Verify Caddy TLS renewal, Docker Compose service startup, and Netlify edge routing. | Manual Verification CLI / scripts | Verify zero downtime deployment path |

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
*   **External Service Mocking**: In E2E tests, mock the Netlify Proxy layer or proxy endpoint results if testing the frontend in isolation, but ensure that at least one E2E suite verifies the live, unmocked network flow between the React client and the backend server.
*   **Time and Randomness**: Since matching is 100% deterministic, tests must assert exact output matches. Avoid random seed generators in test cases.
