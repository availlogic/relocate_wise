# `@relocatewise/web-dashboard-mfe`

The **Dashboard Micro-Frontend** owns the ranked-results view and
the per-city profile page (per `docs/Architecture.md` v1.4.0 §4.1,
FR-19, AC-19). It is a self-contained React page that:

- Renders the top-10 ranked city cards with a checkbox to add/remove
  from the shortlist (via the container's `<ShortlistProvider>`).
- Calls `POST /api/match` directly (`@relocatewise/web-container/api`)
  when the user lands on `/results` from a fresh quiz submission.
  Subsequent re-hydrations read the cached response from
  `sessionStorage["rw:profile"]` (stashed by the quiz MFE).
- Renders the per-city profile: 8 dimensions (1-5 scale), landmark
  photo, country flag SVG, "last updated" footer, and an "Add to
  Comparison" toggle.

This module is the standard "module-level README" required by
`docs/Constraints.md` §3 + `docs/Acceptance-Criteria.md` DoD §4 so
that AI coding agents can lazy-load context for the dashboard pages
without scanning the whole repo.

## 1. Inputs

| Source | Purpose |
|---|---|
| Container's `useShortlist()` / `useToast()` hooks | Shortlist toggles + transient notices. |
| Container's `useTranslation()` hook | All UI copy. |
| Container's `api.ts` (`getCity`, `postMatch`) | Network calls (loaded via Vite alias). |
| Container's `state/matchResults.ts` (`readCachedResults`) | sessionStorage handoff. |
| Container's `i18n/why.ts` (`renderWhyTemplate`) | Locale-aware "why this fits you" template. |
| `react-router-dom`'s `useLocation` / `useNavigate` | Router state + navigation. |

## 2. Outputs

- Ranked list of 10 city cards (`/results` route).
- Per-city profile page (`/city/:slug` route).
- `POST /api/match` calls (production) or read from sessionStorage
  (re-hydration on back-navigation).
- Shortlist mutations: `useShortlist.toggle()` from each card's
  "Compare" checkbox; the city profile's "Add to Comparison"
  button does the same with the full `City` payload.

## 3. Event contract

The dashboard MFE does not emit any custom events. It is the
**downstream consumer** of the `rw:quiz_completed` event that the
container stashes in `sessionStorage["rw:profile"]`.

## 4. Public surface (component contract)

| Export | Description |
|---|---|
| `ResultsPage` | The ranked-results view. Renders the top-10 cards + shortlist checkboxes. No props. |
| `CityPage` | The per-city profile page. Reads `:slug` from the route. No props. |

## 5. URL contract

| Path | Component | Behaviour |
|---|---|---|
| `/results` | `ResultsPage` | Reads from `location.state.results` if present (set by the quiz MFE's `navigate('/results', { state })`); otherwise reads `sessionStorage["rw:profile"]` and re-issues `postMatch` if needed. |
| `/city/:slug` | `CityPage` | Calls `getCity(slug)` and renders the full profile. Handles 404 with a friendly error. |

## 6. Row / dimension semantics

The dashboard's `CityDimensions` component renders each of the
8 dimensions on a 1-5 progress bar:

| Row | Behaviour |
|---|---|
| Climate | A label (e.g. "Mediterranean"), not a numeric score. |
| Cost of living | 1-5 numeric. |
| Housing | 1-5 numeric. |
| Education | 1-5 numeric. |
| Healthcare | 1-5 numeric. |
| Military safety | 1-5 numeric + the `military_safety_sub` JSONB (conflict_risk + travel_advisory). |
| Career | 5-row sub-table (Tech, Finance, Healthcare, Creative, Manufacturing). |
| Community | 7-row sub-table (Urban, Suburban, Coastal, Mountain, Arts & culture, Family-oriented, Expat-friendly). |

## 7. Directory layout

```
dashboard-mfe/
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── eslint.config.js
├── src/
│   ├── index.ts              # public entry: `export { ResultsPage, CityPage }`
│   └── components/
│       ├── ResultsPage.tsx
│       ├── ResultsPage.css
│       ├── CityPage.tsx
│       ├── CityPage.css
│       ├── CityDimensions.tsx
│       ├── CityDimensions.css
│       ├── RankCard.tsx
│       └── RankCard.css
└── test/                     # 41 tests
    ├── ResultsPage.test.tsx
    ├── CityPage.test.tsx
    ├── CityDimensions.test.tsx
    ├── RankCard.test.tsx
    ├── fixtures.ts
    └── setup.ts
```

## 8. Setup / test / build

```bash
# Install (from repo root)
npm ci

# Typecheck
npm -w @relocatewise/web-dashboard-mfe run typecheck

# Tests (vitest, jsdom)
npm -w @relocatewise/web-dashboard-mfe test
```

The dashboard MFE has no standalone build script. It is bundled by
the **container's** `vite build` into the `dashboard-mfe-*.js` chunk
via `rollupOptions.output.manualChunks` (Architecture v1.4.0 §3).

## 9. Known limitations

1. **Cross-MFE React context** flows through the container's
   `<ShortlistProvider>` + `<ToastProvider>`. The MFE imports the
   consumer hooks + the i18n template renderer + the API client via
   Vite alias (`@relocatewise/web-container/...`).
2. **The dashboard's `postMatch()` is the only place in the app that
   directly calls the matching API.** The quiz MFE does NOT call
   `postMatch` (per Phase D's refactor); it dispatches
   `rw:quiz_completed` and the dashboard re-issues the call when
   needed. This keeps the cross-MFE contract clean (FTC-17).

## 10. Related documentation

- `docs/Architecture.md` §4.1 — Dashboard MFE definition
- `docs/PRD.md` S4-S5 / AC-5,AC-6 — Ranked results + city profile
- `docs/Functional-Test-Cases.md` FTC-7..FTC-11, FTC-16 — Result / profile tests
- `docs/Acceptance-Criteria.md` Feature 3 / Feature 4 — Ranking + shortlist contract
- `docs/Visual-Guidelines.md` §4.5-§4.6 — Flag SVG + landmark image specifications