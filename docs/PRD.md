---
title: "Product Requirements"
version: "3.2.0"
status: draft
author: "Product Agent / Antigravity"
created: "2026-06-01"
updated: "2026-06-17"
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
- **Trust Deficit & Secondary Data Reliance**: Existing relocation guides are frequently sponsored by real estate developers or tourism boards, lacking objective, data-driven neutrality. Furthermore, relying on static "second-hand" rankings leads to stale, outdated information.
- **Geopolitical Risks**: High conflict or military risks in specific regions make them unsuitable for most relocators, yet general indexes fail to highlight this as a distinct dimension.
- **Cross-Platform Accessibility**: Existing relocation tools often lack responsive layouts, making them difficult to use on mobile devices while traveling or visiting candidate cities.

## 2. Target Users

Our target audience consists of adults aged 25–55 who are actively considering a major relocation within a 1–3 year horizon. This includes:
- **Remote Workers / Freelancers**: Seeking optimal cost-of-living trade-offs, reliable infrastructure (high-speed internet), and specific lifestyle amenities (coastal/mountain access).
- **Families with Children**: Prioritizing safety, healthcare quality, school/education ratings, and geopolitical stability and conflict risk.
- **Career Professionals**: Seeking hubs with high industry-specific career opportunities (e.g., Tech, Finance, Creative).
- **Pre-Retirees**: Researching stable, high-amenity lifestyle destinations before full retirement.
- **Bilingual / Expatriate Planners**: Users navigating international boundaries who require interface support in both English and Chinese.

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

### US-5: Geopolitical stability and conflict risk evaluation (All Users)
*As a prospective relocator, I want to evaluate the geopolitical stability and conflict risk of a city, so that I do not move to a region with high geopolitical danger or active conflicts.*

### US-6: Bilingual Language Selection (All Users)
*As a native Chinese speaker or expat, I want to toggle the application's language between English and Chinese, so that I can navigate and complete the questionnaire in my preferred language.*

### US-7: Mobile-first Access (All Users)
*As a user researching cities on the go, I want to access the website on my mobile device, so that I can seamlessly complete the quiz and view matching profiles while traveling.*

## 4. Goals

The MVP must validate one hypothesis: **adults planning a relocation will use a structured, questionnaire-driven tool to discover and compare candidate destinations more effectively than with general-purpose search.**

A first-time visitor should be able to:

1. Complete a short preference questionnaire in under 5 minutes.
2. Receive a ranked shortlist of cities that match their stated priorities (including geopolitical stability and conflict risk).
3. Open a detailed profile for any shortlisted city.
4. Compare 2–3 cities side-by-side across the same set of dimensions (8 dimensions total) in either English or Chinese.
5. Do all of the above in a single uninterrupted session on a desktop or mobile device, on a deployed public URL, without hitting a paywall or being forced to create an account.

If the MVP does not deliver this single end-to-end loop, it has not shipped.

## 5. Success Metrics

The MVP's success and hypothesis validation will be evaluated using the following session-based metrics:
1. **Questionnaire Completion Rate**: >= 60% of users who land on the page should complete the questionnaire and view results.
2. **Shortlist Engagement**: >= 40% of users who view the ranked results should select at least one city to shortlist.
3. **Comparison Rate**: >= 25% of users who view results should navigate to the side-by-side comparison screen.
4. **Session Duration**: Average session duration should exceed 3 minutes, indicating meaningful interaction with city profiles and comparison metrics.
5. **Zero PII Leakage**: 100% of user sessions must remain state-free on the server side, validating GDPR compliance.

## 6. Scope

### 6.1 In Scope (MVP)

| # | Capability | Notes |
|---|------------|-------|
| S1 | **Preference questionnaire** | Single fixed path, ~10 questions covering climate, housing budget, career/industry focus, healthcare priority, education priority (optional), community/cultural fit, lifestyle, and geopolitical and conflict risk priority. Single-question-per-screen layout. |
| S2 | **Curated location dataset** | 30–50 cities across at least 3 continents. Open public sources. Each city carries the 8 dimensions listed in §9.1. |
| S3 | **Matching engine** | Deterministic weighted score over the 8 dimensions, with a per-dimension "match" component exposed as a 0–100 score and a one-line "why this fits you" reason. |
| S4 | **Ranked results view** | Top 10 matches displayed as cards with city name, country, overall match score, and the "why this fits you" line. |
| S5 | **City profile page** | One page per city showing the 8 dimensions on a 1–5 scale plus a 2–3 sentence qualitative summary, a high-quality representative landmark image (landscape, landmark, or aerial view), and the country name accompanied by a high-quality national flag image (graphics file rather than text emoji), plus a "last updated" date. |
| S6 | **Side-by-side comparison** | Select 2 or 3 cities from the results; view a single screen aligning the 8 dimensions. The city that best matches the user on each row is visually highlighted. |
| S7 | **Session-based shortlist** | User's current selection of up to 3 cities persists for the browser session. No account, no server-side history. |
| S8 | **GDPR consent + privacy notice** | Cookie/analytics consent banner on first visit and a linked Privacy Policy. No marketing email capture. |
| S9 | **Public deployment** | App is deployed on Cloudflare. In production, Cloudflare Tunnel must be used to securely route traffic to the containerized Docker application, with HTTPS enforced and rate limiting. |
| S10 | **Automated ingestion pipeline** | Background script/worker running on a weekly or monthly schedule to fetch raw, authoritative data directly from primary sources (UN, OECD, government open data, Wikipedia, Numbeo) and feed it into the PostgreSQL database. |
| S11 | **Bilingual Localization** | Manual language selector on the UI enabling real-time toggling between English (default) and Chinese (Simplified). |
| S12 | **Responsive Web UI** | Fully responsive CSS/HTML layouts ensuring complete mobile and desktop accessibility. |

### 6.2 Explicitly Out of Scope (MVP)

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
- Languages other than English and Chinese (Simplified)
- Real-time or third-party API calls at request time; all data is local to the app database
- AI assistant, chatbot, conversational Q&A
- SEO-optimized public city pages

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

- **Landing page**: One sentence value proposition and a single primary CTA ("Start the questionnaire"). Includes a manual language selector (English / Chinese). No account creation, no marketing content.
- **Questionnaire**: Single-question-per-screen, progress indicator, "Back" and "Skip" on every question. Submission triggers matching and routes to results.
- **Ranked results**: Top 10 cities as cards. Each card has a "View profile" link and a checkbox to add/remove from the comparison set (max 3).
- **City profile**: Static-style page summarizing the 8 dimensions. Shows a city landmark photo and country flag graphic. Includes "Add to comparison" and a "Back to results" link.
- **Comparison**: Available whenever the user has 2 or 3 cities selected. A persistent "Compare" button is visible from the results and profile pages. Comparison view shows one row per dimension with the best-matching city highlighted. "Remove" on each card; "Clear all" to reset.

The questionnaire is the only input that can change the ranking. To re-rank, the user clicks "Start over" from the results page and re-answers the questionnaire. There is no "refine my answers" UI in the MVP.

## 8. Functional Requirements

Numbered for easy reference. Each requirement is testable in a single user action.

- **FR-1**: The system shall present a preference questionnaire of approximately 10 questions, each on its own screen, with a visible progress indicator.
- **FR-2**: The questionnaire shall cover, at minimum: climate preference, housing budget range, career/industry focus, healthcare priority, education priority, community/cultural fit, lifestyle (urban / suburban / rural), and geopolitical and conflict risk priority.
- **FR-3**: All questionnaire questions shall be skippable; the system shall use a documented default weight for any skipped dimension.
- **FR-4**: On submission, the system shall return a ranked list of the top 10 cities from the curated dataset, ordered by descending match score.
- **FR-5**: Each result card shall display: city name, country, overall match score (0–100), and a one-line "why this fits you" explanation naming the 1–2 strongest matching dimensions.
- **FR-6**: The matching algorithm shall be deterministic: identical questionnaire inputs shall produce identical result ordering across requests and sessions.
- **FR-7**: The matching algorithm shall run on locally stored database data only; no external API call shall be required to produce rankings at request time.
- **FR-8**: The city profile page shall display all 8 dimensions for the city, each on a 1–5 scale, plus a 2–3 sentence qualitative description, a representative city landmark image, the country name accompanied by a high-quality graphical flag image (SVG or PNG, bypassing standard text emoji), and a "last updated" date.
- **FR-9**: The user shall be able to add any city to a session shortlist and remove it, up to a maximum of 3 cities.
- **FR-10**: The user shall be able to view a side-by-side comparison of the 2 or 3 currently shortlisted cities, with one row per dimension (8 dimensions total).
- **FR-11**: In the comparison view, the city with the best score on each dimension shall be visually distinguished (bold, color, or icon — implementation choice).
- **FR-12**: The shortlist shall be cleared automatically when the user submits a new questionnaire or closes the browser.
- **FR-13**: The system shall display a cookie/analytics consent banner on the user's first visit, and shall not set non-essential cookies or analytics before consent is granted.
- **FR-14**: A Privacy Policy page shall be linked from the site footer and from the consent banner.
- **FR-15**: The application shall be deployable to Cloudflare, with HTTPS enforced, and shall run via Docker Compose, exposed securely to the internet in production via Cloudflare Tunnel.
- **FR-16**: The system shall run an automated background data ingestion job on a weekly or monthly schedule to fetch raw indicators directly from UN, OECD, Wikipedia, Numbeo, and government open data portals, clean and normalize the values, and update the PostgreSQL database.
- **FR-17**: The system shall support both English and Chinese (Simplified), defaulting to English, with a user-accessible manual toggle on the UI to switch between languages dynamically.
- **FR-18**: The frontend application shall be fully responsive, supporting all user actions (questionnaire, shortlist, comparison, and profile viewing) on mobile viewports (iOS and Android simulated dimensions) as well as desktop screens.

## 9. Data Requirements

### 9.1 City Attributes (the 8 dimensions)

| # | Dimension | Value Type | Notes |
|---|-----------|------------|-------|
| D1 | Climate | Categorical label (e.g., Mediterranean, Continental, Tropical) + numeric average high/low | Used to match climate preference and lifestyle fit |
| D2 | Cost of living | 1–5 index (1 = low, 5 = high) | Single composite, no line-item breakdown in MVP |
| D3 | Housing affordability | 1–5 index | Anchored to cost-of-living; users see them as one factor in the questionnaire |
| D4 | Career / industry fit | 1–5 index per major industry cluster (Tech, Finance, Healthcare, Creative, Manufacturing) | Scoring uses the industry the user selects |
| D5 | Education | 1–5 index | Single composite; explicit "not relevant" option in the questionnaire |
| D6 | Healthcare | 1–5 index | Single composite |
| D7 | Community & lifestyle | 1–5 index per lifestyle tag (Urban, Suburban, Coastal, Mountain, Arts/Culture, Family-oriented, Expat-friendly) | Scoring uses the lifestyle tags the user selects |
| D8 | Geopolitical and conflict risk | 1–5 index (1 = high conflict risk, 5 = extremely safe/stable) | Measures geopolitical stability, presence of regional/armed conflicts, and general safety. Lower scores act as a significant detractor. |

All indices are normalized to a 1–5 scale. Each city record also carries: name, country, region, latitude/longitude, representative landmark image link, country flag SVG link, and `last_updated` date.

### 9.2 Dataset Scope

- **Coverage**: 30–50 cities, distributed across at least 3 continents. Include at least 10 cities outside the user's assumed home market to demonstrate breadth.
- **Source policy**: Authoritative primary open data (World Bank, UN, OECD, national statistics offices, Wikipedia, Numbeo), gathered directly at source rather than using secondary rankings. Each city record's `last_updated` reflects the most recent pipeline refresh.
- **Refresh**: Automated weekly or monthly scheduled script, feeding cleaned and parsed data into the PostgreSQL database.

### 9.3 Storage

- PostgreSQL with PostGIS extensions. Schema is `cities` (one row per city) and `city_scores` (one row per city per dimension), joined at query time.
- Seeded via a versioned JSON file in the repository on first installation; updated thereafter by the scheduled ingestion pipeline.

## 10. Non-Functional Requirements

- **Performance**: Ranking results shall be returned in under 1 second (p95) after questionnaire submission on a standard broadband connection. Pages shall become interactive in under 2 seconds. Landmark images shall support lazy loading to minimize bandwidth on mobile. Ingestion pipeline tasks run asynchronously in the background and must not affect API latency.
- **Availability**: Best-effort, no formal SLA. The MVP is deployed on free-tier infrastructure; downtime is acceptable during the validation phase.
- **Security**: HTTPS enforced everywhere. No personal data is stored server-side in the MVP. The only data persisted across requests is the user's selected city IDs, held in the browser session. Cloudflare Tunnel is used to securely expose the application, shielding the origin server.
- **Compliance**: GDPR-aligned minimum. A privacy notice and a cookie consent banner are present on first visit. The MVP collects no personal data; questionnaire answers are processed in-browser session state and are not stored server-side.
- **Stack**: Node.js backend (API server and scheduled ingestion worker), React frontend, PostgreSQL with PostGIS. Local dev runs via Docker Compose; deployment targets Cloudflare with traffic routed securely via Cloudflare Tunnel.
- **Cost**: $0. No paid third-party services, no paid data feeds, no paid monitoring.
- **CI/CD**: GitHub Actions runs lint, unit tests, and a smoke build on every push to `main`. Manual deploy to the chosen free-tier host is acceptable for the MVP.

## 11. Acceptance Criteria

The MVP is shippable when **all** of the following are true. Each criterion is verifiable in a single manual or automated test.

- **AC-1**: A first-time visitor can complete the questionnaire, view the ranked results, open at least one city profile, and view a 2- or 3-city comparison in a single uninterrupted session, in under 10 minutes, on either desktop or mobile browsers, in English or Chinese.
- **AC-2**: The questionnaire contains between 8 and 12 questions and can be completed in under 5 minutes.
- **AC-3**: On submission, the system returns exactly 10 ranked city results.
- **AC-4**: Submitting the same questionnaire answers twice produces the same ranking, in the same order.
- **AC-5**: Each result card shows the city name, country, an overall match score (0–100), and a non-empty "why this fits you" line that references at least one user-stated priority.
- **AC-6**: Each city profile shows the 8 dimensions, each on a 1–5 scale, a 2–3 sentence qualitative description, a visible "last updated" date, a representative city landmark image, and a high-quality graphical flag image.
- **AC-7**: A user can add up to 3 cities to the comparison set; attempting to add a 4th is prevented with a clear, non-blocking message.
- **AC-8**: The comparison view aligns the 8 dimensions in a row-by-row table and visually highlights the best-matching city per row.
- **AC-9**: Closing the browser tab or submitting a new questionnaire clears the shortlist.
- **AC-10**: No personal data is sent to or stored on the server. The server logs no questionnaire answers, IP addresses, or user identifiers in a way that could identify an individual.
- **AC-11**: A cookie consent banner is shown on the first visit; no analytics or non-essential cookies are set before consent is granted.
- **AC-12**: A Privacy Policy page is reachable from the site footer and from the consent banner.
- **AC-13**: The app builds and runs locally via a documented single-command Docker Compose startup.
- **AC-14**: The app is deployed to a public URL on Cloudflare, with HTTPS enforced, and traffic routed exclusively through Cloudflare Tunnel in production.
- **AC-15**: Lint, unit tests, and a smoke build pass in CI on the latest commit to `main`.
- **AC-16**: The background data ingestion job successfully executes, pulling raw indicator data from at least one primary source and populating the database scores without errors.
- **AC-17**: The user can manually toggle between English and Chinese on any page, and all UI text, labels, questions, and matching results update accordingly.
- **AC-18**: The user interface is fully responsive, passing mobile layout verification (no broken overlaps, horizontal scroll issues, or unclickable elements) on simulated iOS/Android mobile screens.

## 12. Open Questions

These are the only questions that must be resolved before or during the 3-day build. Everything else is deferred.

1. **Hosting target**: Cloudflare + Docker Compose + Cloudflare Tunnel. (Resolved in Version 3.2.0: Netlify host has been replaced with Cloudflare to match security constraints, utilizing Cloudflare Tunnel to expose Docker containers).
2. **Geographic coverage anchor**: Should the initial 30–50 cities be global (e.g., 15 US, 10 EU, 5 Asia-Pacific, 5 Latin America, 5 other) or concentrated in a single region to maximize data quality? Default to global coverage; revisit if data quality for the 5 "other" cities cannot be sourced in time.
   *CEO decision: Take the global coverage one.*
3. **"Why this fits you" generation**: Hand-authored per city (highest quality, more work) or templated from the matching weights (fast, less distinctive)? Default to templated for MVP; allow hand-authored overrides where the team has time.
   *CEO decision: Yes, templated for MVP.*
4. **Translation asset localization**: Should we use localized JSON translation files packaged in the frontend bundle or fetch them dynamically from an external source? (Default: local JSON i18n bundle to ensure 0ms network latency).
5. **Landmark photo licensing & storage**: How should city landmark photos be hosted without incurring hosting charges? (Default: public domain SVG/PNG files hosted locally or via free CDNs).

## 13. Future Scope

A single list. Items are sequenced roughly by expected priority but no dates are committed.

- User accounts, email capture, saved comparisons, shareable links, cross-device sync
- Premium tier with payments, gating, and unlimited usage
- Neighborhood-level data
- School district indices, commute heatmaps, tax modeling, advanced filtering
- Family decision mode, multi-profile households
- Content marketing, SEO-optimized public city pages, referral program
- Native mobile apps
- Internationalization beyond English and Chinese
- AI assistant or conversational Q&A
- Real estate, job, or moving-service integrations
- B2B / partner API

## Change Log

| Timestamp | Type | Summary | Sections |
|---|---|---|---|
| 2026-06-01 | Add | Initial version. | All |
| 2026-06-02 | Replace | Rewritten to be MVP-only. Removed personas, premium features, payments, and out-of-scope items. Length reduced from 1,829 to 210 lines. | All |
| 2026-06-10 | Add | Updated to Stage 3. Added explicit Problem Statement, Target Users, User Stories, and Success Metrics. | 1, 2, 3, 5 |
| 2026-06-17T13:34:00Z | Add | Added Military Safety dimension, automated ingestion pipeline requirements, updated out-of-scope, and updated acceptance criteria. | 1, 2, 3, 5, 6, 8, 9, 11 |
| 2026-06-17T14:38:00Z | Replace | Added bilingual (EN/ZH) support, mobile responsiveness, rich city profiles (landmark images, SVG flags), Cloudflare Tunnel deployment, and renamed Military Safety to Geopolitical and Conflict Risk. | All |
