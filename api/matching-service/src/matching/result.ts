/**
 * Build the public MatchResponse from a list of ScoredCity records.
 *
 * The wire contract per Architecture §7.1 / API_Spec.md §2.4 is:
 *   {
 *     results: [
 *       { city: { slug, name, country, ... }, score, why, why_key, why_vars },
 *       ...
 *     ],
 *     generated_at
 *   }
 *
 * v0.4.0: every result now exposes `why_key` (one of the documented
 * dimension codes) and `why_vars` (template variables) so the frontend
 * can render the "why this fits you" sentence in the active locale
 * via i18next (PRD v3.2.0 S11). The English `why` string is kept as a
 * backwards-compatible fallback.
 */
import type { City } from '@relocatewise/shared';
import { buildWhyTemplate } from './why.js';
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
    | 'flag_image_url'
    | 'landmark_image_url'
    | 'last_updated'
  >;
  score: number;
  why: string;
  why_key: string;
  // v0.4.x — Bug 4: `why_vars.secondary_vars` is a nested record
  // for the tied-reason case. Use `unknown` so the type doesn't
  // pretend the value is always a string.
  why_vars?: Record<string, unknown>;
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
    results: scored.map((s) => {
      const why = buildWhyTemplate(s);
      return {
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
          flag_image_url: s.city.flag_image_url,
          landmark_image_url: s.city.landmark_image_url,
          last_updated: s.city.last_updated,
        },
        score: s.score,
        why: why.why,
        why_key: why.whyKey,
        ...(why.whyVars ? { why_vars: why.whyVars } : {}),
      };
    }),
    generated_at: generatedAt,
  };
}