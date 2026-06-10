# RelocateWise — Changelog

All notable changes to this project are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/) conventions.

## [0.2.0] — 2026-06-10

### Added
- **7-step questionnaire wizard** (PRD S1, Acceptance-Criteria Feature 2).
  Replaces the single-page form with a 7-screen wizard. Each step has
  Back / Skip; the final step shows "View matches". Implements
  `docs/Review-Findings.md` HF-1 (single Housing Budget 1-5 maps to
  `cost_ceiling=housing_ceiling=N`, both importances=3) and MF-1
  (Location Density choice merges into `lifestyle_tags`).
- **`ProgressBar` component** (Acceptance-Criteria Feature 2) — 14.2% per
  step, "Step N of 7" text, `role="progressbar"`.
- **`Toast` component** (Acceptance-Criteria Feature 4) — surfaces
  "You can compare up to 3 cities. Please remove one first." on 4th
  attempt.
- **`ShortlistBar` component** (Acceptance-Criteria Feature 4) —
  floating compare bar with count, chips, Compare CTA, Clear all.
- **`CityPage` "Add to Comparison" / "Remove" button** (Acceptance
  Feature 4 + User-Flows Step 4).
- **`Start Over` button on `/results`** (Acceptance-Criteria Feature 3,
  E2E-3) — clears the shortlist and routes to `/`.
- **`Skeleton` loading placeholders** (Screen-Specs §3, §4).
- **API shared-secret gate** (Architecture §11) — rejects calls without
  matching `x-relocatewise-secret` header when `API_SECRET` env var
  is set; `/api/health` is always exempt.
- **ESLint configs** for all 4 workspaces.
- **Playwright E2E suite** (4 specs covering E2E-1..E2E-4 from
  `docs/E2E-Test-Scenarios.md`).
- **CI workflow** with separate `e2e` job.
- **Outfit + Inter Google Fonts** (Visual-Guidelines §2).
- **Dark + glassmorphism design tokens** aligned to
  `docs/Visual-Guidelines.md`.
- **`artifacts/`** — Implementation_Report, Changelog, Deployment_Report.

### Changed
- **`ShortlistProvider`** migrated from in-memory React state to
  `sessionStorage`-backed persistence (key `rw:shortlist`). Exposes a
  new `startOver()` action. Defensive no-op fallback for consumers
  without a provider.
- **`ResultsPage`** — Start Over button, 4th-city toast, ShortlistBar
  mount, `rw:last-results` cache rehydration for back-navigation
  (Acceptance-Criteria AC-9 + AC-10).
- **`ComparePage`** — `<Navigate replace>` to `/results` when shortlist
  has <2 cities (Acceptance-Criteria Feature 5 + E2E-2). 7-row
  dimension table. Cost / Housing winner is the **lower** index
  (Acceptance Feature 5, FTC-13). Remove-below-2 navigates with a
  notice.
- **`ProfileForm`** — rewritten as a 7-step wizard with `toUserProfile()`
  mapping the wizard state into the API's `UserProfile` contract.
- **`web/src/styles/tokens.css`** — fully rewritten to the dark HSL
  palette + glassmorphism tokens from `Visual-Guidelines.md`.
- **`web/vite.config.ts`** — `host: '127.0.0.1'`, `strictPort: true`.
- **`api/src/server.ts`** — shared-secret gate on both
  `buildAppWithRepo()` and `bootstrap()`.
- **`.env.example`** — documents `API_SECRET=` and `ENABLE_RATE_LIMIT=1`.
- **All component CSS** re-themed to consume the new tokens.
- **Visual-Guidelines §5 mobile-first breakpoints** — landing page is
  centered and wraps gracefully on small viewports.

### Fixed
- **HF-1 / MF-1 mapping gaps** (Review-Findings §2) — frontend now
  correctly maps a single Housing Budget value into the 4 backend
  fields, and merges the Density choice into `lifestyle_tags`.
- **FTC-12 / E2E-2 redirect** — direct access to `/compare` with an
  empty shortlist now redirects to `/results` with a notice.
- **FTC-13 inverted winner** — Cost / Housing rows now highlight the
  lower-index city.
- **4th-city silent block** — clicking a 4th Compare checkbox no
  longer silently disables; it now fires a toast.
- **Compare: removing-below-2** — no longer shows an inline "one
  city" state; it redirects to /results with a notice.
- **`Start Over` clearing shortlist** — E2E-3 now passes because
  `Start Over` calls the new `startOver()` action.

### Tests
- Added 4 new Playwright E2E specs.
- Added web test files: `Toast.test.tsx` (4), `ShortlistBar.test.tsx` (6).
- Added new tests in `ShortlistContext.test.tsx` (sessionStorage
  round-trip + startOver), `ResultsPage.test.tsx` (Start Over),
  `CityPage.test.tsx` (Add to Comparison).
- Added 4 shared-secret tests in `api/test/server.test.ts`.
- Rewrote `ProfileForm.test.tsx` (12 tests) and `ComparePage.test.tsx`
  (10 tests) for the new behavior.
- Updated fixtures (api + web) for the new `rural` community sub-score.
- 19 web Vitest files / 130 tests pass; 5 API Vitest files / 75
  tests pass; 1 netlify Vitest file / 6 tests pass.

### Documentation
- `README.md` and `docs/` are intentionally untouched per the
  "docs are read-only" rule. The implementation is now aligned with
  the latest docs; no doc changes were required.

## [0.1.0] — 2026-06-03

### Added
- Initial monorepo: `api/`, `web/`, `shared/`, `netlify/`.
- 40-city dataset, Fastify API, Postgres+PostGIS repository, React SPA.
- Deterministic matching engine + templated "why" generator.
- 19 web Vitest files, 6 API Vitest files, 1 netlify proxy test.
- Docker Compose, Caddy, Netlify configuration, GitHub Actions CI.

[0.1.0]: #010---2026-06-03
[0.2.0]: #020---2026-06-10
