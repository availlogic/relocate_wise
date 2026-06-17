# RelocateWise — Visual Guidelines

This document defines the brand identity, typography system, color palette, spacing tokens, component styling, and accessibility guidelines for the RelocateWise web application. It is structured to serve as the single source of truth for all CSS properties.

---

## 1. Brand Personality & Design Principles

*   **Trustworthy & Objective**: The visual theme must look professional and authoritative. Recommendations are based on rigorous data, so the interface must reject gimmicky patterns in favor of clean, structural clarity.
*   **Calm & Focused**: Relocation is stressful. The design uses spacious layouts, a deep, dark color scheme, and clear visual hierarchies to minimize user anxiety and cognitive overload.
*   **Premium & State-of-the-Art**: Use rich glassmorphism (layered semi-transparency), glowing hover states, and smooth CSS transitions to create a premium, polished user experience.

---

## 2. Design Tokens

### Color Palette (HSL Tokens)

We employ a dark-mode-first color scheme leveraging high-contrast visual layers.

```css
:root {
  /* Background Layers */
  --color-bg-primary: hsl(224, 25%, 10%);     /* Deep space charcoal */
  --color-bg-secondary: hsl(224, 25%, 15%);   /* Slightly lighter background block */
  --color-surface-glass: hsla(224, 25%, 20%, 0.65); /* Glass card background */
  --color-border-glass: hsla(0, 0%, 100%, 0.08);    /* Subtle light border */

  /* Brand Accents */
  --color-accent-primary: hsl(171, 100%, 41%); /* Glowing Neon Teal */
  --color-accent-hover: hsl(171, 100%, 35%);   /* Active Teal hover state */
  --color-accent-indigo: hsl(234, 89%, 74%);  /* Secondary brand Indigo (shortlist bar) */
  --color-accent-indigo-hover: hsl(234, 89%, 68%);

  /* Typography Colors */
  --color-text-primary: hsl(0, 0%, 98%);       /* High-contrast near white */
  --color-text-secondary: hsl(215, 20%, 65%);   /* Soft slate gray */
  --color-text-muted: hsl(215, 12%, 45%);       /* Muted placeholder/inactive text */

  /* Semantic Indicators */
  --color-success: hsl(142, 72%, 45%);         /* Emerald green (high match / good cost) */
  --color-warning: hsl(38, 92%, 50%);          /* Amber orange (moderate warning) */
  --color-danger: hsl(0, 84%, 60%);            /* Crimson red (low match / high cost) */

  /* Shadows & Blurs */
  --blur-glass: blur(12px);
  --shadow-premium: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
  --shadow-glow: 0 0 16px hsla(171, 100%, 41%, 0.25);
}
```

### Typography System

Typography must use premium, modern fonts loaded from Google Fonts.

*   **Headings Font**: `'Outfit', sans-serif` (Provides a geometric, clean, modern feel).
*   **Body & UI Font**: `'Inter', sans-serif` (Provides extreme readability at small font sizes).
*   **Bilingual Chinese Font Stack**: `system-ui, -apple-system, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif` (Ensures optimal legibility and matches line heights when toggled to Chinese Simplified).

| Token Name | Font Family | Size | Weight | Line Height | Use Case |
|---|---|---|---|---|---|
| `--font-h1` | Outfit | `2.5rem` (40px) | Bold (700) | `1.2` | Hero headlines / Landing |
| `--font-h2` | Outfit | `1.75rem` (28px) | Semi-Bold (600) | `1.3` | Screen titles (Results, Compare) |
| `--font-h3` | Outfit | `1.25rem` (20px) | Medium (500) | `1.4` | Card titles / Question text |
| `--font-body` | Inter | `1.0rem` (16px) | Regular (400) | `1.6` | Narrative descriptions / Labels |
| `--font-ui` | Inter | `0.875rem` (14px) | Medium (500) | `1.5` | Buttons / Metadata / Form fields |
| `--font-caption`| Inter | `0.75rem` (12px) | Regular (400) | `1.4` | Small legends / Timestamps |

---

## 3. Spacing & Layout Principles

We enforce an **8px grid system** for consistent rhythm and alignment.

*   **Base Unit**: `8px`
*   **Spacing Scale**:
    *   `--space-xs`: `4px`
    *   `--space-sm`: `8px`
    *   `--space-md`: `16px`
    *   `--space-lg`: `24px`
    *   `--space-xl`: `32px`
    *   `--space-xxl`: `48px`
    *   `--space-xxxl`: `64px`
*   **Layout Grid Rules**:
    *   *Grid Gap*: Use `--space-lg` (24px) for major card layouts.
    *   *Container Max-Width*: `1200px` centered via `margin: 0 auto`.
    *   *Section Padding*: `--space-xxl` (48px) top and bottom.

---

## 4. Component Styling Rules

### 1. Glassmorphism Cards
*   **Background**: `var(--color-surface-glass)`
*   **Border**: `1px solid var(--color-border-glass)`
*   **Border Radius**: `12px` (`0.75rem`)
*   **Blur**: `backdrop-filter: var(--blur-glass)`
*   **Shadow**: `box-shadow: var(--shadow-premium)`
*   **Hover Interaction**:
    *   Add a subtle border color shift: `border-color: rgba(255, 255, 255, 0.15)`
    *   Translate upwards: `transform: translateY(-4px)`
    *   Transition duration: `transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1)`

### 2. Primary Buttons
*   **Background**: `var(--color-accent-primary)`
*   **Text Color**: `hsl(224, 25%, 10%)` (dark charcoal for maximum contrast)
*   **Border Radius**: `8px` (`0.5rem`)
*   **Typography**: `--font-ui`, Bold (700)
*   **Hover State**:
    *   `background-color: var(--color-accent-hover)`
    *   `box-shadow: var(--shadow-glow)`
*   **Active State**: Scale down slightly `transform: scale(0.98)`

### 3. Secondary / Outlined Buttons
*   **Background**: Transparent
*   **Border**: `1px solid var(--color-text-secondary)`
*   **Text Color**: `var(--color-text-secondary)`
*   **Hover State**:
    *   `background-color: hsla(215, 20%, 65%, 0.1)`
    *   `color: var(--color-text-primary)`

### 4. Progress Bars (Metrics representation)
*   **Track**: Height `8px`, border-radius `9999px`, background `var(--color-bg-secondary)`.
*   **Fill**: Border-radius `9999px`, background `var(--color-accent-primary)`.
*   **Scale**: Color indicator shifting (1-2 fill is red/danger, 3 is yellow/warning, 4-5 is teal/success).

### 5. Country Flag Graphic
*   **Format**: Rendered via SVG or high-resolution PNG image (bypassing raw text emoji for cross-device styling consistency).
*   **Dimensions**: Width `24px` (aspect ratio 3:2), rendered inline with text, featuring a subtle `border-radius: 2px` and a border wrapper `1px solid var(--color-border-glass)` to prevent blending into the dark charcoal background.

### 6. Landmark Image Box
*   **Layout**: 16:9 aspect ratio container (`aspect-ratio: 16 / 9`).
*   **Styling**: Border radius `8px` (`0.5rem`), `object-fit: cover`, and lazy loaded (`loading="lazy"`) to optimize bandwidth on mobile connections.

---

## 5. Accessibility & Responsive Design Guidelines

### Accessibility (WCAG 2.1 AA Compliance)
*   **Contrast Ratio**: All body copy and interactive labels must maintain a contrast ratio of >= 4.5:1 against their backgrounds. Text using `--color-text-secondary` must only be rendered over `--color-bg-primary` or `--color-surface-glass`.
*   **Keyboard Accessibility**: All buttons, cards, and checkboxes must have a visible, custom focus ring when navigated via `tab`.
    *   `focus-visible` outline: `2px solid var(--color-accent-indigo)`.
*   **Interactive Targets**: Touch targets must be at least `44px x 44px`.

### Responsive Breakpoints
We design mobile-first to ensure optimal responsiveness:

1.  **Mobile (Portrait/Landscape)**: `< 768px`
    *   Layouts collapse to a single column.
    *   Padding shrinks (grid gaps use `--space-md` or 16px).
    *   Shortlist bar floats as a fixed full-width bottom sheet.
2.  **Tablet**: `768px - 1023px`
    *   Columns expand to 2-column grids (e.g., results list or comparison view).
    *   Headers adjust to `--font-h2` scale.
3.  **Desktop**: `>= 1024px`
    *   Standard grid layout (3-column comparison view, full results layout).
    *   Shortlist bar docks as a side panel or sticky overlay banner.
