---
title: "Research Report"
version: "1.0.0"
status: draft
author: "Research Agent"
created: "2026-06-10"
updated: "2026-06-10"
related_docs:
  - "docs/Vision.md"
  - "docs/Constraints.md"
---

# RelocateWise — Research Report

This document compiles market, competitor, technology, and regulatory research to support the development of the RelocateWise decision-support tool. It challenges assumptions, provides evidence-based conclusions, and validates the recommended scope of the Minimum Viable Product (MVP) based on the project's vision and constraints.

---

## Market Analysis

### Relocation and Migration Trends
The landscape of residential migration has been permanently altered by the growth of remote work and the shift in cost-of-living dynamics.
*   **Target Demographic Dynamics**: The primary target audience of adults aged 25–55 consists of professionals, remote workers, families, and pre-retirees. Research indicates that younger, college-educated professionals are the most mobile segment, with approximately 20% of remote workers intending to relocate in any given year.
*   **Lifestyle-Driven Decisions**: Rather than relocating solely for a physical office location, individuals are moving based on lifestyle factors. High-cost urban centers are experiencing "urban flight," with populations redistributing toward suburban, mid-sized, or coastal areas offering a lower cost of living, access to nature, and better quality of life.
*   **Geographic Focus Areas**: To validate the global matching hypothesis, the data seed must represent key international destinations:
    *   **North America**: Major job and lifestyle hubs (e.g., Austin, Denver, Toronto, Vancouver).
    *   **Europe**: Highly accessible expat and remote work capitals (e.g., Amsterdam, Berlin, Lisbon, Dublin).
    *   **Asia**: High-density tech and financial centers (e.g., Singapore, Tokyo, Seoul, Bangalore).
    *   **Latin America**: Low-cost, high-lifestyle destinations (e.g., Mexico City, Buenos Aires, Santiago).
    *   **Oceania**: High-quality-of-life cities (e.g., Sydney, Melbourne, Auckland).

---

## Competitor Analysis

A review of existing location matching and comparison tools reveals key market niches and operational strategies.

### Direct Competitors

#### 1. Nomad List
*   **Focus**: Digital nomads, short-to-medium-term travelers, and remote workers.
*   **Features**: Large community forum, extensive live-updating spreadsheet of city metrics, cost indices, weather, and safety.
*   **Business Model**: Paid subscription ($99/year or lifetime membership) to access community and detailed filters.
*   **Limitations for Relocating Families**: Nomad List focuses heavily on nomad-centric metrics (coworking spaces, expat friendliness, nightlife) and lacks deep metrics for long-term relocation, such as public school quality, neighborhood-level safety, or long-term tax structures. Additionally, its high paywall deters casual planners.

#### 2. WhereNext
*   **Focus**: Long-term expats and individual/family relocations.
*   **Features**: Free, database-driven city search. Integrates international school directories, visa guidelines, basic cost-of-living data, and basic tax profiles.
*   **Business Model**: Advertising, affiliate links with relocation services, moving companies, and international school consultants.
*   **Limitations**: The interface is content-heavy and lacks a simple, personalized 5-minute questionnaire that translates personal tradeoffs directly into city rankings.

#### 3. Novad
*   **Focus**: "Feelings-first" lifestyle matching.
*   **Features**: Interactive quiz assessing user preferences on qualitative vibes (e.g., creative energy, calm, adventure) rather than just raw quantitative numbers.
*   **Business Model**: Free access, potential future partnerships.
*   **Limitations**: Data depth is limited, and it relies heavily on subjective tags rather than verified public indices for core dimensions like healthcare, climate history, and cost of living.

### Indirect Competitors

#### 1. Numbeo & Expatistan
*   **Focus**: Crowdsourced cost of living and quality of life indices.
*   **Features**: Extensive side-by-side cost comparisons for consumer prices, rent, groceries, restaurants, and local purchasing power.
*   **Business Model**: Ad-supported free tier; commercial API licenses.
*   **Limitations**: The raw data is extensive but lacks curation. Users are presented with dense tables of individual prices (e.g., "1 liter of milk," "1 pair of jeans"), creating information overload.

#### 2. MyLifeElsewhere
*   **Focus**: Country-level and city-level side-by-side comparisons.
*   **Features**: Focuses on showing "what if" scenarios (e.g., "If you moved from Chicago to Munich, you would spend 20% less on rent").
*   **Business Model**: Ad-supported.
*   **Limitations**: Lacks a multi-dimensional recommendation engine. It works best if the user already knows the target city, but does not help them discover candidate cities from scratch.

---

## User Pain Points

Based on consumer behavior studies and forum analysis (e.g., Reddit's r/samegrassbutgreener, r/expats, and r/digitalnomad), users face several distinct friction points when planning a move:

1.  **Information Overload**: Users must consult multiple disconnected sources (Wikipedia for climate, Numbeo for cost of living, government portals for safety, local school boards for education) to build a single city profile.
2.  **Lack of Objective Personalization**: General-purpose "Best Places to Live" articles are static and prioritize generic factors. A single parent, a remote software engineer, and a retiree have completely different priorities, which static lists fail to address.
3.  **Comparison Friction**: Standard comparison requires manually creating spreadsheets to line up factors. No tool provides a clean, unified view highlighting the relative strengths of candidate cities side-by-side.
4.  **Trust Deficit**: Many relocation guides are sponsored by real estate developments or tourism boards, leading to skepticism about the objectivity of recommendations.

---

## Technology Landscape

### Public and Open-Data Sources
To align with the $0 external tooling budget and ensure data objectivity, RelocateWise must leverage reputable, free public datasets:

*   **OECD Subnational Data Portal**: Offers comprehensive regional and municipal metrics across 40+ countries. Provides reliable datasets on local employment rates, environmental quality, disposable income, and housing affordability index values.
*   **United Nations (UNData) & UNESCO**: Provides country-level and regional metrics for education enrollment, health system statistics (WHO), gender equality, and climate classifications.
*   **National and Regional Open Data Portals**:
    *   *United States*: Data.gov and US Census Bureau (American Community Survey) for education indices, safety indicators, and median household income.
    *   *Europe*: Data.europa.eu and Eurostat for standardized regional indices on health access, cost indexes, and regional infrastructure.
    *   *Oceania/Asia*: Central statistics offices (e.g., Australian Bureau of Statistics, Singapore SingStat) offering local municipal metrics.
*   **Copernicus Climate Data & NOAA**: Open climate databases providing long-term temperature, humidity, and rainfall averages for geographic coordinates.

### Technical Limitations of External Data
*   **Data Consistency**: Metrics like school quality or safety are reported differently across jurisdictions (e.g., US school district ratings vs. European national education rankings). RelocateWise must normalize these to a standardized 1–5 index.
*   **API Rate Limits & Commercial Terms**: Crowdsourced sites like Numbeo prohibit free automated scraping. Using their official API incurs recurring costs. Therefore, static curation using open-licensed public data (UN, OECD, and government portals) is the most viable strategy for the MVP.

---

## Business Risks

1.  **Data Maintenance Churn**: Local economies, rent prices, and safety statistics shift. A static dataset will decay over time, reducing trust. RelocateWise must establish a low-effort manual update checklist for periodic review.
2.  **Low Relocation Frequency (High Churn)**: A relocation decision is a low-frequency transaction (typically occurring every 3–7 years for an individual). The product must rely on high customer acquisition efficiency (SEO, word-of-mouth, organic tools) because recurring subscription retention will naturally decay once the user makes a final decision.
3.  **Adoption Resistance**: Users may be hesitant to pay $12/month or $99/year without a high-quality preview. The freemium model must clearly demonstrate value (e.g., showing the top 3 matches for free) before prompting for a premium subscription.

---

## Technical Risks

1.  **Stateless Serverless Database Connections**: Netlify Functions are stateless and spin up/down on demand. Connecting directly to a PostgreSQL database on a separate Ubuntu server on each function call can exhaust the database connection pool. The backend must implement a connection pooler (like PgBouncer) or expose data via a lightweight API layer.
2.  **Geospatial (PostGIS) Overhead**: While PostgreSQL supports robust geospatial queries through PostGIS, running and maintaining a PostGIS database on a self-hosted Ubuntu server requires proper configuration, indexing, and resource management.
3.  **Subjective Index Normalization**: Compiling different public metrics into 1–5 indices requires a transparent, auditable formula. If the algorithm's calculation is too opaque, users will lose trust when they receive unexpected matches.

---

## Regulatory Considerations

### General Data Protection Regulation (GDPR) Compliance
RelocateWise must implement strict privacy-by-design principles:
*   **Minimizing PII**: The MVP does not store user profiles, email addresses, or questionnaire answers on the database server. All questionnaire state is processed in the client session or passed in transient API request bodies.
*   **Cookie Consent**: A consent banner must govern any analytical or non-essential cookies.
*   **Transparency**: The site must link to a Privacy Policy documenting that questionnaire choices are used solely for real-time recommendation and are not shared or stored.

### Fair Housing Act (FHA) and Discriminatory Steering
In the United States, the Fair Housing Act prohibits steering home buyers or renters toward or away from specific areas based on protected classes (race, color, religion, sex, disability, familial status, or national origin).
*   **Algorithmic Risk**: If a location algorithm utilizes demographic data or proxy variables (e.g., school quality or safety ratings in a way that correlates closely with racial demographics) to recommend areas, it could face steering claims or disparate impact liability.
*   **Mitigation Strategy**:
    *   Keep matches city-wide in the MVP, avoiding granular neighborhood-level sorting.
    *   Do not collect demographic inputs (race, age, gender, familial status) in the questionnaire.
    *   Ensure all rating indices (Healthcare, Cost of Living, Climate) are derived strictly from objective, publicly accessible datasets (UN, OECD, NOAA).
    *   Provide clear disclaimers that recommendations are for general information and decision-support purposes, and do not constitute real estate advice or steering.

---

## Recommended Opportunities

1.  **Transparent Match Explanation**: Expose the specific factors driving a city's match score (e.g., "This city is in your top matches because it aligns with your Mediterranean climate preference and Tech career industry index"). This builds user trust and aligns with the product principle of *Personalization without sacrifice of objectivity*.
2.  **Objective Open Data Foundation**: By relying strictly on UN, OECD, and open-government datasets, RelocateWise can market itself as the most objective, unbiased relocation tool, contrasting with competitor platforms that rely on crowdsourced data or affiliate commission incentives.
3.  **Stateless Frontend/Stateful Backend Architecture**: Utilizing session storage in the browser for the user shortlist (up to 3 cities) and passing city IDs to the backend for side-by-side comparisons eliminates the need for user accounts, speeding up the user experience and lowering security overhead.

---

## Recommended MVP Scope

The research supports the following functional scope for the RelocateWise MVP to validate user demand under the project's constraints:

*   **Quiz Structure**: A 10-question quiz focusing on objective lifestyle tradeoffs (climate, budget, industry sector, healthcare, education priority, and location density) with no registration wall.
*   **City Coverage**: A seed database of 30–50 representative global cities, ensuring even distribution across North America, Europe, Asia, Latin America, and Oceania.
*   **Matching Engine**: A deterministic, weighted scoring algorithm executed backend-side over local PostgreSQL tables.
*   **Session Shortlist & Comparison**: A client-side managed list of up to 3 selected cities, rendered in a side-by-side comparative matrix highlighting the top-scoring city for each chosen dimension.
*   **Data Sources**: Standardized city ratings compiled manually from public OECD, UN, and national census portal reports, normalized to a 1–5 scale.
