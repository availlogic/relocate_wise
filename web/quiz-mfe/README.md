# `@relocatewise/web-quiz-mfe`

The **Quiz Micro-Frontend** owns the 8-step preference questionnaire
(per `docs/Architecture.md` v1.4.0 §4.1, FR-19, AC-19). It is a
self-contained React component that:

- Renders one question per screen with a progress bar (12.5% per
  step, "Step N of 8" label).
- Validates the user through `Back` and `Skip` controls on every
  step, plus `View matches` on the final step.
- Assembles the `UserProfile` from the wizard state (HF-1 housing
  budget → cost + housing fields; MF-1 density → lifestyle_tags).
- **Dispatches a `rw:quiz_completed` Custom Event** on `window` with
  the `UserProfile` payload (FTC-17, AC Feature 2). The container's
  `App.tsx` listens for the event as a fallback so the route resolves
  even if the dashboard chunk has not yet loaded.
- **Stashes the profile in `sessionStorage`** (`rw:profile`) so the
  dashboard MFE can rehydrate on back-navigation.
- Navigates to `/results`.

This module is the standard "module-level README" required by
`docs/Constraints.md` §3 + `docs/Acceptance-Criteria.md` DoD §4 so
that AI coding agents can lazy-load context for the wizard without
scanning the whole repo.

## 1. Inputs

The quiz MFE is a presentational component; it has no service
dependencies. Its only inputs are React props and the `useTranslation`
hook from the container's i18n module (loaded via Vite alias in
dev/test).

## 2. Outputs

| Output | Where | When |
|---|---|---|
| `rw:quiz_completed` Custom Event on `window` | Container's `App.tsx` listener | Step 8 "View matches" clicked. |
| `sessionStorage["rw:profile"]` | Dashboard MFE's `readCachedResults` | Same moment. |
| `navigate('/results')` | React Router | Same moment. |

## 3. Event contract

| Event | Payload | Where it is handled |
|---|---|---|
| `rw:quiz_completed` | `{ profile: UserProfile, at: number }` | Container (`App.tsx`) stashes the detail in `sessionStorage` and falls back to navigating. Dashboard MFE's `ResultsPage` reads `sessionStorage["rw:profile"]` to rehydrate the profile on back-navigation. |

## 4. Public surface (component contract)

| Export | Description |
|---|---|
| `ProfileForm` | The 8-step wizard. Accepts an optional `initial?: Partial<WizardState>` for tests / future restore-flow. |
| `toUserProfile(state: WizardState): UserProfile` | Pure projection from wizard state to the API request body. Re-used by tests for HF-1 / MF-1 verification. |

## 5. User-flow questions (in step order)

1. **Climate preference** — `ClimatePreference` enum (Mediterranean,
   Continental, Tropical, Temperate, Cold, Arid, No preference).
2. **Housing budget range** — 1..5 single slider. HF-1 mapping:
   `cost_importance = housing_importance = 3`, `cost_ceiling =
   housing_ceiling = N`.
3. **Career & industry focus** — `Industry` enum (Tech, Finance,
   Healthcare, Creative, Manufacturing, or No preference).
4. **Healthcare priority** — 0..3 importance slider.
5. **Education quality** — `EducationPriority` enum (Important,
   Somewhat, Not relevant).
6. **Community & lifestyle fit** — Multi-select tag picker.
7. **Location density** — Radio: Urban / Suburban / Rural. MF-1: the
   choice is merged into `lifestyle_tags`.
8. **Geopolitical & Conflict Risk** — 0..3 importance slider.

## 6. Directory layout

```
quiz-mfe/
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── eslint.config.js
├── src/
│   ├── index.ts              # public entry: `export { ProfileForm }`
│   └── components/
│       ├── ProfileForm.tsx   # the 8-step wizard
│       ├── ProfileForm.css
│       ├── ProgressBar.tsx
│       ├── ProgressBar.css
│       ├── RadioGroup.tsx    # shared radio button group
│       ├── CeilingSlider.tsx # 1..5 single slider
│       ├── ImportanceSlider.tsx # 0..3 importance slider
│       └── TagPicker.tsx     # multi-select tag picker
└── test/                     # 39 tests
    ├── ProfileForm.test.tsx
    ├── CeilingSlider.test.tsx
    ├── ImportanceSlider.test.tsx
    ├── RadioGroup.test.tsx
    ├── TagPicker.test.tsx
    └── setup.ts
```

## 7. Setup / test / build

```bash
# Install (from repo root)
npm ci

# Typecheck
npm -w @relocatewise/web-quiz-mfe run typecheck

# Tests (vitest, jsdom)
npm -w @relocatewise/web-quiz-mfe test

# Build (no standalone build — bundled by the container's manualChunks)
```

The quiz MFE has no standalone build script. It is bundled by the
**container's** `vite build` into the `quiz-mfe-*.js` chunk via
`rollupOptions.output.manualChunks` (Architecture v1.4.0 §3).

## 8. Known limitations

1. **i18n shared with the container** via Vite alias. The wizard pulls
   `useTranslation` from `@relocatewise/web-container/i18n/...`. A
   future refactor could split the i18n bundle into a standalone
   workspace.
2. **No form-state persistence** beyond the default in-memory wizard
   state. The user gets a fresh wizard each time they navigate to
   `/q`. Future work: persist to `sessionStorage` so a back-button
   doesn't blow away their answers.

## 9. Related documentation

- `docs/Architecture.md` §4.1 — Quiz MFE definition
- `docs/PRD.md` FR-1..FR-3 / AC-2 — Wizard requirements
- `docs/Functional-Test-Cases.md` FTC-3..FTC-5 — Wizard navigation tests
- `docs/Acceptance-Criteria.md` Feature 2 — Quiz MFE custom-event contract
- `docs/Functional-Test-Cases.md` FTC-17 — `rw:quiz_completed` dispatch test