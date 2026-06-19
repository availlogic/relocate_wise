---
title: "Acceptance Criteria & Definition of Done"
version: "1.2.0"
status: draft
author: "QA Agent / Antigravity"
created: "2026-06-10"
updated: "2026-06-19"
related_docs:
  - "docs/PRD.md"
  - "docs/Architecture.md"
---

# RelocateWise — Acceptance Criteria & Definition of Done

This document provides the final acceptance criteria for each major feature area of the RelocateWise GA v1.0 release, along with a strict Definition of Done (DoD) that implementation teams must satisfy.

---

## 1. Feature-Level Acceptance Criteria

### Feature 1: Cookie Consent & Privacy Notice
*   **Acceptance Conditions**:
    *   Sticky overlay is visible on first-time launch.
    *   Analytical tracking initialization must be blocked unless "Accept All" is selected.
    *   Selecting either option hides the banner immediately.
    *   No persistent cookies or analytical storage actions are taken without explicit user click.
    *   A link to the `/privacy` route is present on the banner and site footer.

### Feature 2: Preference Questionnaire (Quiz MFE)
*   **Acceptance Conditions**:
    *   The Quiz MFE must render exactly 8 questionnaire steps sequentially, showing one question per screen.
    *   A progress bar must dynamically reflect steps (12.5% per step) and preserve state across language toggles.
    *   "Back" navigation must return the user to the previous step while preserving their chosen option.
    *   "Skip" navigation must be enabled on all steps, advancing the user and recording a neutral weight/default.
    *   On the final step, the Quiz MFE must dispatch a Custom Event `rw:quiz_completed` with the `UserProfile` data payload. Clicking "View Matches" navigates to `/results`.

### Feature 3: Ranked Results Matching
*   **Acceptance Conditions**:
    *   Upon questionnaire submission, exactly 10 ranked cities must return.
    *   Result cards must display Rank (1-10), City Name, Country, Match Score (%), and a "Why this fits" message.
    *   The "Why this fits" message must be generated dynamically from the matching engine's top contribution dimensions.
    *   Clicking the "Compare" checkbox must add the city to the session shortlist.
    *   A "Start Over" button must navigate back to step 1 and reset all state.

### Feature 4: Session Shortlist & Floating Bar
*   **Acceptance Conditions**:
    *   The shortlist must hold a maximum of 3 cities.
    *   The floating bar is hidden if shortlist length is 0.
    *   Checking a 4th city card is blocked and triggers a toast notification.
    *   The "Compare Now" button must be disabled unless shortlist contains at least 2 cities.
    *   The shortlist is cleared automatically if the user starts a new quiz or closes the browser tab.

### Feature 5: Side-by-Side Comparison Matrix (Compare MFE)
*   **Acceptance Conditions**:
    *   Compare MFE aligns the 8 dimensions row-by-row for 2 or 3 shortlisted cities.
    *   For each row, the cell containing the highest score must be highlighted with a distinctive border and background.
    *   If Cost of Living is evaluated, the lower index score (representing cheaper cost) must be treated as the winner. For Geopolitical and Conflict Risk (internal key: `military_safety`, stored in the `matching.city_scores` schema table), the higher index score is the winner.
    *   Removing a city from the comparison must adjust the columns immediately. If columns fall below 2, the user is redirected to the `/results` view.

### Feature 6: Bilingual Localization (i18n)
*   **Acceptance Conditions**:
    *   The header must feature a dynamic language toggle for English and Simplified Chinese.
    *   Toggling the language immediately translates all static page headers, questionnaires, results cards, "why this fits" summaries (including secondary dimensions for dual-dimension ties), city/country/region names, city descriptions, and city profile dimensions.
    *   Toggling the language must preserve the user's current session state (e.g. current questionnaire screen, selected shortlist).

### Feature 7: Responsive Mobile Layouts
*   **Acceptance Conditions**:
    *   All UI screens must be fully functional and fit within mobile viewport widths (320px–375px) without horizontal page overflow.
    *   Option cards and buttons must meet mobile accessibility touch targets.
    *   The comparison table must enable horizontal scrolling or column wrapping to prevent clipping on mobile viewports.

### Feature 8: Scheduled Ingestion Pipeline (Ingestion Service)
*   **Acceptance Conditions**:
    *   The Ingestion Service background task successfully executes via the node-cron scheduler or manual CLI triggers.
    *   Sourced indicators from UN, OECD, Wikipedia, Numbeo, and geopolitical/security advisory feeds are successfully parsed.
    *   Log entries are written to `ingestion.pipeline_logs` for auditability.
    *   The processed scores are written to the database by invoking the Matching Service internal API (`PUT /api/internal/cities/:slug/scores`) with a pre-shared authentication key. Direct cross-schema SQL inserts/updates are strictly forbidden.
    *   The affected city records' `last_updated` timestamps are updated to the current date.

---

## 2. Definition of Done (DoD)

Before any task or feature is marked as complete, it must meet the following Definition of Done criteria:

### 1. Code Quality & Standards
*   [ ] Written in TypeScript, conforming to modern React 18 / Node.js standards.
*   [ ] ESLint runs cleanly with no errors or warnings.
*   [ ] Prettier formatting is applied.
*   [ ] Unrelated legacy comments and docstrings are preserved.

### 2. Testing Completeness
*   [ ] Unit tests are written for all matching algorithms, reducer states, and utility functions using **Vitest**.
*   [ ] Statement coverage for core matching logic is $\ge 90\%$.
*   [ ] API routes have integration coverage $\ge 80\%$ (verified via Supertest).
*   [ ] Integration tests verify API Gateway routing rules, proxy behavior, and block public access to internal sync endpoints.
*   [ ] Database integration tests verify PostgreSQL schema isolation, role permissions, and block unauthorized cross-schema writes.
*   [ ] Playwright E2E tests are implemented and pass cleanly for all happy and boundary paths, including dynamic language toggles and mobile scaling.

### 3. Build & Deployment
*   [ ] React client container builds successfully (`npm run build`) without errors.
*   [ ] Frontend MFEs can be dynamically lazy-loaded on routing demand.
*   [ ] Backend runs successfully in a local Docker Compose network, utilizing the API Gateway proxy.
*   [ ] A GitHub Actions CI script executes and passes lint, unit tests, and smoke builds on push.

### 4. Documentation & Consistency
*   [ ] Each of the 7 modules contains a standard-structured `README.md` documenting inputs, outputs, file layouts, and API/event contracts.
*   [ ] Local API updates are documented inside [API_Spec.md](file:///Users/victorxu/projects/relocate_wise/docs/API_Spec.md).
*   [ ] Local schema changes are documented inside [Database.md](file:///Users/victorxu/projects/relocate_wise/docs/Database.md).
*   [ ] The root [README.md](file:///Users/victorxu/projects/relocate_wise/README.md) is updated to document any modified setup or test invocation steps.
*   [ ] Verification results are summarized in a walkthrough document.
