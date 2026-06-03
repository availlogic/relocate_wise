/**
 * Build the public MatchResponse from a list of ScoredCity records.
 *
 * The wire contract per Architecture §7.1 is:
 *   {
 *     results: [
 *       { city: { slug, name, country, ... }, score, why },
 *       ...
 *     ]
 *   }
 *
 * We project just the city fields the results page needs plus the
 * integer score and the templated "why" line.
 */
import type { City } from '@relocatewise/shared';
import { whyThisFitsYou } from './why.js';
import type { ScoredCity } from './score.js';

export interface MatchResult {
  city: Pick<
    City,
    | 'slug'
    | 'name'
    | 'country'
    | 'country_code'
    | 'region'
    | 'lat'
    | 'lng'
    | 'description'
    | 'dimensions'
  >;
  score: number;
  why: string;
}

export interface MatchResponse {
  results: MatchResult[];
  /** ISO timestamp at which the result was generated (deterministic for tests). */
  generated_at: string;
}

export function buildMatchResponse(
  scored: ScoredCity[],
  generatedAt: string = new Date().toISOString(),
): MatchResponse {
  return {
    results: scored.map((s) => ({
      city: {
        slug: s.city.slug,
        name: s.city.name,
        country: s.city.country,
        country_code: s.city.country_code,
        region: s.city.region,
        lat: s.city.lat,
        lng: s.city.lng,
        description: s.city.description,
        dimensions: s.city.dimensions,
      },
      score: s.score,
      why: whyThisFitsYou(s),
    })),
    generated_at: generatedAt,
  };
}
