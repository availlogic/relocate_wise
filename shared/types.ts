/**
 * Shared type contract between the RelocateWise frontend and backend.
 * Imported by both /api and /web; no runtime dependencies.
 *
 * All shapes are versioned implicitly by their location in this file. Any
 * change here is a contract change and must be reflected in Zod schemas
 * (api/src/lib/validation.ts) and in the frontend API client.
 */

// ---------------------------------------------------------------------------
// Climate
// ---------------------------------------------------------------------------

/**
 * Climate preferences that a user can pick in the questionnaire.
 * Per Architecture §6.1 the "no_preference" option collapses all match
 * scores for that dimension to the neutral value, so the dimension is
 * effectively excluded from the overall score.
 */
export const CLIMATE_OPTIONS = [
  'tropical',
  'temperate',
  'mediterranean',
  'continental',
  'cold',
  'arid',
  'no_preference',
] as const;

export type ClimatePreference = (typeof CLIMATE_OPTIONS)[number];

/**
 * Canonical climate labels stored in the city dataset. These are the values
 * that appear in the `climate` dimension's `sub_scores.label` field. Climate
 * groups (defined in /shared/climate.ts) map a user preference to a set of
 * compatible city labels for the partial-match case in the scoring formula.
 */
export const CITY_CLIMATE_LABELS = [
  'Tropical',
  'Temperate',
  'Mediterranean',
  'Continental',
  'Cold',
  'Arid',
  'Highland',
] as const;

export type CityClimateLabel = (typeof CITY_CLIMATE_LABELS)[number];

// ---------------------------------------------------------------------------
// Career / industry
// ---------------------------------------------------------------------------

export const INDUSTRY_OPTIONS = [
  'tech',
  'finance',
  'healthcare',
  'creative',
  'manufacturing',
] as const;

export type Industry = (typeof INDUSTRY_OPTIONS)[number];

// ---------------------------------------------------------------------------
// Education
// ---------------------------------------------------------------------------

export const EDUCATION_OPTIONS = [
  'not_relevant',
  'somewhat',
  'important',
] as const;

export type EducationPriority = (typeof EDUCATION_OPTIONS)[number];

// ---------------------------------------------------------------------------
// Lifestyle tags
// ---------------------------------------------------------------------------

export const LIFESTYLE_TAGS = [
  'urban',
  'suburban',
  'rural',
  'coastal',
  'mountain',
  'arts_culture',
  'family_oriented',
  'expat_friendly',
] as const;

export type LifestyleTag = (typeof LIFESTYLE_TAGS)[number];

// ---------------------------------------------------------------------------
// Importance (0..3)
// ---------------------------------------------------------------------------

/** User importance slider. 0 = "I don't care", 3 = "Critical". */
export type Importance = 0 | 1 | 2 | 3;

// ---------------------------------------------------------------------------
// User profile — the request body of POST /api/match
// ---------------------------------------------------------------------------

/**
 * Shape of the JSON object sent to POST /api/match.
 *
 * Optional fields represent "skipped" answers per PRD FR-3. The matching
 * engine fills in documented defaults for any skipped dimension. The defaults
 * are defined in api/src/matching/defaults.ts so they live in one place.
 */
export interface UserProfile {
  /** User's climate preference, or "no_preference" if skipped. */
  climate: ClimatePreference | null;

  /** 0 = no cost concern, 3 = critical. */
  cost_importance: Importance;
  /** 1..5; only meaningful if cost_importance > 0. */
  cost_ceiling: number | null;

  /** 0 = no housing concern, 3 = critical. */
  housing_importance: Importance;
  /** 1..5; only meaningful if housing_importance > 0. */
  housing_ceiling: number | null;

  /** Picked industry, or null if user has no industry preference / skipped. */
  career_industry: Industry | null;

  /** Single composite priority; "not_relevant" excludes the dimension. */
  education: EducationPriority;

  /** 0 = no healthcare concern, 3 = critical. */
  healthcare_importance: Importance;

  /**
   * 0 = not a concern, 3 = critical. Weight table (Architecture §6.3)
   * is `{0, 1, 2.5, 4}` — a higher safety priority acts as a heavy
   * filter on the overall city match (AC-5).
   */
  military_safety_importance: Importance;

  /** 0..N lifestyle tags. Empty array = no preference for community dimension. */
  lifestyle_tags: LifestyleTag[];
}

// ---------------------------------------------------------------------------
// City record (the row from `cities` joined with its scores)
// ---------------------------------------------------------------------------

export interface CityClimateSub {
  label: CityClimateLabel;
}

export interface CityCareerSub {
  tech: number;
  finance: number;
  healthcare: number;
  creative: number;
  manufacturing: number;
}

export interface CityCommunitySub {
  urban: number;
  suburban: number;
  rural: number;
  coastal: number;
  mountain: number;
  arts_culture: number;
  family_oriented: number;
  expat_friendly: number;
}

/**
 * Sub-scores for the `military_safety` dimension (1 = high conflict risk,
 * 5 = extremely safe / stable). Carries the contextual details a UI
 * can surface: a categorical conflict-risk label and a travel-advisory
 * code (e.g. `"level_1"`).
 */
export interface CityMilitarySafetySub {
  conflict_risk: 'low' | 'moderate' | 'elevated' | 'high' | 'severe';
  travel_advisory: string;
}

export interface CityDimensions {
  climate: CityClimateSub;
  cost: number;
  housing: number;
  career: CityCareerSub;
  education: number;
  healthcare: number;
  community: CityCommunitySub;
  military_safety: number;
  military_safety_sub?: CityMilitarySafetySub;
}

export interface City {
  slug: string;
  name: string;
  country: string;
  country_code: string;
  region: string;
  lat: number;
  lng: number;
  description: string;
  last_updated: string; // ISO date, e.g. "2026-05-15"
  dimensions: CityDimensions;
}

// ---------------------------------------------------------------------------
// Match responses
// ---------------------------------------------------------------------------

export interface MatchedCity {
  city: {
    slug: string;
    name: string;
    country: string;
    country_code: string;
    region: string;
  };
  /** Overall match score on a 0-100 integer scale. */
  score: number;
  /** Templated one-line "why this fits you" explanation. */
  why: string;
}

export interface MatchResult {
  results: MatchedCity[];
}

// ---------------------------------------------------------------------------
// API error envelope
// ---------------------------------------------------------------------------

export interface ApiError {
  error: string;
  message: string;
}
