---
title: "End-to-End Test Scenarios"
version: "1.3.0"
status: draft
author: "QA Agent / Antigravity"
created: "2026-06-10"
updated: "2026-06-25"
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
        *   *Step 2 (Cost)*: Verify option cards display a puffy 3D appearance. Select card for score "2" (verify card transitions to a pressed state with inverted shadow), click "Next".
        *   *Step 3 (Career)*: Select "Technology", click "Next".
        *   *Step 4 (Healthcare)*: Select "4" (High), click "Next".
        *   *Step 5 (Education)*: Select "Not Applicable", click "Next".
        *   *Step 6 (Community)*: Select "Coastal", click "Next".
        *   *Step 7 (Density)*: Select "Urban", click "Next".
        *   *Step 8 (Geopolitical and Conflict Risk)*: Select card for score "3" (High importance), click "View Matches".
    4.  **View Ranked Results**:
        *   Verify redirection to `/results`.
        *   Verify exactly 10 cards load, styled as claymorphic container blocks.
        *   Verify "Lisbon" is Rank #1 and its Match Score is displayed inside a soft rounded clay container badge.
    5.  **Inspect City Profile**:
        *   Click "View Profile" on the Lisbon card.
        *   Verify route is `/city/lisbon-pt`.
        *   Verify progress bars render as hollowed-out clay grooves with sliding rounded pills.
        *   Click "Add to Comparison".
        *   Verify the floating shortlist bar appears with "Lisbon".
        *   Click "Back to Results".
        *   Verify results page preserves the previous shortlist state.
    6.  **Add Second City**:
        *   Check "Compare" checkbox on the Tokyo card.
        *   Verify shortlist bar shows "2 of 3 selected".
        *   Click "Compare Now".
    7.  **Inspect Side-by-Side Comparison**:
        *   Verify route is `/compare` with columns structured as vertical pillowy columns.
        *   Verify two columns are rendered (Lisbon and Tokyo).
        *   Verify the "winner" highlighting is applied on the Cost, Climate, and Geopolitical and Conflict Risk rows using the highlighted clay block style (inset/outset border and pastel background).
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
    3.  Simulate closing the tab/session.
*   **Expected Behavior**:
    *   The `sessionStorage` is empty.
    *   Navigating back to `/results` shows an empty shortlist.
*   **Priority**: Medium

---

## 3. Localization & Responsive Journeys

### Scenario E2E-5: Dynamic Bilingual Switch
*   **Description**: Verify that the user can toggle the interface language between English and Chinese Simplified at any step of their journey, and that all text translates instantly without state loss.
*   **Actor**: Unauthenticated User
*   **Execution Steps**:
    1.  **Arrive at `/`**:
        *   Locate the language toggle in the header. Click "中文".
        *   Verify that page headings, description, and the main CTA button translate to Simplified Chinese.
    2.  **Start Questionnaire**:
        *   Click "开始问卷".
        *   Advance through Step 1 and Step 2 in Chinese.
    3.  **Toggle Mid-Quiz**:
        *   On Step 3, click "English" in the header.
        *   Verify that the current question title and options immediately translate to English.
        *   Verify progress remains on Step 3 of 8.
    4.  **Submit and View Results**:
        *   Complete remaining steps. Submit to view results.
        *   Verify that the results page, result cards, and templates render in English.
        *   Click "中文" in the header.
        *   Verify that the result cards, match percentages, and the "why" explanation templates translate to Chinese (Simplified) dynamically.
*   **Pass Criteria**: Language switches dynamically at any point with zero latency and zero state loss.
*   **Priority**: High

### Scenario E2E-6: Responsive Mobile Flow
*   **Description**: Verify the complete end-to-end relocation decision-support loop functions seamlessly on simulated mobile viewports.
*   **Actor**: Mobile Browser User
*   **Execution Steps**:
    1.  Initialize the test runner with viewport dimensions matching standard mobile screens (375x812 viewport).
    2.  Load `/`. Verify the layout stacks vertically, and no horizontal scrollbars are present.
    3.  Complete the questionnaire. Verify option card buttons fit within screen boundaries.
    4.  Verify results load. Scroll to verify that cards stack vertically, and the floating shortlist bar remains pinned to the bottom of the viewport.
    5.  Add 2 cities to comparison and navigate to `/compare`.
    6.  Verify the comparison table is readable and supports horizontal scrolling for columns without visual clipping or overlap.
*   **Pass Criteria**: Complete flow compiles with no visual layout failures on mobile viewports.
*   **Priority**: High

---

## 4. Modular Micro-Frontend (MFE) Loading

### Scenario E2E-7: Micro-Frontend Decoupled Lazy Loading
*   **Description**: Verify that the Container App successfully lazy loads the child MFEs when navigating routes, conserving initial bundle load size.
*   **Actor**: Unauthenticated User
*   **Execution Steps**:
    1.  Load homepage `/`. Inspect the network assets. Verify only container assets are loaded (no quiz or compare bundle assets).
    2.  Click "Start Questionnaire". Route changes to `/q`. Verify that the browser dynamically fetches the `quiz-mfe` chunk asset.
    3.  Complete the quiz and navigate to `/results`. Verify that `dashboard-mfe` chunk is fetched.
    4.  Navigate to `/compare`. Verify that `compare-mfe` chunk is fetched.
*   **Pass Criteria**: MFE assets are loaded dynamically and lazily on demand based on routing.
*   **Priority**: High
