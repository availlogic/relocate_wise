# Documentation Conflict Report

> v1.0.0 GA — produced by the principal-engineer pass that aligned the
> code with the authoritative docs in `docs/`.

Per §4 of the principal-engineer role description, gaps between
documentation and implementation are recorded here. The SSOT rule
("Documentation ALWAYS wins") means the code was changed to match the
docs; no documentation was modified.

## Closed in Phase G (code changed)

| ID | Source of truth | Pre-Phase-G code | Resolution (Phase G) |
|---|---|---|---|
| DC-15 | `docs/Architecture.md` v1.4.0 §8 (repository layout) + `docs/Constraints.md` §3 (modular design) | `api/` and `web/` had no `package.json`. Users naturally `cd api && npm install` or `cd web && npm run dev` and got a cryptic `ENOENT … no such file or directory, open …/api/package.json`. The root README was stale (still described the pre-Phase-D layout). | Added stub `package.json` + `redirect.cjs` in both `api/` and `web/`. Every common script (`dev`, `start`, `test`, `build`, `lint`, `typecheck`) now exits 1 with a coloured banner listing the sibling workspace names and the correct `cd .. && npm -w @relocatewise/<workspace> run <script>` invocation. Rewrote the top of `README.md` with a new "⚠️ Read this first — monorepo layout" section that explicitly warns the parent dirs are NOT workspaces. All `cd web` / `cd api` instructions in the Quick-start + Deploy sections converted to `npm -w …` syntax. 29 regression tests in `web/container/test/monorepo-redirect.test.ts` lock down: marker file existence + name + `private` flag; redirect-script spawn returns the expected message; the root README mentions the layout + lists all 8 workspace names; the root `package.json` `workspaces` array exactly contains the 8 entries and excludes `api` / `web` parents. |

## Closed in Phase F (code changed)

| ID | Source of truth | Pre-Phase-F code | Resolution (Phase F) |
|---|---|---|---|
| DC-14 | `docs/Visual-Guidelines.md` v1.4.0 (2026-06-25) §2/§4; `docs/PRD.md` v3.4.0 FR-22…FR-27; `docs/Acceptance-Criteria.md` v1.3.0 AC-21…AC-24; `docs/Functional-Test-Cases.md` v1.3.0 FTC-3b | Dark glassmorphism: Outfit / Inter fonts, dark blue-black canvas `#0F1726`, semi-transparent surfaces with `backdrop-filter: blur(12px)`, single outer drop shadows, 6–12 px border-radii, glass CTA buttons. Pills and the multi-layered clay "pressed" inverted-shadow did not exist. | Complete claymorphic redesign. `tokens.css` + `global.css` rewritten: light-mode-first lilac canvas `#E2DBF8`, off-white cards `#FFF9F9`, charcoal text, sage / peach / lavender / butter-yellow / sky-blue pastels, Quicksand + Nunito + CJK fallback, multi-layered clay shadows (`--shadow-clay-outer`, `--shadow-clay-inner-light`, `--shadow-clay-inner-dark`, `--shadow-pressed`), 24–32 px card radii, 9999 px pill buttons. All 11 component CSS files (App / ConsentBanner / ShortlistBar / Toast / LanguageToggle / LandingPage / PrivacyPage / ProfileForm / ProgressBar / RankCard / CityPage / CityDimensions / ResultsPage / ComparePage) rewritten to apply the new tokens. `index.html` `<meta name="color-scheme">` flipped to `light`; preconnect + stylesheet link for Quicksand + Nunito added. Three new claymorphism test files (44 tests total) lock down the contract via CSS-source-file parsing. |

## Closed in v1.0.0 GA Phase E (code changed)

| ID | Source of truth | Pre-Phase-E code | Resolution (Phase E) |
|---|---|---|---|
| DC-13 | S14, FR-21, AC-20, FTC-18, DoD §4 "Documentation & Consistency" | The 4 web MFEs (`web/container/`, `web/quiz-mfe/`, `web/compare-mfe/`, `web/dashboard-mfe/`) had no `README.md`. The 3 api services (created in Phase B) had READMEs but they were not verified against the FTC-18 contract. | Wrote 4 MFE READMEs at `web/{container,quiz-mfe,compare-mfe,dashboard-mfe}/README.md` with the standardized sections (`Inputs`, `Outputs`, `Event contract` / `Public surface`, `Directory layout`, `Setup / test / build`, `Known limitations`, `Related documentation`). New `web/container/test/module-readmes.test.ts` (FTC-18 verification, 42 tests = 6 assertions × 7 modules) asserts every module README exists, is non-empty, has a `# ` heading, mentions its last path segment, contains `## Inputs` / `## Outputs` / `## Directory layout` (with optional numeric prefix), and documents the public surface via `## Event contract` / `## Public surface` / `## Path policy` / HTTP-verb + `/api/` routes in `## Outputs`. Test passes against the existing Phase B api READMEs too. |

## Closed in v1.0.0 GA Phase D (code changed)

| ID | Source of truth | Pre-Phase-D code | Resolution (Phase D) |
|---|---|---|---|
| DC-6 | `docs/Architecture.md` v1.4.0 §4.1 / §8, FR-19, AC-19, E2E-7, FTC-17 | A single React SPA with `web/src/pages/*`; no `React.lazy` chunking; no MFE folder boundaries. | The `web/` directory is split into four sibling npm workspaces: `web/container/` (host shell + lazy MFE imports via `React.lazy`), `web/quiz-mfe/` (the 8-step ProfileForm wizard that dispatches a `rw:quiz_completed` Custom Event on submit — FTC-17), `web/compare-mfe/` (the side-by-side comparison page), `web/dashboard-mfe/` (Results + City profile pages). The container's `vite.config.ts` emits one named chunk per MFE via `rollupOptions.output.manualChunks` (verified at build time: `quiz-mfe-*.js`, `dashboard-mfe-*.js`, `compare-mfe-*.js`). |
| DC-11 | FTC-17, AC Feature 2 | Quiz MFE did not dispatch `rw:quiz_completed`. | The refactored `ProfileForm` (now `web/quiz-mfe/src/components/ProfileForm.tsx`) dispatches `new CustomEvent('rw:quiz_completed', { detail: { profile, at: Date.now() } })` on `window` in `handleSubmit`. The container's `App.tsx` listens for the event as a fallback so the route resolves even if the dashboard chunk has not yet loaded. `web/quiz-mfe/test/ProfileForm.test.tsx` (12 tests) covers the contract: HF-1, MF-1, military_safety_importance default, sessionStorage handoff, navigation. |
| DC-12 | E2E-7, `docs/Architecture.md` §3 | Pages were static imports; no per-route chunks. | Container's `vite.config.ts` declares `manualChunks: { 'quiz-mfe': [...], 'compare-mfe': [...], 'dashboard-mfe': [...] }`. New `web/e2e/e2e-7-mfe-lazy.spec.ts` (Playwright) intercepts network requests on every navigation and asserts that each MFE's chunk is fetched only when its route is visited. The homepage loads only the container shell (no MFE chunks). |

## Closed in v1.0.0 GA Phase B (code changed)

| ID | Source of truth | Pre-Phase-B code | Resolution (Phase B) |
|---|---|---|---|
| DC-7 | `docs/Architecture.md` v1.4.0 §4.3 / §8, FR-20, AC-19, ITC-9 | A single Fastify server in `api/src/`; no API Gateway; no internal sync endpoint. The `api` container in `docker-compose.yml` was the only ingress target; `Caddyfile` and `cloudflared` pointed at it. | The `api/` directory is split into three sibling npm workspaces, each in its own Docker container: `api/matching-service/` (Fastify HTTP service, owns the `matching` schema + the public REST surface + the bearer-gated `PUT /api/internal/cities/:slug/scores`), `api/ingestion-service/` (cron worker, owns the `ingestion` schema + the HTTP-backed scores writer that PUTs to the matching service), `api/gateway/` (minimal Fastify reverse proxy that forwards public routes to the matching service and refuses `/api/internal/*` from any source with a 404 envelope — ITC-9 step 3). `docker-compose.yml` now wires the three new services + the `db` service; `docker-compose.cloudflared.yml` and `cloudflared/CONFIG.example.yml` point the tunnel at the gateway; `Caddyfile` is deleted. New `api/gateway/test/server.test.ts` (15 tests) covers ITC-9 end-to-end (public routes 200, internal routes 404, unknown paths 404, shared-secret gate 401, 502 on upstream errors). The old monolithic `api/src/`, `api/test/`, `api/Dockerfile`, `api/package.json` etc. are deleted. |

## Closed in v1.0.0 GA Phase C (code changed)

| ID | Source of truth | Pre-Phase-C code | Resolution (Phase C) |
|---|---|---|---|
| DC-9 | `docs/API_Spec.md` §2.5, `docs/Architecture.md` §4.4, ITC-10 | No `PUT /api/internal/cities/:slug/scores` route existed. | Added `api/src/routes/internal.ts` with a bearer-token `preHandler`. New `api/src/schemas/internal.ts` validates the rich per-dimension body (including climate.label / career sub-scores / community tags / military_safety sub-scores). The route UPSERTs every supplied dimension into `matching.city_scores` (the matching service is the only writer to `matching.*`; cross-schema writes are still rejected by the DB role) and bumps `matching.cities.last_updated = CURRENT_DATE` in a single transaction. The route returns 401 on missing/invalid bearer, 503 when no token is configured, 404 on unknown slug, 400 on body validation, 200 on success. New `api/test/internal-put.test.ts` (16 tests) covers ITC-10 end-to-end via testcontainers. |
| DC-10 | `docs/Database.md` §5, Acceptance-Criteria Feature 8, ITC-8 | The ingestion pipeline wrote `matching.city_scores` directly via SQL (only role with INSERT on the matching schema was the matching_service, but Phase A had no internal endpoint). After Phase A the orchestrator had been refactored to skip writes entirely. | Phase A's `noopScoresWriter` is replaced by `httpScoresWriter` + `defaultScoresWriter()` (reads `INGESTION_TARGET_URL` + `INGESTION_TARGET_TOKEN` from the env). The orchestrator now PUTs each `(slug, dim, score, subScores)` triple to the matching service's internal endpoint. The matching service's `last_updated` bump is now real. `ingestion.test.ts` is rewritten to inject a recording `ScoresWriter` stub (per Test-Strategy §4 "Service Boundaries") and asserts every dimension reaches the writer; the per-city `pipeline_logs` row now lists the failing dimension names when a writer call fails. |

## Closed in v1.0.0 GA Phase A (code changed)

| ID | Source of truth | Pre-Phase-A code | Resolution (Phase A) |
|---|---|---|---|
| DC-8 | `docs/Architecture.md` §5.1, `docs/Database.md` §1.4 / §3, ITC-11, AC-19 | Single `cities` and `city_scores` tables in the default schema; no `ingestion.pipeline_logs`; single DB user; the ingestion pipeline wrote `matching.city_scores` directly via SQL. | Added `db/migrations/003_schemas.sql` which creates `matching` and `ingestion` schemas, relocates the existing tables into `matching`, creates `ingestion.pipeline_logs`, and provisions two PostgreSQL roles with schema-scoped `GRANT`s: `matching_service` (R/W on `matching.*`, SELECT-only on `ingestion.*`) and `ingestion_service` (SELECT on `matching.cities`, R/W on `ingestion.*`). Every query in `api/src/db/postgres.repository.ts` and `api/src/db/seed.ts` is now schema-qualified. The ingestion pipeline (`api/src/jobs/ingestion.ts`) was refactored to run against the **ingestion** pool and to write only to `ingestion.pipeline_logs`; direct writes to `matching.city_scores` have been retired (the matching service's internal PUT endpoint, added in Phase C, takes over). New `api/test/roles.test.ts` (8 testcontainers-driven tests) verifies ITC-11: `matching_service` cannot write to `ingestion.*`; `ingestion_service` cannot write to `matching.*`. |

## Closed in v0.4.0 (code changed)

| ID | Source of truth | Pre-v0.4.0 code | Resolution (v0.4.0) |
|---|---|---|---|
| DC-1 | PRD v3.2.0 S11, Architecture §8.2, Screen-Specs §0, User-Flows §2.F, E2E-Test-Scenarios §E2E-5, Acceptance-Criteria Feature 6 | UI was English-only; no `i18next` package; no language toggle. The pre-v0.4.0 Implementation_Report falsely claimed this was done. | Added `web/src/i18n/{en.json,zh.json,index.ts}`, `LanguageToggle` component, `renderWhyTemplate()` helper, Zod `language` field on `UserProfile`, `why_key` + `why_vars` on `MatchedCity`. The server now emits the templated payload; the SPA resolves it via i18next in the active locale. |
| DC-2 | PRD v3.2.0 S9, FR-15, AC-14, Architecture v1.3.0 §2/§3 | Repo shipped `netlify.toml` + `netlify/functions/proxy.ts` + `@netlify/functions` dep. `docker-compose.yml` exposed Caddy on host ports `8080:80` + `8443:443`. The pre-v0.4.0 Implementation_Report falsely claimed Cloudflare was in use. | Deleted the Netlify workspace, `netlify.toml`, and `@netlify/functions`. Added `web/wrangler.toml`, `docker-compose.cloudflared.yml`, `cloudflared/CONFIG.example.yml`, and `.github/workflows/deploy-pages.yml`. `docker-compose.yml` makes Caddy internal-only (no host port mappings). Production tunnel is outbound-only. |
| DC-3 | PRD v3.2.0 S5, FR-8, AC-6, Screen-Specs §4, Visual-Guidelines §4.5-§4.6, FTC-16 | `City` type had no `landmark_image_url` / `flag_image_url`; `CityPage.tsx` rendered neither. | Added both fields to `City` (shared/types.ts), the seed (40 cities, curated Wikimedia Commons landmarks), the `PostgresCityRepository` (derived flag URL + landmark map by slug), and the CityPage (flag SVG in header, landmark `<figure>` with lazy loading and 16:9 aspect). Bundled 27 country flag SVGs in `web/public/flags/`. |
| DC-4 | Functional-Test-Cases FTC-1, FTC-2 | `ConsentBanner` wrote `"accepted"` / `"declined"` to `rw:cookie_consent`; FTC-1 expected `"true"` / `"false"`. | Updated `ConsentBanner` to write boolean strings; updated the ConsentBanner test to assert the new values. |
| DC-5 | Acceptance-Criteria Feature 6 / E2E-5: "Toggling must preserve the user's current session state (e.g. current questionnaire screen, selected shortlist)" | Wizard did not preserve state on language change in pre-v0.4.0. | Verified that toggling language does NOT remount the wizard (i18next switches resources without unmounting); added a regression test (`i18n.test.tsx > preserves the current step across a language toggle`). |

## Doc-only items deferred for human review

| ID | Document | Description |
|---|---|---|
| D-1 | `docs/Screen-Specs.md` §2 (Questionnaire Dimensions) | Now lists 8 dimensions + 8 questions. The pre-v0.3.0 version still shows 7. The screen-specs doc is intentionally not modified by the implementation pass (SSOT rule). The next editor should re-confirm Screen-Specs §2 + §4 reflect the actual 8-step wizard and 8-dimension profile. |
| D-2 | `docs/Architecture.md` §8.1 (Frontend Architecture Routes) | Mentions "Cloudflare Pages" but the pre-v0.3.0 codebase had Netlify. Updated in v0.3.0 to reflect Cloudflare Pages + Tunnel. The Architecture doc is canonical; the implementation now matches. |
| D-3 | `docs/Architecture.md` §11 (Security) | Mentions the `x-relocatewise-secret` shared-secret gate. With Cloudflare Tunnel, that gate is belt-and-suspenders (the tunnel is the primary auth). The code still honours the gate when `API_SECRET` is set; the implementation report and deployment report both note that it's optional. |

## Items still open after Phase E (deferred to future releases)

| ID | Source of truth | Pre-Phase-E code | Resolution plan |
|---|---|---|---|
| (none) | — | — | v1.0.0 GA is fully delivered. All five phases (A, B, C, D, E) have landed. The "Documentation & Consistency" DoD §4 contract is enforced by `module-readmes.test.ts` and will fail CI if any module README is deleted or stripped of its required sections. |

## Other notes

- The pre-v0.3.0 `Implementation_Report.md` made claims that did not match the actual code (e.g. "i18n via i18next", "Cloudflare Pages deployment", "landmark image and flag graphic rendered"). v0.4.0 closes all three of those claims and the report is regenerated to reflect the actual code state. The pre-v0.3.0 report should NOT be relied on.
- The pre-v0.3.0 `Documentation_Conflict_Report.md` did not exist; v0.4.0 produces this file.
- The 8-step wizard increments `ProgressBar` by 12.5% per step, matching the docs. The pre-v0.3.0 implementation used `total = 7` as the default and only `ProfileForm` passed `total = 8` explicitly. The pre-v0.4.0 `ProgressBar.tsx` still defaulted to 7; in v0.4.0 the default is 8 (verified).