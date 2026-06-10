---
title: "Product Requirements"
version: "2.0.0"
status: draft
author: "Product Agent"
created: "2026-06-01"
updated: "2026-06-02"
related_docs:
  - "docs/Vision.md"
  - "docs/Constraints.md"
---

# RelocateWise — Product Requirements

This document defines the requirements for the **Minimum Viable Product (MVP)** of RelocateWise. The delivery constraints and $0 tooling budget defined in `Constraints.md` are the dominant constraints; everything below is judged against them. Future-state features are mentioned only to clarify what is *not* being built.

For product vision, target audience, and principles see `Vision.md`. For technology, infrastructure, and budget constraints see `Constraints.md`. For detailed market and technology research see `Research_Report.md`.

## 1. Problem Statement

Relocating is one of the most significant and stressful financial and lifestyle decisions an individual or family will make. When researching prospective cities, users face:
- **Information Overload**: Extensive but fragmented public data (climate, schools, cost of living, healthcare) scattered across hundreds of websites.
- **Lack of Personalization**: Standard "Top 10" lists steer users toward generic options and do not reflect individual trade-offs (e.g., matching a specific career sector, climate preference, or household budget).
- **Comparison Complexity**: Users must manually build spreadsheets or parse tables of raw prices to compare candidate cities side-by-side.
- **Trust Deficit**: Existing relocation guides are frequently sponsored by real estate developers or tourism boards, lacking objective, data-driven neutrality.

## 2. Target Users

Our target audience consists of adults aged 25–55 who are actively considering a major relocation within a 1–3 year horizon. This includes:
- **Remote Workers / Freelancers**: Seeking optimal cost-of-living trade-offs, reliable infrastructure (high-speed internet), and specific lifestyle amenities (coastal/mountain access).
- **Families with Children**: Prioritizing safety, healthcare quality, and school/education ratings.
- **Career Professionals**: Seeking hubs with high industry-specific career opportunities (e.g., Tech, Finance, Creative).
- **Pre-Retirees**: Researching stable, high-amenity lifestyle destinations before full retirement.

These users are digitally literate, research-driven, and value objective, evidence-based recommendations over anecdotal advice.

## 3. User Stories

### US-1: Quiz matching (Remote Worker / Career Professional)
*As a remote worker or professional, I want to answer a short questionnaire about my budget, industry sector, and climate preference, so that I can discover a ranked shortlist of cities that fit my lifestyle and professional goals.*

### US-2: School and family prioritization (Family with Children)
*As a parent planning a move, I want to specify education and healthcare as high priorities and housing as a strict constraint in my profile, so that the matching engine ranks family-friendly cities higher.*

### US-3: Side-by-side comparison (All Users)
*As a prospective relocator, I want to select 2 or 3 cities from my matches and compare their ratings side-by-side on a single screen, so that I can clearly understand the trade-offs between my top choices.*

### US-4: Transparency of matches (All Users)
*As a skeptical user, I want to see a clear justification ("why this fits you") for my matches, so that I can understand how my answers directly influenced the ranking.*

## 4. Goals

The MVP must validate one hypothesis: **adults planning a relocation will use a structured, questionnaire-driven tool to discover and compare candidate destinations more effectively than with general-purpose search.**

A first-time visitor should be able to:

1. Complete a short preference questionnaire in under 5 minutes.
2. Receive a ranked shortlist of cities that match their stated priorities.
3. Open a detailed profile for any shortlisted city.
4. Compare 2–3 cities side-by-side across the same set of dimensions.
5. Do all of the above in a single uninterrupted session, on a deployed public URL, without hitting a paywall or being forced to create an account.

If the MVP does not deliver this single end-to-end loop, it has not shipped.

## 5. Success Metrics

The MVP's success and hypothesis validation will be evaluated using the following session-based metrics:
1. **Questionnaire Completion Rate**: >= 60% of users who land on the page should complete the questionnaire and view results.
2. **Shortlist Engagement**: >= 40% of users who view the ranked results should select at least one city to shortlist.
3. **Comparison Rate**: >= 25% of users who view results should navigate to the side-by-side comparison screen.
4. **Session Duration**: Average session duration should exceed 3 minutes, indicating meaningful interaction with city profiles and comparison metrics.
5. **Zero PII Leakage**: 100% of user sessions must remain state-free on the server side, validating GDPR compliance.

## 6. Scope

### 3.1 In Scope (MVP)

| # | Capability | Notes |
|---|------------|-------|
| S1 | **Preference questionnaire** | Single fixed path, ~10 questions covering climate, housing budget, career/industry focus, healthcare priority, education priority (optional), community/cultural fit, and lifestyle. Single-question-per-screen layout. No conditional branching, no save-and-resume, no account required. |
| S2 | **Curated location dataset** | 30–50 cities across at least 3 continents. Open public sources or manually curated values. Each city carries the 7 dimensions listed in §6. |
| S3 | **Matching engine** | Deterministic weighted score over the 7 dimensions, with a per-dimension "match" component exposed as a 0–100 score and a one-line "why this fits you" reason. |
| S4 | **Ranked results view** | Top 10 matches displayed as cards with city name, country, overall match score, and the "why this fits you" line. |
| S5 | **City profile page** | One page per city showing the 7 dimensions on a 1–5 scale plus a 2–3 sentence qualitative summary and a "last updated" date. |
| S6 | **Side-by-side comparison** | Select 2 or 3 cities from the results; view a single screen aligning the 7 dimensions. The city that best matches the user on each row is visually highlighted. |
| S7 | **Session-based shortlist** | User's current selection of up to 3 cities persists for the browser session. No account, no server-side history, no cross-device sync. |
| S8 | **GDPR consent + privacy notice** | Cookie/analytics consent banner on first visit and a linked Privacy Policy. No marketing email capture, no analytics that require personal data. |
| S9 | **Public deployment** | App runs on the free tier of Cloudflare or Netlify, with HTTPS, CDN-served static assets, and rate limiting on the matching API. |

### 3.2 Explicitly Out of Scope (MVP)

The following are **not** built in the MVP and will not be retrofitted to the MVP codebase. They are listed here so any future request can be redirected to the post-MVP backlog:

- User accounts, registration, login, password reset, email verification
- Persistent cross-session history, saved comparisons on the server, shareable comparison links
- Neighborhood-level data; the MVP is city-level only
- Comparison of more than 3 cities
- Premium tier, payments, subscriptions, paywalls, entitlement enforcement
- Multiple user profiles per account, family decision mode
- Neighborhood data, school district indices, commute heatmaps, tax modeling
- Email capture, marketing automation, referral program, social sharing
- Mobile native apps; mobile is served via the responsive web app only
- Non-English languages and localization
- Real-time or third-party API calls at request time; all data is local to the app
- Continuous/automated data refresh; the MVP ships a static, manually updated dataset
- AI assistant, chatbot, conversational Q&A
- SEO-optimized public city pages (these can be added later; for MVP the city pages are reachable by URL but not optimized for organic acquisition)

## 7. Core User Journey

The MVP is a single linear loop. There are no alternate paths, no dashboards, no settings pages.

```
Landing → Questionnaire (≈10 questions) → Ranked Results (top 10)
                                              │
                          ┌───────────────────┼───────────────────┐
                          ▼                   ▼                   ▼
                     City Profile        City Profile        City Profile
                          │                   │                   │
                          └─────────► Comparison (2–3 cities) ◄──┘
                                            │
                                            ▼
                                       Back to Results
```

- **Landing page**: One sentence value proposition and a single primary CTA ("Start the questionnaire"). No account creation, no marketing content.
- **Questionnaire**: Single-question-per-screen, progress indicator, "Back" and "Skip" on every question. Submission triggers matching and routes to results.
- **Ranked results**: Top 10 cities as cards. Each card has a "View profile" link and a checkbox to add/remove from the comparison set (max 3).
- **City profile**: Static-style page summarizing the 7 dimensions. Includes "Add to comparison" and a "Back to results" link.
- **Comparison**: Available whenever the user has 2 or 3 cities selected. A persistent "Compare" button is visible from the results and profile pages. Comparison view shows one row per dimension with the best-matching city highlighted. "Remove" on each card; "Clear all" to reset.

The questionnaire is the only input that can change the ranking. To re-rank, the user clicks "Start over" from the results page and re-answers the questionnaire. There is no "refine my answers" UI in the MVP.

## 8. Functional Requirements

Numbered for easy reference. Each requirement is testable in a single user action.

- **FR-1**: The system shall present a preference questionnaire of approximately 10 questions, each on its own screen, with a visible progress indicator.
- **FR-2**: The questionnaire shall cover, at minimum: climate preference, housing budget range, career/industry focus, healthcare priority, education priority, community/cultural fit, and lifestyle (urban / suburban / rural).
- **FR-3**: All questionnaire questions shall be skippable; the system shall use a documented default weight for any skipped dimension.
- **FR-4**: On submission, the system shall return a ranked list of the top 10 cities from the curated dataset, ordered by descending match score.
- **FR-5**: Each result card shall display: city name, country, overall match score (0–100), and a one-line "why this fits you" explanation naming the 1–2 strongest matching dimensions.
- **FR-6**: The matching algorithm shall be deterministic: identical questionnaire inputs shall produce identical result ordering across requests and sessions.
- **FR-7**: The matching algorithm shall run on locally stored data only; no external API call shall be required to produce rankings.
- **FR-8**: The city profile page shall display all 7 dimensions for the city, each on a 1–5 scale, plus a 2–3 sentence qualitative description, plus a "last updated" date.
- **FR-9**: The user shall be able to add any city to a session shortlist and remove it, up to a maximum of 3 cities.
- **FR-10**: The user shall be able to view a side-by-side comparison of the 2 or 3 currently shortlisted cities, with one row per dimension.
- **FR-11**: In the comparison view, the city with the best score on each dimension shall be visually distinguished (bold, color, or icon — implementation choice).
- **FR-12**: The shortlist shall be cleared automatically when the user submits a new questionnaire or closes the browser.
- **FR-13**: The system shall display a cookie/analytics consent banner on the user's first visit, and shall not set non-essential cookies or analytics before consent is granted.
- **FR-14**: A Privacy Policy page shall be linked from the site footer and from the consent banner.
- **FR-15**: The application shall be deployable to the free tier of Cloudflare or Netlify, with HTTPS enforced, and shall run via Docker Compose locally with a documented one-command startup.

## 9. Data Requirements

### 6.1 City Attributes (the 7 dimensions)

| # | Dimension | Value Type | Notes |
|---|-----------|------------|-------|
| D1 | Climate | Categorical label (e.g., Mediterranean, Continental, Tropical) + numeric average high/low | Used to match climate preference and lifestyle fit |
| D2 | Cost of living | 1–5 index (1 = low, 5 = high) | Single composite, no line-item breakdown in MVP |
| D3 | Housing affordability | 1–5 index | Anchored to cost-of-living; users see them as one factor in the questionnaire |
| D4 | Career / industry fit | 1–5 index per major industry cluster (Tech, Finance, Healthcare, Creative, Manufacturing) | Scoring uses the industry the user selects |
| D5 | Education | 1–5 index | Single composite; explicit "not relevant" option in the questionnaire for users without children |
| D6 | Healthcare | 1–5 index | Single composite |
| D7 | Community & lifestyle | 1–5 index per lifestyle tag (Urban, Suburban, Coastal, Mountain, Arts/Culture, Family-oriented, Expat-friendly) | Scoring uses the lifestyle tags the user selects |

All indices are normalized to a 1–5 scale. Each city record also carries: name, country, region, latitude/longitude (for PostGIS readiness, not for MVP UI), and `last_updated` date.

### 6.2 Dataset Scope

- **Coverage**: 30–50 cities, distributed across at least 3 continents. Include at least 10 cities outside the user's assumed home market to demonstrate breadth.
- **Source policy**: Public open data (World Bank, Numbeo, national statistics offices, OpenStreetMap), or values manually curated from reputable published sources (e.g., Numbeo cost-of-living indices, public climate normals). Each city record's `last_updated` reflects the most recent source review.
- **Refresh**: Manual for the MVP. A documented checklist, not a pipeline.

### 6.3 Storage

- PostgreSQL with PostGIS extensions. Schema is `cities` (one row per city) and `location_scores` (one row per city per dimension), joined at query time.
- Seeded via a versioned SQL or JSON file in the repository; the app boots against an empty database by loading the seed.

## 10. Non-Functional Requirements

- **Performance**: Ranking results shall be returned in under 1 second (p95) after questionnaire submission on a standard broadband connection. Pages shall become interactive in under 2 seconds.
- **Availability**: Best-effort, no formal SLA. The MVP is deployed on free-tier infrastructure; downtime is acceptable during the validation phase.
- **Security**: HTTPS enforced everywhere. No personal data is stored server-side in the MVP. The only data persisted across requests is the user's selected city IDs, held in the browser session.
- **Compliance**: GDPR-aligned minimum. A privacy notice and a cookie consent banner are present on first visit. The MVP collects no personal data; questionnaire answers are processed in-browser session state and are not stored server-side.
- **Stack**: Node.js backend, React frontend, PostgreSQL with PostGIS. Local dev runs via Docker Compose; deployment targets Cloudflare or Netlify free tier.
- **Cost**: $0. No paid third-party services, no paid data feeds, no paid monitoring.
- **CI/CD**: GitHub Actions runs lint, unit tests, and a smoke build on every push to `main`. Manual deploy to the chosen free-tier host is acceptable for the MVP.

## 11. Acceptance Criteria

The MVP is shippable when **all** of the following are true. Each criterion is verifiable in a single manual or automated test.

- **AC-1**: A first-time visitor can complete the questionnaire, view the ranked results, open at least one city profile, and view a 2- or 3-city comparison in a single uninterrupted session, in under 10 minutes.
- **AC-2**: The questionnaire contains between 8 and 12 questions and can be completed in under 5 minutes.
- **AC-3**: On submission, the system returns exactly 10 ranked city results.
- **AC-4**: Submitting the same questionnaire answers twice produces the same ranking, in the same order.
- **AC-5**: Each result card shows the city name, country, an overall match score (0–100), and a non-empty "why this fits you" line that references at least one user-stated priority.
- **AC-6**: Each city profile shows the 7 dimensions, each on a 1–5 scale, a 2–3 sentence qualitative description, and a visible "last updated" date.
- **AC-7**: A user can add up to 3 cities to the comparison set; attempting to add a 4th is prevented with a clear, non-blocking message.
- **AC-8**: The comparison view aligns the 7 dimensions in a row-by-row table and visually highlights the best-matching city per row.
- **AC-9**: Closing the browser tab or submitting a new questionnaire clears the shortlist.
- **AC-10**: No personal data is sent to or stored on the server. The server logs no questionnaire answers, IP addresses, or user identifiers in a way that could identify an individual.
- **AC-11**: A cookie consent banner is shown on the first visit; no analytics or non-essential cookies are set before consent is granted.
- **AC-12**: A Privacy Policy page is reachable from the site footer and from the consent banner.
- **AC-13**: The app builds and runs locally via a documented single-command Docker Compose startup.
- **AC-14**: The app is deployed to a public URL on the free tier of Cloudflare or Netlify, with HTTPS enforced.
- **AC-15**: Lint, unit tests, and a smoke build pass in CI on the latest commit to `main`.

## 12. Open Questions

These are the only questions that must be resolved before or during the 3-day build. Everything else is deferred.

1. **Hosting target**: Cloudflare Pages + Workers, or Netlify + Netlify Functions? Both meet the free-tier constraint; pick one on Day 1 to avoid mid-build migration. (Constraint: PostgreSQL with PostGIS is not natively supported on either free tier — confirm the chosen host supports a managed Postgres option within budget, or use SQLite-compatible geometry libraries on the free tier.)
CEO: please go ahead with Netlify + Netlify Functions as frontend and the backend should be using docker compose on my ubutun server.
2. **Geographic coverage anchor**: Should the initial 30–50 cities be global (e.g., 15 US, 10 EU, 5 Asia-Pacific, 5 Latin America, 5 other) or concentrated in a single region to maximize data quality? Default to global coverage; revisit if data quality for the 5 "other" cities cannot be sourced in time.
CEO: Take the global coverage one.
3. **"Why this fits you" generation**: Hand-authored per city (highest quality, more work) or templated from the matching weights (fast, less distinctive)? Default to templated for MVP; allow hand-authored overrides where the team has time.
CEO: Yes, templated for MVP.

## 13. Future Scope

A single list. Items are sequenced roughly by expected priority but no dates are committed.

- User accounts, email capture, saved comparisons, shareable links, cross-device sync
- Premium tier with payments, gating, and unlimited usage
- Neighborhood-level data
- School district indices, commute heatmaps, tax modeling, advanced filtering
- Family decision mode, multi-profile households
- Content marketing, SEO-optimized public city pages, referral program
- Native mobile apps
- Internationalization beyond English
- Continuous/automated data refresh pipeline
- AI assistant or conversational Q&A
- Real estate, job, or moving-service integrations
- B2B / partner API

## Change Log

| Date       | Version | Author        | Changes                                                                                            |
| ---------- | ------- | ------------- | -------------------------------------------------------------------------------------------------- |
| 2026-06-01 | 1.0.0   | Human         | Initial version. |
| 2026-06-02 | 2.0.0   | Product Agent | Rewritten to be MVP-only. Removed detailed personas, premium-tier features, multi-phase roadmap, business-model pricing, exhaustive data-source analysis, and 24 open questions. Resolved internal contradictions (database size, questionnaire length, account vs. session model). Reorganized into a single linear user journey, 15 functional requirements, and 15 acceptance criteria. Length reduced from 1,829 to 210 lines. |
| 2026-06-10 | 3.0.0   | Product Agent | Updated to Stage 3. Added explicit Problem Statement, Target Users, User Stories (equally representing remote workers and families), and Success Metrics sections to satisfy design-product guidelines. |
