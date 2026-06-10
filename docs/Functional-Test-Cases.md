---
title: "Functional Test Cases"
version: "1.0.0"
status: draft
author: "QA Agent"
created: "2026-06-10"
updated: "2026-06-10"
related_docs:
  - "docs/PRD.md"
  - "docs/Screen-Specs.md"
  - "docs/Review-Findings.md"
---

# RelocateWise — Functional Test Cases

This document describes the functional test cases for the RelocateWise frontend application. These tests cover user interface interactions, state transitions, input validations, and edge cases.

---

## 1. Mock Reference Dataset

To ensure test repeatability and TDD reproducibility, the following mock dataset representing a subset of cities is used across these test cases:

```json
[
  {
    "slug": "lisbon-pt",
    "name": "Lisbon",
    "country": "Portugal",
    "country_code": "PT",
    "region": "Europe",
    "lat": 38.7223,
    "lng": -9.1393,
    "description": "Coastal city with a Mediterranean climate and strong tech sector.",
    "last_updated": "2026-06-10",
    "dimensions": {
      "climate": { "label": "Mediterranean" },
      "cost": 2,
      "housing": 2,
      "career": { "tech": 5, "finance": 3, "healthcare": 2, "creative": 4, "manufacturing": 1 },
      "education": 3,
      "healthcare": 4,
      "community": { "urban": 3, "suburban": 2, "coastal": 5, "mountain": 1, "arts_culture": 4, "family_oriented": 3, "expat_friendly": 5 }
    }
  },
  {
    "slug": "new-york-us",
    "name": "New York City",
    "country": "United States",
    "country_code": "US",
    "region": "North America",
    "lat": 40.7128,
    "lng": -74.006,
    "description": "Metropolitan financial hub with a temperate climate.",
    "last_updated": "2026-06-10",
    "dimensions": {
      "climate": { "label": "Temperate" },
      "cost": 5,
      "housing": 5,
      "career": { "tech": 4, "finance": 5, "healthcare": 4, "creative": 5, "manufacturing": 1 },
      "education": 4,
      "healthcare": 5,
      "community": { "urban": 5, "suburban": 1, "coastal": 2, "mountain": 1, "arts_culture": 5, "family_oriented": 2, "expat_friendly": 4 }
    }
  },
  {
    "slug": "tokyo-jp",
    "name": "Tokyo",
    "country": "Japan",
    "country_code": "JP",
    "region": "Asia-Pacific",
    "lat": 35.6762,
    "lng": 139.6503,
    "description": "High-density clean metropolis with a temperate climate.",
    "last_updated": "2026-06-10",
    "dimensions": {
      "climate": { "label": "Temperate" },
      "cost": 3,
      "housing": 4,
      "career": { "tech": 4, "finance": 4, "healthcare": 4, "creative": 3, "manufacturing": 3 },
      "education": 4,
      "healthcare": 5,
      "community": { "urban": 5, "suburban": 2, "coastal": 1, "mountain": 2, "arts_culture": 4, "family_oriented": 3, "expat_friendly": 3 }
    }
  }
]
```

---

## 2. Test Cases

### 2.1 Landing Screen & Cookie Consent

#### FTC-1: First-Time Visit Cookie Consent Display
*   **Feature Name**: Cookie Consent Banner
*   **Preconditions**: Browser `localStorage` is completely empty (no previous consent recorded).
*   **Steps**:
    1. Navigate to the landing page route `/`.
    2. Verify the visibility of the sticky Cookie Consent Banner at the bottom.
    3. Click "Decline".
*   **Expected Result**: The cookie consent banner disappears. In `localStorage`, `rw:cookie_consent` is set to `false`. No third-party analytical cookies are initialized.
*   **Priority**: High

#### FTC-2: Cookie Consent Persistence
*   **Feature Name**: Cookie Consent Banner
*   **Preconditions**: `localStorage` has `rw:cookie_consent` set to `true`.
*   **Steps**:
    1. Navigate to the landing page route `/`.
*   **Expected Result**: The Cookie Consent Banner is **not** displayed.
*   **Priority**: Medium

---

### 2.2 Questionnaire (Multi-Step Template)

#### FTC-3: Linear Navigation & Progress Percentage
*   **Feature Name**: Multi-Step Questionnaire
*   **Preconditions**: User is on the landing page `/`.
*   **Steps**:
    1. Click "Start Questionnaire" to load step 1.
    2. Verify progress bar fills to 14.2% and text shows "Step 1 of 7".
    3. Click "Next" without selecting an option.
    4. Verify progress bar fills to 28.5% and text shows "Step 2 of 7".
    5. Click "Back" button.
*   **Expected Result**: The UI returns to step 1. Progress bar returns to 14.2% and text shows "Step 1 of 7".
*   **Priority**: High

#### FTC-4: Skipping Questions
*   **Feature Name**: Multi-Step Questionnaire
*   **Preconditions**: User is on Step 3 of the questionnaire ("Career & Industry Focus").
*   **Steps**:
    1. Click the "Skip" button in the upper right.
*   **Expected Result**: The questionnaire advances to Step 4. The `career_industry` choice in `SessionState` remains `null`.
*   **Priority**: High

#### FTC-5: "N/A" Selection in Education Quality
*   **Feature Name**: Multi-Step Questionnaire
*   **Preconditions**: User is on Step 5 of the questionnaire ("Education Quality Priority").
*   **Steps**:
    1. Click the option card labeled "Not Applicable" (representing households without children).
    2. Click "Next".
*   **Expected Result**: The questionnaire advances to Step 6. In `SessionState`, the `education` field value is recorded as `"not_relevant"`.
*   **Priority**: High

---

### 2.3 Ranked Results Screen

#### FTC-6: Skeleton Loading State
*   **Feature Name**: Ranked Results Screen
*   **Preconditions**: Network throttling is set to slow broadband (adding mock network latency to API responses).
*   **Steps**:
    1. Submit Step 7 of the questionnaire to route to `/results`.
*   **Expected Result**: The UI renders a skeleton results layout consisting of 10 card blocks with a pulsing gradient background. No text content is visible during this phase.
*   **Priority**: Medium

#### FTC-7: Display of Match Results
*   **Feature Name**: Ranked Results Screen
*   **Preconditions**: Backend API returns the mock dataset matches.
*   **Steps**:
    1. Wait for results to load on `/results`.
    2. Verify exactly 10 cards are shown.
    3. Verify Card #1 displays: rank "1", City Name, Country, Match Score badge, and a non-empty "Why this fits" message.
*   **Expected Result**: Card elements match API response values perfectly.
*   **Priority**: High

#### FTC-8: Floating Shortlist Bar Visibility
*   **Feature Name**: Session Shortlist
*   **Preconditions**: User is on `/results`. Shortlist is empty.
*   **Steps**:
    1. Verify the floating shortlist bar is hidden.
    2. Check the "Compare" checkbox on Card #1 (Lisbon).
    3. Verify shortlist bar becomes visible at the bottom.
    4. Verify shortlist bar shows text "1 of 3 selected" and a chip with "Lisbon" and an "X" icon.
*   **Expected Result**: Bar visibility transitions correctly based on array length.
*   **Priority**: High

#### FTC-9: Shortlist Overflow Prevention
*   **Feature Name**: Session Shortlist
*   **Preconditions**: User has already checked 3 cities (Lisbon, NYC, Tokyo) in the shortlist.
*   **Steps**:
    1. Locate a 4th city card on the results page.
    2. Click its "Compare" checkbox.
*   **Expected Result**: The checkbox remains unchecked. A non-blocking toast alert is displayed: *"You can compare up to 3 cities. Please remove one first."*
*   **Priority**: High

---

### 2.4 City Profile Screen

#### FTC-10: Display of 7 Standard Dimensions
*   **Feature Name**: City Profile Screen
*   **Preconditions**: User navigates to `/city/lisbon-pt`.
*   **Steps**:
    1. Verify the profile page shows the city name "Lisbon" and country "Portugal".
    2. Verify 7 horizontal progress bars are rendered (Climate, Cost, Housing, Career, Healthcare, Education, Community).
    3. Verify Climate shows label "Mediterranean".
    4. Verify Cost, Housing, Career, Healthcare, Education, and Community display ratings matching the mock dataset (e.g. Cost: 2/5, Housing: 2/5).
*   **Expected Result**: Ratings align with database/JSON scores.
*   **Priority**: High

#### FTC-11: Add/Remove from Shortlist on Profile Screen
*   **Feature Name**: Session Shortlist
*   **Preconditions**: User is on `/city/lisbon-pt`. Lisbon is not shortlisted.
*   **Steps**:
    1. Click the button labeled "Add to Comparison".
    2. Verify the button text changes to "Remove from Comparison".
    3. Verify Lisbon appears in the floating shortlist bar at the bottom.
    4. Click "Remove from Comparison".
*   **Expected Result**: Button text reverts to "Add to Comparison" and the Lisbon chip is removed from the shortlist bar.
*   **Priority**: High

---

### 2.5 Side-by-Side Comparison Screen

#### FTC-12: Redirection on Insufficient Cities
*   **Feature Name**: Side-by-Side Comparison Screen
*   **Preconditions**: Shortlist contains only 1 city (Lisbon).
*   **Steps**:
    1. Navigate directly to `/compare` via the browser URL bar.
*   **Expected Result**: The browser automatically redirects to the `/results` page. A notice is displayed: *"Please select at least 2 cities to compare."*
*   **Priority**: High

#### FTC-13: Winner Cell Highlight Validation
*   **Feature Name**: Side-by-Side Comparison Screen
*   **Preconditions**: Shortlist contains Lisbon (Cost: 2/5, Career: tech 5) and NYC (Cost: 5/5, Career: tech 4). Note: A lower index for Cost represents cheaper, which is the "winner" condition.
*   **Steps**:
    1. Navigate to `/compare`.
    2. Verify the Cost row highlights the Lisbon cell (index 2/5) as the winner.
    3. Verify the Career row highlights the Lisbon cell (tech 5/5 vs NYC tech 4/5) as the winner.
*   **Expected Result**: Winner cells have CSS class applying the accent primary border and background shade.
*   **Priority**: High
