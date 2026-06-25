# RelocateWise — UI Layouts & Wireframes

This document details the page structural skeletons, component placement grids, responsive transitions, and visual wireframes for all views of the RelocateWise application.

---

## 1. Global Page Shell

Every screen inherits a global container shell to maintain UI consistency.

```
+-------------------------------------------------------------+
|  [Logo] RelocateWise      [EN/ZH]      [Compare (0) Button] | <-- Header
+-------------------------------------------------------------+
|                                                             |
|                      [ MAIN CONTENT ]                       | <-- Responsive Content
|                                                             |
+-------------------------------------------------------------+
|  Privacy Policy | Terms of Service    (C) 2026 RelocateWise | <-- Footer
+-------------------------------------------------------------+
|  Cookie Consent: We use cookies. [Accept] [Decline]         | <-- Floating Sticky Banner
+-------------------------------------------------------------+
```

*   **Header**: Sticky at the top (`position: sticky; top: 0; z-index: 100`). Contains the brand logo (left), the bilingual dynamic language selector `[EN/ZH]` toggle (middle), and the "Compare Shortlist" shortcut button (right). Owned by the **Container App**.
*   **Footer**: Placed at bottom. Standard horizontal link items. Owned by the **Container App**.
*   **Cookie Consent Banner**: Positioned at bottom (`position: fixed; bottom: 0; left: 0; width: 100%; z-index: 150`). Owned by the **Container App**.

---

## 2. Landing Screen Layout

A clean, single-column promotional and CTA grid.

*   **MFE Module Owner**: Container App

```
+-------------------------------------------------------------+
|                       RelocateWise                          |
+-------------------------------------------------------------+
|                                                             |
|             Find Your Next Home, Powered by Data.           |
|  Answer a 5-minute questionnaire and get objective city     |
|             recommendations tailored to you.                |
|                                                             |
|                  [ Start Questionnaire ]                    |
|                                                             |
|  +------------------+ +------------------+ +--------------+  |
|  |Objective Matching| | Deep Comparisons | |Privacy First |  |
|  |No sponsor bias.  | | Side-by-side.    | |No signup.    |  |
|  +------------------+ +------------------+ +--------------+  |
|                                                             |
+-------------------------------------------------------------+
```

### Grid Layout Settings
*   **Main Container**: `max-width: 800px; padding: var(--space-xxl) var(--space-lg); display: flex; flex-direction: column; align-items: center; text-align: center; gap: var(--space-xl)`.
*   **Value Grid**: `display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-lg)`.
    *   *Mobile Adaptation*: Drops to `grid-template-columns: 1fr` (vertical stack).

---

## 3. Questionnaire Layout

Designed to focus the user's attention on a single preference dimension at a time.

*   **MFE Module Owner**: Quiz MFE

```
+-------------------------------------------------------------+
|  < Back             [====== Step 3 of 8 ======]      Skip > |
+-------------------------------------------------------------+
|                                                             |
|              What is your primary career industry?          |
|                 Select the industry you work in.            |
|                                                             |
|       +-------------------+     +-------------------+       |
|       |     [icon/svg]    |     |     [icon/svg]    |       |
|       |      Technology   |     |       Finance     |       |
|       +-------------------+     +-------------------+       |
|       |     [icon/svg]    |     |     [icon/svg]    |       |
|       |      Creative     |     |     Healthcare    |       |
|       +-------------------+     +-------------------+       |
|                                                             |
|                         [ Next ]                            |
|                                                             |
+-------------------------------------------------------------+
```

### Grid Layout Settings
*   **Header Bar**: `display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-xl)`.
*   **Option Selector Grid**: `display: grid; grid-template-columns: repeat(2, 1fr); gap: var(--space-md)`.
    *   *Mobile Adaptation*: Adjusts to `grid-template-columns: 1fr` (vertical stack of tall cards).
    *   *Card Padding*: `var(--space-lg)`.

---

## 4. Ranked Results Layout

Shows the top 10 matched cities along with a floating shortlist.

*   **MFE Module Owner**: Dashboard MFE (city card stack) & Compare MFE (shortlist bar)

```
+-------------------------------------------------------------+
|  Your Top 10 Matches                      [ Start Over ]    |
+-------------------------------------------------------------+
|                                                             |
|  +-------------------------------------------------------+  |
|  | #1. Amsterdam, Netherlands              [94%] Match  |  |
|  | Why: fits your Mediterranean climate & Tech preferences. |  |
|  | [View Profile]                     [ ] Compare        |  |
|  +-------------------------------------------------------+  |
|  +-------------------------------------------------------+  |
|  | #2. Lisbon, Portugal                    [89%] Match  |  |
|  | Why: fits your Mediterranean climate & Cost preferences. |  |
|  | [View Profile]                     [ ] Compare        |  |
|  +-------------------------------------------------------+  |
|  ...                                                        |
+-------------------------------------------------------------+
|  Floating Shortlist: 2 of 3 Selected:                       |
|  [ Amsterdam X ] [ Lisbon X ]              [ Compare Now ]  | <-- Floating Bar
+-------------------------------------------------------------+
```

### Grid Layout Settings
*   **Main Wrapper**: `display: grid; grid-template-columns: 1fr; gap: var(--space-md); padding-bottom: 100px;` (prevents floating shortlist bar from overlaying content).
*   **Result Card**: `display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: var(--space-md)`.
    *   *Mobile Adaptation*: Stack vertically: Rank and Header, Body, then Action Row (View Profile next to Compare checkbox).
*   **Shortlist Bar Layout**: `position: fixed; bottom: 0; left: 0; width: 100%; display: flex; justify-content: space-between; align-items: center; padding: var(--space-md) var(--space-lg); background: var(--color-bg-card); box-shadow: var(--shadow-clay-outer)`.

---

## 5. City Profile Layout

Detailed layout featuring a top split section and a full-width metrics grid at the bottom on large viewports.

*   **MFE Module Owner**: Dashboard MFE

```
+-------------------------------------------------------------+
|  < Back to Results                                          |
+-------------------------------------------------------------+
|                                                             |
|  [Flag SVG] Amsterdam, Netherlands                          |
|  [ Add to Comparison ]                                      |
|                                                             |
|  +--------------------------------+ +---------------------+  |
|  | Details (Left Column)          | | Landmark Photo      |  |
|  |                                | | (Right Column, 50%  |  |
|  | Coordinates: 52.3676, 4.9041   | |  size container)    |  |
|  | Data last updated: 2026-06-17  | | +-----------------+ |  |
|  |                                | | |  [Photo 16:9]   | |  |
|  | Summary:                       | | +-----------------+ |  |
|  | Amsterdam is the capital of... | |                     |  |
|  +--------------------------------+ +---------------------+  |
|                                                             |
|  +--------------------------------------------------------+  |
|  | Dimension Scores (Metrics)                              |  |
|  |                                                        |  |
|  | Climate: Continental                                   |  |
|  | Cost of Living: =====                                  |  |
|  | Housing:       =====                                   |  |
|  | Career Fit:    ====                                    |  |
|  | Healthcare:    =====                                   |  |
|  | Education:     =====                                   |  |
|  | Lifestyle:     =====                                   |  |
|  | Geop. Risk:    =====                                   |  |
|  +--------------------------------------------------------+  |
|                                                             |
+-------------------------------------------------------------+
```

### Grid Layout Settings
*   **Profile Top Split Section**: `display: grid; grid-template-columns: 2fr 1fr; gap: var(--space-xl); margin-bottom: var(--space-lg)`.
    *   *Left Column*: Text details (Coordinates, Last Updated, City Summary description).
    *   *Right Column*: Representative landmark image container (maximum dimension `max-width: 300px`).
    *   *Mobile Adaptation*: Drops to `grid-template-columns: 1fr` (Text details first, followed by the scaled Landmark Image container).
*   **Profile Bottom Section (Metrics Grid)**: Full width block placed below the top section.
*   **Metrics Row**: `display: grid; grid-template-columns: 150px 1fr; align-items: center; gap: var(--space-md); margin-bottom: var(--space-sm)`.

---

## 6. Side-by-Side Comparison Layout

Responsive matrix layout matching columns to shortlisted cities.

*   **MFE Module Owner**: Compare MFE

```
+-------------------------------------------------------------+
|  City Comparison                          [Back to Results] |
+-------------------------------------------------------------+
|                                                             |
|  Dimension      | Amsterdam         | Lisbon                |
|  ---------------+-------------------+-----------------------|
|                 | Amsterdam, NL     | Lisbon, PT            |
|                 | [ Remove ]        | [ Remove ]            |
|  ---------------+-------------------+-----------------------|
|  Cost of Living | Index: 4/5        | Index: 2/5 [Winner]   | <-- Highlighted Cell
|  ---------------+-------------------+-----------------------|
|  Housing Afford.| Index: 3/5        | Index: 3/5            |
|  ---------------+-------------------+-----------------------|
|  Career Fit     | Index: 5/5 [Winner]| Index: 3/5           | <-- Highlighted Cell
|  ---------------+-------------------+-----------------------|
|  Healthcare     | Index: 5/5        | Index: 4/5            |
|  ---------------+-------------------+-----------------------|
|  Education      | Index: 5/5        | Index: 1/5            |
|  ---------------+-------------------+-----------------------|
|  Climate        | Continental       | Medit. [Winner]       | <-- Highlighted Cell
|  ---------------+-------------------+-----------------------|
|  Lifestyle Fit  | Index: 4/5        | Index: 5/5 [Winner]   | <-- Highlighted Cell
|  ---------------+-------------------+-----------------------|
|  Geop. Risk     | Index: 5/5 [Winner]| Index: 4/5           | <-- Highlighted Cell
|                                                             |
+-------------------------------------------------------------+
```

### Grid Layout Settings
*   **Comparison Matrix (Table)**: `display: grid; grid-template-columns: 200px repeat(var(--shortlist-count), 1fr); gap: var(--space-sm)`.
    *   *Tablet Adaptation*: Set column widths to scale proportionally.
    *   *Mobile Adaptation*: If width < 600px, matrix converts to horizontal scroll (`overflow-x: auto`) for city columns, preserving the frozen left "Dimension" column (`position: sticky; left: 0`).
*   **Winner Highlight Cells**: Box-shadow overlay `var(--shadow-pressed)` and background color `var(--color-accent-lavender)` (or other matching pastel accent).
```
