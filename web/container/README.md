# `@relocatewise/web-container`

The **container** is the host shell of the RelocateWise SPA
(per `docs/Architecture.md` v1.4.0 §4.1, FR-19, AC-19). It owns
the global chrome, the React Router, the i18n bootstrap, and the
provider contexts (toast, shortlist). The actual feature pages are
loaded on demand as **decoupled MFEs** via `React.lazy(() => import(
'@relocatewise/web-{quiz,compare,dashboard}-mfe'))`.

This module is the standard "module-level README" required by
`docs/Constraints.md` §3 + `docs/Acceptance-Criteria.md` DoD §4 so
that AI coding agents can lazy-load context for the container shell
without having to scan the whole repo.

## 1. Purpose

- Host shell: brand, primary nav, language toggle, shortlist badge,
  consent banner, footer, global toast stack.
- React Router 6 with the six public routes.
- Cross-MFE event hub: listens for the `rw:quiz_completed` Custom
  Event so the dashboard MFE can be loaded lazily without losing
  the quiz-completion handoff.
- i18next bootstrap + EN / 中文 bundle.
- The build entrypoint: `npm -w @relocatewise/web-container run build`
  emits the container shell + three named MFE chunks (per the
  `manualChunks` config in `vite.config.ts`).

## 2. Inputs

| Env var | Required | Purpose |
|---|---|---|
| `VITE_API_BASE` | Production | Override the API base; defaults to relative `/api/*` so dev uses the Vite proxy. |
| `CORS_ORIGIN` | Production | The matching service's CORS allow-list (consumed transitively via the gateway). |
| `API_PROXY_TARGET` | Dev only | Vite dev server proxy target (default `http://localhost:3000`). |

## 3. Outputs

- A single HTML entrypoint (`index.html`) that loads the container
  shell as a hashed JS chunk (`index-*.js`) and three MFE chunks:
  - `quiz-mfe-*.js` — loaded on first visit to `/q`.
  - `compare-mfe-*.js` — loaded on first visit to `/compare`.
  - `dashboard-mfe-*.js` — loaded on first visit to `/results` or
    `/city/:slug`.
- All UI copy is keyed by i18next; switching the toggle in the
  header instantly re-renders every page in the active locale.

## 4. Event contract

| Event | Direction | Payload | Purpose |
|---|---|---|---|
| `rw:quiz_completed` | Quiz MFE → Container (and any listener) | `{ profile: UserProfile, at: number }` | Dispatched when the user submits the 8-step wizard (FTC-17, AC Feature 2). The container stashes the payload in sessionStorage and falls back to `navigate('/results')`. |
| `rw:shortlist_changed` | Container → any listener | `{ count: number }` | (Reserved for future use — header shortlist badge already subscribes via React context.) |

## 5. Public surface (URLs)

| Path | Page | MFE chunk |
|---|---|---|
| `/` | LandingPage | none (container-rendered) |
| `/q` | ProfileForm wizard | `quiz-mfe` |
| `/results` | ResultsPage (ranked matches) | `dashboard-mfe` |
| `/city/:slug` | CityPage (full city profile) | `dashboard-mfe` |
| `/compare` | ComparePage (2-3 shortlisted cities) | `compare-mfe` |
| `/privacy` | PrivacyPage | none (container-rendered) |
| any other | NotFoundPage (404) | none (container-rendered) |

## 6. Directory layout

```
container/
├── package.json
├── tsconfig.app.json
├── tsconfig.json
├── vite.config.ts             # manualChunks → quiz/compare/dashboard
├── vitest.config.ts
├── eslint.config.js
├── index.html
├── public/
│   └── flags/*.svg            # 27 country flag SVGs (CC0)
├── src/
│   ├── App.tsx                # host shell + lazy MFE routes
│   ├── App.css
│   ├── main.tsx               # Vite entrypoint
│   ├── api.ts                 # fetch wrapper + MatchedCityFull type
│   ├── components/            # host shell components
│   │   ├── ConsentBanner.tsx
│   │   ├── LanguageToggle.tsx
│   │   ├── ShortlistBar.tsx
│   │   ├── Toast.tsx
│   │   ├── ProgressBar.tsx
│   │   └── ... (each with its own .css)
│   ├── pages/
│   │   ├── LandingPage.tsx
│   │   ├── PrivacyPage.tsx
│   │   └── NotFoundPage.tsx
│   ├── state/
│   │   ├── shortlist.tsx     # ShortlistProvider + useShortlist hook
│   │   └── matchResults.ts   # sessionStorage helpers for the dashboard MFE
│   ├── i18n/
│   │   ├── index.ts          # i18next bootstrap
│   │   ├── en.json
│   │   ├── zh.json
│   │   └── why.ts             # why-template renderer (locale-aware)
│   └── styles/
│       ├── tokens.css        # design tokens (colours, spacing, typography)
│       └── global.css
├── scripts/
│   └── gen-flags.mjs          # one-off: regenerates the flag SVG bundle
└── test/                      # 73 tests
    ├── App.test.tsx
    ├── ConsentBanner.test.tsx
    ├── LanguageToggle.test.tsx
    ├── ShortlistBar.test.tsx
    ├── ShortlistContext.test.tsx
    ├── Toast.test.tsx
    ├── LandingPage.test.tsx
    ├── PrivacyPage.test.tsx
    ├── NotFoundPage.test.tsx
    ├── i18n.test.tsx
    ├── api.test.ts
    ├── setup.ts
    └── fixtures.ts
```

## 7. Setup / test / build

```bash
# Install (from repo root)
npm ci

# Typecheck
npm -w @relocatewise/web-container run typecheck

# Tests (vitest, jsdom)
npm -w @relocatewise/web-container test

# Build (emits the container shell + 3 MFE chunks into dist/)
npm -w @relocatewise/web-container run build

# Dev (Vite dev server, proxies /api/* to API_PROXY_TARGET)
npm -w @relocatewise/web-container run dev
```

## 8. Known limitations

1. **MFEs share the i18n bundle** via Vite alias (`@relocatewise/web-container/i18n/...`). Practical today; a future refactor could split the i18n into its own workspace for true MFE independence.
2. **The ComparePage test suite hangs** on vitest 2.x + jsdom 25 due to a `setTimeout` open-handle issue (pre-existing on `main`; also documented in the v0.4.0 implementation report). The container's `App.test.tsx` covers the `/compare` route via a mock stub.
3. **Cross-MFE React context** flows through `<ShortlistProvider>` + `<ToastProvider>` mounted at the App level. The MFEs consume the context via hooks imported from the container workspace via Vite alias.

## 9. Related documentation

- `docs/Architecture.md` §4.1 — Container App definition
- `docs/PRD.md` FR-19 / AC-19 — Modular MFE requirements
- `docs/E2E-Test-Scenarios.md` §4 — E2E-7 MFE lazy-loading
- `docs/Functional-Test-Cases.md` FTC-18 — Module README presence