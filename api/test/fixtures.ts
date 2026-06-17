/**
 * Test fixtures used across the API test suite. Centralized here so the
 * matching engine, the "why" generator, and the API integration tests all
 * exercise the same canonical city data.
 */
import type { City, CityCareerSub, CityCommunitySub } from '@relocatewise/shared';

function fullCareer(values: Partial<CityCareerSub> = {}): CityCareerSub {
  return {
    tech: 3,
    finance: 3,
    healthcare: 3,
    creative: 3,
    manufacturing: 3,
    ...values,
  };
}

function fullCommunity(values: Partial<CityCommunitySub> = {}): CityCommunitySub {
  return {
    urban: 3,
    suburban: 3,
    rural: 3,
    coastal: 3,
    mountain: 3,
    arts_culture: 3,
    family_oriented: 3,
    expat_friendly: 3,
    ...values,
  };
}

export function makeCity(overrides: Partial<City> & Pick<City, 'slug' | 'name' | 'country'>): City {
  return {
    country_code: 'XX',
    region: 'Testland',
    lat: 0,
    lng: 0,
    description: 'Test city description.',
    last_updated: '2026-05-15',
    dimensions: {
      climate: { label: 'Temperate' },
      cost: 3,
      housing: 3,
      career: fullCareer(),
      education: 3,
      healthcare: 3,
      community: fullCommunity(),
      military_safety: 4,
    },
    ...overrides,
  };
}

/** A small canonical fixture set used in the matching engine tests. */
export const CITIES: City[] = [
  makeCity({
    slug: 'lisbon-pt',
    name: 'Lisbon',
    country: 'Portugal',
    country_code: 'PT',
    region: 'Europe',
    description: 'Coastal capital with mild weather, walkable neighborhoods, and a growing tech scene.',
    dimensions: {
      climate: { label: 'Mediterranean' },
      cost: 3,
      housing: 3,
      career: fullCareer({ tech: 4, finance: 3, healthcare: 3, creative: 5, manufacturing: 2 }),
      education: 4,
      healthcare: 4,
      community: fullCommunity({ urban: 5, suburban: 2, coastal: 5, mountain: 1, arts_culture: 5, family_oriented: 3, expat_friendly: 5 }),
      military_safety: 5,
    },
  }),
  makeCity({
    slug: 'berlin-de',
    name: 'Berlin',
    country: 'Germany',
    country_code: 'DE',
    region: 'Europe',
    description: 'Lively, artsy capital with a strong startup culture and a temperate continental climate.',
    dimensions: {
      climate: { label: 'Continental' },
      cost: 4,
      housing: 3,
      career: fullCareer({ tech: 5, finance: 3, healthcare: 3, creative: 5, manufacturing: 3 }),
      education: 5,
      healthcare: 5,
      community: fullCommunity({ urban: 5, suburban: 2, coastal: 1, mountain: 1, arts_culture: 5, family_oriented: 3, expat_friendly: 5 }),
      military_safety: 5,
    },
  }),
  makeCity({
    slug: 'bangkok-th',
    name: 'Bangkok',
    country: 'Thailand',
    country_code: 'TH',
    region: 'Asia-Pacific',
    description: 'Hot, humid megacity famous for street food, affordability, and a busy service economy.',
    dimensions: {
      climate: { label: 'Tropical' },
      cost: 2,
      housing: 2,
      career: fullCareer({ tech: 3, finance: 3, healthcare: 2, creative: 3, manufacturing: 3 }),
      education: 3,
      healthcare: 3,
      community: fullCommunity({ urban: 5, suburban: 1, coastal: 2, mountain: 0, arts_culture: 4, family_oriented: 3, expat_friendly: 5 }),
      military_safety: 3,
    },
  }),
  makeCity({
    slug: 'reykjavik-is',
    name: 'Reykjavik',
    country: 'Iceland',
    country_code: 'IS',
    region: 'Europe',
    description: 'Northern coastal capital with a sub-arctic climate, high quality of life, and a small creative economy.',
    dimensions: {
      climate: { label: 'Cold' },
      cost: 5,
      housing: 4,
      career: fullCareer({ tech: 3, finance: 2, healthcare: 3, creative: 4, manufacturing: 2 }),
      education: 5,
      healthcare: 5,
      community: fullCommunity({ urban: 3, suburban: 1, coastal: 5, mountain: 4, arts_culture: 4, family_oriented: 4, expat_friendly: 4 }),
      military_safety: 5,
    },
  }),
  makeCity({
    slug: 'sao-paulo-br',
    name: 'São Paulo',
    country: 'Brazil',
    country_code: 'BR',
    region: 'Latin America',
    description: 'Vast, energetic Brazilian megacity with a strong financial and creative sector.',
    dimensions: {
      climate: { label: 'Highland' },
      cost: 3,
      housing: 3,
      career: fullCareer({ tech: 4, finance: 5, healthcare: 3, creative: 4, manufacturing: 4 }),
      education: 4,
      healthcare: 3,
      community: fullCommunity({ urban: 5, suburban: 2, coastal: 1, mountain: 1, arts_culture: 4, family_oriented: 3, expat_friendly: 4 }),
      military_safety: 3,
    },
  }),
];
