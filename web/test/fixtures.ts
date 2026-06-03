/**
 * Test fixtures — small, fully-typed factories for the domain shapes.
 *
 * Lives next to the `*.test.*` files but is ignored by vitest's glob
 * include pattern, so it never runs as a test itself. Each helper has
 * sensible defaults and accepts overrides for the fields a test cares
 * about. Keep these factory-style (return a fresh object) so individual
 * tests can mutate the result without leaking state between tests.
 */
import type { City, UserProfile } from '@relocatewise/shared';
import type { MatchedCityFull, MatchResponseFull } from '../src/api';

export function makeCity(overrides: Partial<City> = {}): City {
  return {
    slug: 'lisbon',
    name: 'Lisbon',
    country: 'Portugal',
    country_code: 'PT',
    region: 'Europe',
    lat: 38.7223,
    lng: -9.1393,
    description: 'Sunny Atlantic coast with great food.',
    last_updated: '2026-05-15',
    dimensions: {
      climate: { label: 'Mediterranean' },
      cost: 3,
      housing: 3,
      education: 4,
      healthcare: 4,
      career: {
        tech: 3,
        finance: 2,
        healthcare: 3,
        creative: 4,
        manufacturing: 2,
      },
      community: {
        urban: 4,
        suburban: 3,
        coastal: 5,
        mountain: 1,
        arts_culture: 5,
        family_oriented: 3,
        expat_friendly: 5,
      },
    },
    ...overrides,
  };
}

export function makeMatchedCity(
  overrides: Partial<MatchedCityFull> = {},
): MatchedCityFull {
  return {
    city: {
      slug: 'lisbon',
      name: 'Lisbon',
      country: 'Portugal',
      country_code: 'PT',
      region: 'Europe',
      lat: 38.7223,
      lng: -9.1393,
      description: 'Sunny Atlantic coast with great food.',
      last_updated: '2026-05-15',
      dimensions: {
        climate: { label: 'Mediterranean' },
        cost: 3,
        housing: 3,
        education: 4,
        healthcare: 4,
        career: {
          tech: 3, finance: 2, healthcare: 3, creative: 4, manufacturing: 2,
        },
        community: {
          urban: 4, suburban: 3, coastal: 5, mountain: 1,
          arts_culture: 5, family_oriented: 3, expat_friendly: 5,
        },
      },
    },
    score: 88,
    why: 'Strong overall fit.',
    ...overrides,
    // Always keep the city overrides flat and re-apply on top.
  };
}

export function makeMatchResponse(
  overrides: Partial<MatchResponseFull> = {},
): MatchResponseFull {
  return {
    results: [
      makeMatchedCity({
        city: makeCity({ slug: 'lisbon', name: 'Lisbon' }),
        score: 88,
        why: 'Strong overall fit.',
      }),
      makeMatchedCity({
        city: makeCity({ slug: 'berlin', name: 'Berlin', country: 'Germany', country_code: 'DE' }),
        score: 74,
        why: 'Good career and education match.',
      }),
    ],
    generated_at: '2026-06-02T00:00:00Z',
    ...overrides,
  };
}

export function makeEmptyProfile(): UserProfile {
  return {
    climate: null,
    cost_importance: 0,
    cost_ceiling: null,
    housing_importance: 0,
    housing_ceiling: null,
    career_industry: null,
    education: 'not_relevant',
    healthcare_importance: 0,
    lifestyle_tags: [],
  };
}
