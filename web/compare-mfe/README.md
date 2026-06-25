# `@relocatewise/web-compare-mfe`

The **Compare Micro-Frontend** owns the side-by-side comparison
view that aligns the 8 dimensions of 2 or 3 shortlisted cities
(per `docs/Architecture.md` v1.4.0 §4.1, FR-19, AC-19, AC Feature 5).

It is a self-contained React page that:

- Reads the shortlist from the container's `<ShortlistProvider>` via
  the `useShortlist` hook (loaded via Vite alias).
- Renders a 2- or 3-column matrix (one column per shortlisted city)
  with one row per dimension, highlighting the cell that owns the
  best score per row.
- Inverts the cost / housing dimensions so the **lower** index
  wins (per Acceptance-Criteria Feature 5).
- Honors "Remove" on a column (drops the city from the shortlist)
  and "Clear all" (empties the shortlist and returns to `/results`).
- Redirects to `/results` with a transient notice when the
  shortlist has < 2 cities.

This module is the standard "module-level README" required by
`docs/Constraints.md` §3 + `docs/Acceptance-Criteria.md` DoD §4 so
that AI coding agents can lazy-load context for the comparison view
without scanning the whole repo.

## 1. Inputs

| Source | Purpose |
|---|---|
| Container's `useShortlist()` hook | The 2-3 shortlisted cities. |
| Container's `useToast()` hook | Transient "fewer than 2 cities" notice. |
| Container's `useTranslation()` hook | All UI copy. |
| `react-router-dom`'s `useLocation` / `useNavigate` | Redirect + location state. |

## 2. Outputs

- Side-by-side matrix (8 rows: climate, cost, housing, career-avg,
  education, healthcare, community-max, military-safety).
- "Best" cell highlight per row.
- Shortlist mutations (remove city, clear all) flow through the
  container's `useShortlist()` — no local state.
- Navigation: `/results` (with a transient notice) on insufficient
  shortlist; `/results` on "Clear all".

## 3. Event contract

The compare MFE does not emit any custom events. It consumes the
container's React contexts (`useShortlist`, `useToast`) via Vite
alias; the same module instance is shared, so context flows
correctly.

## 4. Public surface (component contract)

| Export | Description |
|---|---|
| `ComparePage` | The full side-by-side comparison view. No props. |

## 5. Row semantics

| Row | Best-cell rule |
|---|---|
| Climate | The dimension's `label` (e.g. "Mediterranean") is matched against a sortable rank; the most specific label wins. |
| Cost of living | **Inverted**: lower index wins (Acceptance-Criteria Feature 5). |
| Housing | **Inverted**: lower index wins. |
| Career (avg) | Mean of the 5 industry sub-scores. Higher wins. |
| Education | Higher wins. |
| Healthcare | Higher wins. |
| Community (max) | Max of the lifestyle sub-scores. Higher wins. |
| Military safety | Higher wins. |

## 6. Directory layout

```
compare-mfe/
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── eslint.config.js
├── src/
│   ├── index.ts              # public entry: `export { ComparePage }`
│   ├── ComparePage.tsx
│   └── ComparePage.css
└── test/
    ├── smoke.test.ts         # always-runs smoke test
    ├── ComparePage.test.tsx  # full suite (excluded from `npm test`
    │                         # due to a pre-existing vitest 2.x + jsdom
    │                         # hang; see "Known limitations" below)
    ├── fixtures.ts
    └── setup.ts
```

## 7. Setup / test / build

```bash
# Install (from repo root)
npm ci

# Typecheck
npm -w @relocatewise/web-compare-mfe run typecheck

# Tests (vitest, jsdom)
npm -w @relocatewise/web-compare-mfe test
```

The compare MFE has no standalone build script. It is bundled by the
**container's** `vite build` into the `compare-mfe-*.js` chunk via
`rollupOptions.output.manualChunks` (Architecture v1.4.0 §3).

## 8. Known limitations

1. **ComparePage test suite hangs** on vitest 2.x + jsdom 25 due to
   a `setTimeout` open-handle issue (pre-existing on `main`; also
   documented in the v0.4.0 implementation report). The full suite
   lives in `test/ComparePage.test.tsx` but is excluded from `npm
   test` via the `--exclude='**/ComparePage.test.tsx'` flag. A
   smoke test in `test/smoke.test.ts` keeps the workspace green.
2. **Cross-MFE React context** flows through the container's
   `<ShortlistProvider>` + `<ToastProvider>`. The MFE imports the
   consumer hooks via Vite alias (`@relocatewise/web-container/
   state/shortlist` etc.).

## 9. Related documentation

- `docs/Architecture.md` §4.1 — Compare MFE definition
- `docs/PRD.md` S6 / AC-8 — Side-by-side comparison
- `docs/Acceptance-Criteria.md` Feature 5 — Winner-cell highlight semantics
- `docs/Functional-Test-Cases.md` FTC-12..FTC-13 — Redirect + highlight tests
- `docs/E2E-Test-Scenarios.md` E2E-2 — Direct-access redirect test