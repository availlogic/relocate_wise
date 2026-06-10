---
title: "Review Findings & Consistency Audit"
version: "1.0.0"
status: draft
author: "QA Agent"
created: "2026-06-10"
updated: "2026-06-10"
related_docs:
  - "docs/PRD.md"
  - "docs/Architecture.md"
  - "docs/API_Spec.md"
  - "docs/User-Flows.md"
  - "docs/Screen-Specs.md"
---

# RelocateWise — Review Findings & Consistency Audit

This document presents the cross-system consistency audit performed between product requirements, UI/UX designs, and the system architecture for the RelocateWise MVP. The findings are categorized by severity levels (Critical, High, Medium, Low) to guide downstream Coding Agents.

---

## 1. Executive Summary

A comprehensive review of the upstream documents (`PRD.md`, `User-Flows.md`, `Screen-Specs.md`, `UI-Layouts.md`, `Architecture.md`, `API_Spec.md`, `Database.md`, and `Module_Map.md`) shows a high level of conceptual alignment regarding the stateless, session-based nature of the RelocateWise MVP. However, several data contract and mapping discrepancies exist between the UI questionnaire screens and the backend matching API payload. Resolving these discrepancies is necessary to ensure deterministic matching and prevent runtime integration failures.

---

## 2. Structured Issue List

### High Severity Issues

#### HF-1: Questionnaire Budget to API Payload Mismatch
*   **Description**: In `User-Flows.md` (§2, Step 2) and `Screen-Specs.md` (§2), the questionnaire presents a single "Housing Budget Range" question (relative index 1–5). However, the `POST /api/match` API payload in `API_Spec.md` (§2.4) expects four separate parameters: `cost_importance` (0-3), `cost_ceiling` (1-5), `housing_importance` (0-3), and `housing_ceiling` (1-5). There is no specification on how the frontend should map the single user input to these four variables.
*   **Impact**: Downstream coding agents will implement inconsistent mapping logic, leading to mismatch calculations or failed payload validation.
*   **Resolution Recommendation**: The frontend must map the single "Housing Budget Range" value `N` (1-5) as follows:
    *   Set `cost_ceiling` = `N`
    *   Set `housing_ceiling` = `N`
    *   Set `cost_importance` = `3` (High importance default)
    *   Set `housing_importance` = `3` (High importance default)

#### HF-2: Questionnaire Education Rating to API Enum Mismatch
*   **Description**: In `User-Flows.md` (§2) and `Screen-Specs.md` (§2), Question 5 is "Education Quality Priority" which collects a rating of 1–5 (with a "Not Applicable" option). However, the matching API in `API_Spec.md` (§2.4) expects the `education` field to be an enum of `important`, `somewhat`, or `not_relevant`.
*   **Impact**: Frontend inputs cannot be validated directly by backend Zod schemas, resulting in `400 Bad Request` errors.
*   **Resolution Recommendation**: Establish a deterministic mapping in the frontend before sending the API request:
    *   Rating `4` or `5` $\rightarrow$ `"important"`
    *   Rating `2` or `3` $\rightarrow$ `"somewhat"`
    *   Rating `1` or `"Not Applicable"` (or skipped) $\rightarrow$ `"not_relevant"`

---

### Medium Severity Issues

#### MF-1: Density Question vs. Lifestyle Tags Array
*   **Description**: The questionnaire separates the lifestyle inputs into two questions: Question 6 "Community & Lifestyle Fit" (Urban, Suburban, Coastal, Mountain, Arts/Culture) and Question 7 "Location Density Preference" (Urban, Suburban, Rural). The matching API, however, has no `density` field and instead accepts a single array `lifestyle_tags` containing values like `urban`, `suburban`, `coastal`, `mountain`, `arts_culture`.
*   **Impact**: Mismatch in how the two independent questions are packed into the payload.
*   **Resolution Recommendation**: The frontend must merge the selections from both Question 6 and Question 7 into the single `lifestyle_tags` array (e.g., if a user selects "Coastal" and "Urban", the payload is `"lifestyle_tags": ["coastal", "urban"]`).

#### MF-2: Climate Compatibility Groups Undefined
*   **Description**: `Architecture.md` (§6.2, §15.1) notes that the climate matching logic uses a "compatible group" fallback (yielding a `0.5` match score when not an exact match), but leaves the exact compatibility groupings undefined.
*   **Impact**: Downstream matching algorithms and test suites cannot assert deterministic match scores without this mapping.
*   **Resolution Recommendation**: Define the climate compatibility groups clearly in the matching repository:
    *   **Group Warm**: `tropical`, `mediterranean`, `arid`
    *   **Group Moderate**: `temperate`, `mediterranean`, `continental`
    *   **Group Cold**: `continental`, `cold`
    *   If user selects `mediterranean` and city is `temperate`, they belong to the same *Moderate* group and receive a compatibility score of `0.5`. Otherwise, they receive `0.0`.

---

### Low Severity Issues

#### LF-1: File Naming Discrepancies in Documentation
*   **Description**: The `verification-specs` skill inputs refer to `docs/API-Specs.md`, whereas the actual repository contains `docs/API_Spec.md`.
*   **Impact**: Potential confusion for automated scripts tracking repository assets.
*   **Resolution Recommendation**: Treat `docs/API_Spec.md` as the canonical source.

#### LF-2: Cost of Living Score Floor in Database Check Constraints
*   **Description**: `Database.md` DDL defines `city_scores.score` with check constraint `CHECK (score BETWEEN 0 AND 5)`. The PRD states that dimensions are on a `1-5` scale. The database design allows `0` strictly as a fallback for multi-valued dimensions like Climate where the score is unused.
*   **Impact**: Downstream database validation could permit invalid `0` scores for single-valued dimensions (e.g., Cost of Living = 0).
*   **Resolution Recommendation**: Coding agents must ensure that single-valued dimensions (Cost, Housing, Education, Healthcare) are strictly seeded within the `1-5` range, and that only multi-valued dimensions (Climate, Career, Community) allow the `0` fallback.

---

## 3. Undefined or Unused APIs

*   **Geospatial (PostGIS) APIs**: PostGIS functions (like `ST_DWithin` or geography distance calculations) are initialized in the database schema but are unused by any frontend route or matching algorithm in the MVP. They are flagged as "unused but approved" for future scalability.
*   **Proxy-to-Backend Authentication**: `Architecture.md` (§11) mentions that the Netlify Function forwards requests to the Ubuntu API using a "shared secret in a header," but the header key and fallback mechanism for development bypasses are not defined in `API_Spec.md`. Downstream agents must use `x-relocatewise-secret` as the header key.

---

## 4. Security, Edge-Case Gaps, & Performance Risks

*   **Stateless Connection Spikes (Performance Risk)**: Since Netlify Functions are stateless and execute in short-lived containers, they do not maintain persistent connection pools to the backend PostgreSQL instance. High quiz traffic could saturate database connections. A connection pooler (such as PgBouncer) must be deployed on the Ubuntu server.
*   **Input Validation of Lifestyle Tags (Edge-Case)**: If an invalid tag is sent in `lifestyle_tags` via `POST /api/match`, the database sub-score JSON query may fail silently or throw a SQL syntax error. The backend Zod schema must strictly restrict the array values to the 7 defined lifestyle enums.
*   **Rate Limiting Bypass (Security Risk)**: Bypassing the Netlify Function tier in development allows direct calls to the Ubuntu server. In production, CORS must strictly allow only the Netlify CDN domain and reject direct public access to prevent scraping.
