---
title: "Acceptance Criteria & Definition of Done"
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

# RelocateWise — Acceptance Criteria & Definition of Done

This document provides the final acceptance criteria for each major feature area of the RelocateWise MVP, along with a strict Definition of Done (DoD) that implementation teams must satisfy.

---

## 1. Feature-Level Acceptance Criteria

### Feature 1: Cookie Consent & Privacy Notice
*   **Acceptance Conditions**:
    *   Sticky overlay is visible on first-time launch.
    *   Analytical tracking initialization must be blocked unless "Accept All" is selected.
    *   Selecting either option hides the banner immediately.
    *   No persistent cookies or analytical storage actions are taken without explicit user click.
    *   A link to the `/privacy` route is present on the banner and site footer.

### Feature 2: Preference Questionnaire
*   **Acceptance Conditions**:
    *   The UI must render exactly 7 questionnaire steps sequentially, showing one question per screen.
    *   A progress bar must dynamically reflect steps (14.2% per step).
    *   "Back" navigation must return the user to the previous step while preserving their chosen option.
    *   "Skip" navigation must be enabled on all steps, advancing the user and recording a neutral weight/default.
    *   On the final step, the primary button must render as "View Matches". Clicking it must submit the payload and navigate to `/results`.

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

### Feature 5: Side-by-Side Comparison Matrix
*   **Acceptance Conditions**:
    *   Matrix aligns the 7 dimensions row-by-row for 2 or 3 shortlisted cities.
    *   For each row, the cell containing the highest score must be highlighted with a distinctive border and background.
    *   If Cost of Living is evaluated, the lower index score (representing cheaper cost) must be treated as the winner.
    *   Removing a city from the comparison must adjust the columns immediately. If columns fall below 2, the user is redirected to the `/results` view.

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
*   [ ] Playwright E2E tests are implemented and pass cleanly for all happy and boundary paths.

### 3. Build & Deployment
*   [ ] React client builds successfully (`npm run build`) without errors.
*   [ ] Backend runs successfully in a local Docker Compose environment.
*   [ ] A GitHub Actions CI script executes and passes lint, unit tests, and smoke builds on push.

### 4. Documentation & Consistency
*   [ ] Local API updates are documented inside [API_Spec.md](file:///Users/victorxu/projects/relocate_wise/docs/API_Spec.md).
*   [ ] Local schema changes are documented inside [Database.md](file:///Users/victorxu/projects/relocate_wise/docs/Database.md).
*   [ ] The root [README.md](file:///Users/victorxu/projects/relocate_wise/README.md) is updated to document any modified setup or test invocation steps.
*   [ ] Verification results are summarized in a walkthrough document.
