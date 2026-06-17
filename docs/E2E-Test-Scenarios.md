---
title: "End-to-End Test Scenarios"
version: "1.0.0"
status: draft
author: "QA Agent"
created: "2026-06-10"
updated: "2026-06-10"
related_docs:
  - "docs/PRD.md"
  - "docs/User-Flows.md"
  - "docs/Screen-Specs.md"
---

# RelocateWise — End-to-End Test Scenarios

This document specifies the end-to-end (E2E) test scenarios for RelocateWise. These scenarios represent complete multi-step user journeys that must pass successfully in the browser.

---

## 1. Primary User Journey (Happy Path)

### Scenario E2E-1: Landing to Side-by-Side Comparison
*   **Description**: A new user visits the site, completes the questionnaire, inspects city profiles, constructs a shortlist, and reviews the final side-by-side trade-offs.
*   **Actor**: Unauthenticated User
*   **Execution Steps**:
    1.  **Arrive at `/`**:
        *   Accept the Cookie Consent Banner.
        *   Verify the banner disappears.
    2.  **Start Questionnaire**:
        *   Click "Start Questionnaire".
        *   Verify current route is `/q`.
    3.  **Complete the 8-Step Quiz**:
        *   *Step 1 (Climate)*: Select "Mediterranean", click "Next".
        *   *Step 2 (Cost)*: Select card for score "2", click "Next".
        *   *Step 3 (Career)*: Select "Technology", click "Next".
        *   *Step 4 (Healthcare)*: Select "4" (High), click "Next".
        *   *Step 5 (Education)*: Select "Not Applicable", click "Next".
        *   *Step 6 (Community)*: Select "Coastal", click "Next".
        *   *Step 7 (Density)*: Select "Urban", click "Next".
        *   *Step 8 (Military Safety)*: Select card for score "3" (High importance), click "View Matches".
    4.  **View Ranked Results**:
        *   Verify redirection to `/results`.
        *   Verify exactly 10 cards load.
        *   Verify "Lisbon" is Rank #1.
    5.  **Inspect City Profile**:
        *   Click "View Profile" on the Lisbon card.
        *   Verify route is `/city/lisbon-pt`.
        *   Click "Add to Comparison".
        *   Verify the floating shortlist bar appears with "Lisbon".
        *   Click "Back to Results".
        *   Verify results page preserves the previous shortlist state.
    6.  **Add Second City**:
        *   Check "Compare" checkbox on the Tokyo card.
        *   Verify shortlist bar shows "2 of 3 selected".
        *   Click "Compare Now".
    7.  **Inspect Side-by-Side Comparison**:
        *   Verify route is `/compare`.
        *   Verify two columns are rendered (Lisbon and Tokyo).
        *   Verify the "winner" highlighting is applied on the Cost, Climate, and Military Safety rows.
        *   Click "Back to Results".
        *   Verify return to `/results` with the shortlist intact.
*   **Pass Criteria**: All navigation transitions happen without layout failure, session state is preserved correctly in client memory, and correct winner cells are highlighted.
*   **Priority**: Critical

---

## 2. Alternate and Boundary Journeys

### Scenario E2E-2: Direct Access to Compare Redirection
*   **Description**: User attempts to bypass the questionnaire and access the comparison screen directly with an empty shortlist.
*   **Actor**: Unauthenticated User
*   **Execution Steps**:
    1.  Open the browser and navigate directly to `/compare`.
*   **Expected Behavior**:
    *   The router intercepts the path.
    *   The browser is redirected to the results view `/results`. Since no questionnaire has been submitted yet, it further redirects to the landing page `/` (or `/results` displays a clean empty state with a "Start Quiz" CTA).
    *   A notice is displayed: *"Please select at least 2 cities to compare."*
*   **Priority**: High

### Scenario E2E-3: Re-Quiz Session Reset
*   **Description**: A user completes a questionnaire, shortlists cities, and then decides to start over. The system must completely wipe their session state and shortlist.
*   **Actor**: Unauthenticated User
*   **Execution Steps**:
    1.  Navigate through the quiz to `/results` and add "Lisbon" to the shortlist.
    2.  Verify the shortlist contains "Lisbon".
    3.  Click the "Start Over" button on `/results`.
    4.  Verify the route changes back to `/` or `/q`.
    5.  Verify the shortlist is completely empty in the browser state and `sessionStorage`.
*   **Priority**: High

### Scenario E2E-4: Browser Tab Close Purge
*   **Description**: Verify that closing the browser tab purges all shortlist state.
*   **Actor**: Unauthenticated User
*   **Execution Steps**:
    1.  Navigate through the quiz, view results, and shortlist "Lisbon".
    2.  Verify `sessionStorage` contains `rw:shortlist` with `["lisbon-pt"]`.
    3.  Simulate closing the tab/session (or call page reload in a fresh context).
*   **Expected Behavior**:
    *   The `sessionStorage` is empty.
    *   Navigating back to `/results` shows an empty shortlist.
*   **Priority**: Medium
