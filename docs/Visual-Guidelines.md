---
title: "Visual Guidelines"
version: "1.4.0"
status: draft
author: "Product UI/UX Designer / Antigravity"
created: "2026-06-01"
updated: "2026-06-25"
related_docs:
  - "docs/PRD.md"
  - "docs/Constraints.md"
---

# RelocateWise — Visual Guidelines

This document defines the brand identity, typography system, color palette, spacing tokens, component styling, and accessibility guidelines for the RelocateWise web application. It is structured to serve as the single source of truth for all CSS properties.

---

## 1. Brand Personality & Design Principles

*   **Playful & Tactile**: RelocateWise adopts a friendly, tactile interface that invites interaction. Every UI element looks like a physical, tangible object made of soft clay or matte plastic.
*   **Friendly & Welcoming**: By rejecting clinical, dark-mode flat patterns, we use warm pastel tones, rounded corners, and soft, cushiony spacing to lower relocation anxiety and offer a welcoming experience.
*   **Claymorphic 3D Depth**: Using multi-layered CSS shadows (diffuse outer drop shadows and soft inner highlights), we create a "puffy", 3D extruded neumorphic look, complete with smooth, bouncy transitions.

---

## 2. Design Tokens

### Color Palette (HSL Tokens)

We employ a light-mode-first pastel color scheme leveraging soft clay layers.

```css
:root {
  /* Canvas Background */
  --color-bg-canvas: hsl(252, 63%, 92%);       /* Soft, muted pastel lavender/lilac (#E2DBF8) */
  
  /* Card/Container Backgrounds */
  --color-bg-card: hsl(0, 100%, 98.5%);        /* Warm cream off-white (#FFF9F9) */
  --color-bg-card-alt: hsl(255, 38%, 97.5%);   /* Extremely light purple-grey (#F7F5FC) */
  
  /* Typography Colors */
  --color-text-primary: hsl(258, 30%, 15%);    /* Deep midnight purple for primary text */
  --color-text-secondary: hsl(260, 15%, 38%);  /* Medium muted purple-grey for subtext */
  --color-text-muted: hsl(263, 16%, 58%);      /* Soft purple-grey for inactive text */

  /* Accent Pastels */
  --color-accent-peach: hsl(12, 100%, 82%);    /* Soft Peach/Coral for high-priority highlights (#FFB8A6) */
  --color-accent-yellow: hsl(42, 100%, 82%);   /* Muted Butter Yellow for badges/stars (#FFE5A3) */
  --color-accent-green: hsl(158, 52%, 78%);    /* Mint/Sage Green for positive metrics (#A8E6CF) */
  --color-accent-blue: hsl(182, 43%, 76%);     /* Sky Blue for secondary choices (#A8DADC) */
  --color-accent-lavender: hsl(247, 72%, 86%); /* Soft Lavender Blue for selected states (#C5BEF7) */

  /* Semantic Indicators */
  --color-success: var(--color-accent-green);
  --color-warning: var(--color-accent-yellow);
  --color-danger: var(--color-accent-peach);

  /* Shadows (Claymorphic / Soft 3D Neumorphism) */
  /* Outer shadows reflect natural light drop; Inner shadows create the rounded, puffy bevel */
  --shadow-clay-outer: 8px 12px 24px rgba(135, 120, 200, 0.22);
  --shadow-clay-inner-light: inset 4px 4px 8px rgba(255, 255, 255, 0.85);
  --shadow-clay-inner-dark: inset -4px -4px 8px rgba(135, 120, 200, 0.12);
  --shadow-pressed: inset 4px 4px 8px rgba(135, 120, 200, 0.2), inset -4px -4px 8px rgba(255, 255, 255, 0.8);
  
  /* Animations */
  --transition-bounce: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}
```

### Typography System

Typography must use rounded, friendly fonts loaded from Google Fonts to match the visual identity.

*   **Headings Font**: `'Quicksand', sans-serif` (Rounded terminals, friendly geometry).
*   **Body & UI Font**: `'Nunito', sans-serif` (Rounded, highly legible and soft).
*   **Bilingual Chinese Font Stack**: `"PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif` (Maintains line heights in Chinese Simplified).

| Token Name | Font Family | Size | Weight | Line Height | Use Case |
|---|---|---|---|---|---|
| `--font-h1` | Quicksand | `2.5rem` (40px) | Bold (700) | `1.2` | Hero headlines / Landing |
| `--font-h2` | Quicksand | `1.75rem` (28px) | Bold (700) | `1.3` | Screen titles (Results, Compare) |
| `--font-h3` | Quicksand | `1.35rem` (22px) | Bold (600) | `1.4` | Card titles / Question text |
| `--font-body` | Nunito | `1.0rem` (16px) | Regular (400) | `1.6` | Narrative descriptions / Labels |
| `--font-ui` | Nunito | `0.9rem` (14.4px) | Semi-Bold (600) | `1.5` | Buttons / Metadata / Form fields |
| `--font-caption`| Nunito | `0.75rem` (12px) | Regular (400) | `1.4` | Small legends / Timestamps |

---

## 3. Spacing & Layout Principles

We enforce an **8px grid system** with generous breathing room to accommodate 3D shadow extrusions.

*   **Base Unit**: `8px`
*   **Spacing Scale**:
    *   `--space-xs`: `4px`
    *   `--space-sm`: `8px`
    *   `--space-md`: `16px`
    *   `--space-lg`: `24px` (Thick padding for cards)
    *   `--space-xl`: `32px` (Grid gaps)
    *   `--space-xxl`: `48px`
*   **Layout Grid Rules**:
    *   *Grid Gap*: Use `20px` to `28px` between components. Shadows require space so elements do not overlap.
    *   *Container Max-Width*: `1200px` centered via `margin: 0 auto`.
    *   *Section Padding*: `24px` to `32px` internal padding.

---

## 4. Component Styling Rules

### 1. Claymorphic Cards
*   **Background**: `var(--color-bg-card)` or `var(--color-bg-card-alt)`
*   **Border**: `none` (styled entirely by shadow bevels)
*   **Border Radius**: `24px` to `32px` (extreme rounded corners)
*   **Shadow**: `box-shadow: var(--shadow-clay-outer), var(--shadow-clay-inner-light), var(--shadow-clay-inner-dark)`
*   **Hover Interaction**:
    *   Translate upwards: `transform: translateY(-4px)`
    *   Scale slightly: `transform: scale(1.01)`
    *   Transition: `transition: var(--transition-bounce)`

### 2. Pill Buttons (Primary & Secondary)
*   **Border Radius**: `9999px` (fully rounded pill shape)
*   **Typography**: `--font-ui`, Bold (700)
*   **Primary Button**:
    *   *Background*: `var(--color-accent-lavender)` or `var(--color-accent-peach)`
    *   *Shadow*: `box-shadow: 4px 6px 12px rgba(135, 120, 200, 0.15), var(--shadow-clay-inner-light), var(--shadow-clay-inner-dark)`
    *   *Hover State*: `transform: translateY(-2px);`
    *   *Active State*: Invert shadow to look sunken: `box-shadow: var(--shadow-pressed); transform: translateY(1px);`
*   **Secondary Button**:
    *   *Background*: `var(--color-bg-card-alt)`
    *   *Border*: `1px solid rgba(135, 120, 200, 0.2)`

### 3. Clickable Questionnaire Options
*   Styled as large puffy clay cards.
*   **Default State**: Standard Claymorphic Card.
*   **Selected State**:
    *   *Background*: `var(--color-accent-lavender)`
    *   *Shadow*: `box-shadow: var(--shadow-pressed)` (simulates a pressed button)
    *   *Transition*: Smooth, bouncy toggle easing.

### 4. Progress Bars
*   **Track (Clay Groove)**: Height `12px`, border-radius `9999px`, background `var(--color-bg-card-alt)`, with inner shadow: `box-shadow: inset 2px 2px 4px rgba(0,0,0,0.1), inset -2px -2px 4px rgba(255,255,255,0.8)`.
*   **Sliding Pill**: Height `100%`, border-radius `9999px`, background `var(--color-accent-lavender)` (or semantic accent based on score), with outer lift.

### 5. Metric Badges (Scores/Match %)
*   Oversized, ultra-bold typography centered in a mini soft rounded clay container (`border-radius: 16px`).
*   Uses a light pastel background (e.g. Sage Green for high matches, Peach for low matches).

### 6. Country Flag & Landmark Containers
*   **Flag SVG**: Aspect ratio 3:2, inline, housed in a squircle container with a `12px` border-radius and a light outer drop shadow.
*   **Landmark Photo**: Aspect ratio 16:9, border-radius `20px` to `24px` to match card corners, featuring a subtle outer drop shadow.

---

## 5. Accessibility & Responsive Design Guidelines

### Accessibility (WCAG 2.1 AA Compliance)
*   **Contrast Ratio**: Text colors must maintain a contrast ratio of >= 4.5:1. Primary charcoal text (`var(--color-text-primary)`) complies across all pastel and card backgrounds.
*   **Keyboard Focus**: Active components must render a visible focus border:
    *   `focus-visible` outline: `3px solid var(--color-accent-lavender)`.
*   **Touch Targets**: Touch targets must remain at least `44px x 44px`.

### Responsive Breakpoints
1.  **Mobile**: `< 768px`
    *   Single-column layouts. Gaps shrink to `16px` to fit smaller viewports.
    *   Shortlist bar transitions to a full-width bottom drawer/sheet.
2.  **Tablet**: `768px - 1023px`
    *   Double-column grids. Headers adjust to `--font-h2`.
3.  **Desktop**: `>= 1024px`
    *   Full-width comparison columns, card lists, and header layouts.
