# Documentation Conflict Report

> v0.4.0 — produced by the principal-engineer pass that aligned the
> code with the authoritative docs in `docs/`.

Per §4 of the principal-engineer role description, gaps between
documentation and implementation are recorded here. The SSOT rule
("Documentation ALWAYS wins") means the code was changed to match the
docs; no documentation was modified.

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

## Other notes

- The pre-v0.3.0 `Implementation_Report.md` made claims that did not match the actual code (e.g. "i18n via i18next", "Cloudflare Pages deployment", "landmark image and flag graphic rendered"). v0.4.0 closes all three of those claims and the report is regenerated to reflect the actual code state. The pre-v0.3.0 report should NOT be relied on.
- The pre-v0.3.0 `Documentation_Conflict_Report.md` did not exist; v0.4.0 produces this file.
- The 8-step wizard increments `ProgressBar` by 12.5% per step, matching the docs. The pre-v0.3.0 implementation used `total = 7` as the default and only `ProfileForm` passed `total = 8` explicitly. The pre-v0.4.0 `ProgressBar.tsx` still defaulted to 7; in v0.4.0 the default is 8 (verified).