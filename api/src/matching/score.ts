/**
 * Deterministic matching engine (Architecture §6).
 *
 * Pure function: given a UserProfile and an array of City records, returns
 * the same ranked result on every call. No `Date.now()`, no `Math.random()`,
 * no async I/O, no time-of-day dependence (PRD FR-6, AC-4).
 *
 * The algorithm:
 *   1. For each (city, dimension) pair compute a per-dimension match m(c,d) ∈ [0,1]
 *      per the table in Architecture §6.2.
 *   2. For each dimension compute a raw weight per the table in §6.3.
 *   3. Normalize the weights over the **included** dimensions (sum to 1).
 *   4. Overall match = Σ_d w_d' · m(c, d), scaled to 0..100 and rounded.
 *   5. Sort by (score DESC, name ASC). Take the top 10.
 *
 * The top contributing dimensions per city are returned alongside the
 * score so the templated "why this fits you" generator (why.ts) can phrase
 * the explanation.
 */
import {
  CLIMATE_COMPATIBILITY,
  CLIMATE_LABEL_TO_PREFERENCE,
} from '@relocatewise/shared/climate';
import type {
  City,
  CityDimensions,
  UserProfile,
  Industry,
  LifestyleTag,
} from '@relocatewise/shared';

export const SEVEN_DIMENSIONS = [
  'climate',
  'cost',
  'housing',
  'career',
  'education',
  'healthcare',
  'community',
] as const;
export type Dimension = (typeof SEVEN_DIMENSIONS)[number];

/**
 * Per-dimension match score in the range [0, 1].
 */
export type DimensionMatch = number;

export interface PerDimensionContribution {
  dimension: Dimension;
  /** The normalized weight (sums to 1 over all included dimensions). */
  weight: number;
  /**
   * The raw weight before normalization (Architecture §6.3 table).
   * Importance 0/1/2/3 maps to 0/0.5/1/2 for cost, housing, healthcare;
   * 1 for climate; 0 or 1 for career/education/community. Exposed for
   * testability and introspection; the API does not return it.
   */
  rawWeight: number;
  /** The raw m(c, d) ∈ [0,1]. */
  match: DimensionMatch;
  /** w_d' · m(c, d). */
  contribution: number;
  /**
   * Optional context for the templated "why" generator. Holds the value
   * the user picked for this dimension, e.g. { climate: "mediterranean" }
   * or { industry: "tech" } or { tags: ["urban", "coastal"] }.
   */
  userValue?: Record<string, unknown>;
  /**
   * The actual contributing sub-score from the city. For example for
   * `career` this is the per-industry sub-score, for `community` the
   * max across the user's chosen tags.
   */
  cityValue?: number;
}

export interface ScoredCity {
  city: City;
  /** Integer 0..100, rounded. */
  score: number;
  /** Raw sum in [0,1] before rounding. Useful for tie-breaking and tests. */
  rawScore: number;
  contributions: PerDimensionContribution[];
}

export interface MatchOptions {
  /** Default 10. The PRD requires exactly 10 (AC-3). */
  topN?: number;
}

// ---------------------------------------------------------------------------
// Per-dimension match (Architecture §6.2)
// ---------------------------------------------------------------------------

function climateMatch(city: CityDimensions['climate'], user: UserProfile): DimensionMatch {
  if (user.climate === 'no_preference' || user.climate === null) {
    return 1.0;
  }
  const userPref = user.climate;
  // Exact label match → 1.0
  if (city.label.toLowerCase() === userPref) {
    return 1.0;
  }
  // Compatible group → 0.5
  const compat = CLIMATE_COMPATIBILITY[userPref];
  if (compat.has(city.label)) {
    return 0.5;
  }
  return 0.0;
}

/**
 * Cost and housing use the same formula:
 *   1.0 if city_score <= ceiling
 *   linear penalty (5 - city_score) / (5 - ceiling) otherwise
 *
 * If the user has no ceiling (null) or no importance, the dimension is
 * effectively excluded by the weighting step; this function still returns
 * a sensible value so the algorithm is always defined.
 */
function budgetMatch(cityScore: number, user: UserProfile, key: 'cost' | 'housing'): DimensionMatch {
  const ceiling = key === 'cost' ? user.cost_ceiling : user.housing_ceiling;
  if (ceiling == null) {
    return 0.5; // neutral
  }
  if (cityScore <= ceiling) {
    return 1.0;
  }
  if (ceiling >= 5) {
    return 0.0;
  }
  return (5 - cityScore) / (5 - ceiling);
}

function careerMatch(city: CityDimensions['career'], user: UserProfile): DimensionMatch {
  if (user.career_industry == null) {
    return 0.5; // neutral
  }
  return city[user.career_industry] / 5;
}

function educationMatch(city: number, user: UserProfile): DimensionMatch {
  if (user.education === 'not_relevant') {
    return 0.5; // neutral; weighting step will exclude this dimension
  }
  return city / 5;
}

function healthcareMatch(city: number, _user: UserProfile): DimensionMatch {
  return city / 5;
}

function communityMatch(city: CityDimensions['community'], user: UserProfile): DimensionMatch {
  if (user.lifestyle_tags.length === 0) {
    return 0.5; // neutral
  }
  let max = 0;
  for (const tag of user.lifestyle_tags) {
    const v = city[tag];
    if (v > max) {
      max = v;
    }
  }
  return max / 5;
}

// ---------------------------------------------------------------------------
// Per-dimension raw weight (Architecture §6.3)
// ---------------------------------------------------------------------------

function rawWeights(user: UserProfile): Record<Dimension, number> {
  // importance 0..3 maps to weight 0, 0.5, 1, 2
  const impToW = (i: number) => (i === 0 ? 0 : i === 1 ? 0.5 : i === 2 ? 1 : 2);
  return {
    climate: 1,
    cost: impToW(user.cost_importance),
    housing: impToW(user.housing_importance),
    career: user.career_industry == null ? 0 : 1,
    education: user.education === 'not_relevant' ? 0 : 1,
    healthcare: impToW(user.healthcare_importance),
    community: user.lifestyle_tags.length === 0 ? 0 : 1,
  };
}

// ---------------------------------------------------------------------------
// Score a single city
// ---------------------------------------------------------------------------

/**
 * Score a single city against the user profile. Returns the per-dimension
 * contributions (in stable order) and the raw 0..1 score.
 *
 * Pure function: depends only on its inputs.
 */
export function scoreCity(city: City, user: UserProfile): ScoredCity {
  const dims = city.dimensions;
  const rawW = rawWeights(user);

  // Build a per-dimension {match, rawWeight, extras} record first.
  const records: Record<Dimension, PerDimensionContribution> = {
    climate: {
      dimension: 'climate',
      weight: 0, // will be normalized below
      rawWeight: rawW.climate,
      match: climateMatch(dims.climate, user),
      contribution: 0,
      userValue: { climate: user.climate },
      cityValue: undefined,
    },
    cost: {
      dimension: 'cost',
      weight: 0,
      rawWeight: rawW.cost,
      match: budgetMatch(dims.cost, user, 'cost'),
      contribution: 0,
      userValue: {
        importance: user.cost_importance,
        ceiling: user.cost_ceiling,
      },
      cityValue: dims.cost,
    },
    housing: {
      dimension: 'housing',
      weight: 0,
      rawWeight: rawW.housing,
      match: budgetMatch(dims.housing, user, 'housing'),
      contribution: 0,
      userValue: {
        importance: user.housing_importance,
        ceiling: user.housing_ceiling,
      },
      cityValue: dims.housing,
    },
    career: {
      dimension: 'career',
      weight: 0,
      rawWeight: rawW.career,
      match: careerMatch(dims.career, user),
      contribution: 0,
      userValue: { industry: user.career_industry },
      cityValue: user.career_industry != null ? dims.career[user.career_industry] : undefined,
    },
    education: {
      dimension: 'education',
      weight: 0,
      rawWeight: rawW.education,
      match: educationMatch(dims.education, user),
      contribution: 0,
      userValue: { education: user.education },
      cityValue: dims.education,
    },
    healthcare: {
      dimension: 'healthcare',
      weight: 0,
      rawWeight: rawW.healthcare,
      match: healthcareMatch(dims.healthcare, user),
      contribution: 0,
      userValue: { importance: user.healthcare_importance },
      cityValue: dims.healthcare,
    },
    community: {
      dimension: 'community',
      weight: 0,
      rawWeight: rawW.community,
      match: communityMatch(dims.community, user),
      contribution: 0,
      userValue: { tags: user.lifestyle_tags },
      cityValue: maxCommunityTag(dims.community, user.lifestyle_tags),
    },
  };

  // Normalize weights over the **included** dimensions (rawW > 0).
  const included = SEVEN_DIMENSIONS.filter((d) => rawW[d] > 0);
  const totalRaw = included.reduce((acc, d) => acc + rawW[d], 0);
  for (const d of SEVEN_DIMENSIONS) {
    const w = totalRaw === 0 ? 0 : rawW[d] / totalRaw;
    records[d].weight = w;
  }

  // Sum contributions. With weights normalized over included dimensions
  // the total always lies in [0, 1] regardless of how many dimensions are
  // included. Excluded dimensions contribute 0.
  let rawScore = 0;
  for (const d of included) {
    const c = records[d].weight * records[d].match;
    records[d].contribution = c;
    rawScore += c;
  }

  // Special edge case: if every dimension was excluded (very unusual but
  // possible when the user skips every single question), give every city
  // a neutral 50 so the ranking is still defined and stable.
  if (included.length === 0) {
    rawScore = 0.5;
  }

  // Scale 0..1 → 0..100, round to nearest integer.
  const score = Math.round(rawScore * 100);

  return {
    city,
    score,
    rawScore,
    contributions: SEVEN_DIMENSIONS.map((d) => records[d]),
  };
}

function maxCommunityTag(
  city: CityDimensions['community'],
  tags: readonly LifestyleTag[],
): number | undefined {
  if (tags.length === 0) return undefined;
  let max = 0;
  for (const tag of tags) {
    const v = city[tag];
    if (v > max) max = v;
  }
  return max;
}

// ---------------------------------------------------------------------------
// Rank a list of cities
// ---------------------------------------------------------------------------

/**
 * Rank a list of cities against the user profile. Returns the top N cities
 * sorted by (score DESC, name ASC). Ties on score are broken deterministically
 * by the city name, so identical inputs always produce identical output
 * (PRD FR-6, AC-4).
 */
export function rankCities(
  user: UserProfile,
  cities: readonly City[],
  options: MatchOptions = {},
): ScoredCity[] {
  const topN = options.topN ?? 10;
  const scored = cities.map((c) => scoreCity(c, user));
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.city.name.localeCompare(b.city.name);
  });
  return scored.slice(0, topN);
}

// ---------------------------------------------------------------------------
// Helpers for tests
// ---------------------------------------------------------------------------

/** Re-export industry list (used in tests). */
export const INDUSTRY_KEYS: readonly Industry[] = [
  'tech',
  'finance',
  'healthcare',
  'creative',
  'manufacturing',
];

/** Re-export CLIMATE_LABEL_TO_PREFERENCE for "why" generator. */
export { CLIMATE_LABEL_TO_PREFERENCE };
