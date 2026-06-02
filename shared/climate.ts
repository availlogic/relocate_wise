/**
 * Climate compatibility table (Architecture §15 Open Decision 1, resolved on Day 1).
 *
 * The matching algorithm (api/src/matching/score.ts) computes:
 *   1.0 if the city's climate label exactly matches the user's preference
 *   0.5 if the city's label is in the same compatibility group as the user's preference
 *   0.0 otherwise
 *
 * The grouping below defines three buckets — `warm`, `temperate`, `cold` —
 * plus a special group `no_preference` that always returns 1.0 (handled
 * in the algorithm itself, not here).
 */
import type { ClimatePreference, CityClimateLabel } from './types.js';

/**
 * For each user preference, the set of city labels that should be treated
 * as a "compatible group" (i.e. score 0.5 instead of 0).
 *
 * Note: the user's preference is always considered exact-match, so a
 * Mediterranean preference will always score 1.0 against a Mediterranean
 * city. The compatibility table is only consulted when the labels differ.
 */
export const CLIMATE_COMPATIBILITY: Readonly<
  Record<ClimatePreference, ReadonlySet<CityClimateLabel>>
> = {
  tropical: new Set<CityClimateLabel>(['Tropical']),
  temperate: new Set<CityClimateLabel>(['Temperate', 'Highland']),
  mediterranean: new Set<CityClimateLabel>(['Mediterranean', 'Temperate']),
  continental: new Set<CityClimateLabel>(['Continental', 'Temperate', 'Highland']),
  cold: new Set<CityClimateLabel>(['Cold', 'Continental', 'Highland']),
  arid: new Set<CityClimateLabel>(['Arid', 'Mediterranean']),
  no_preference: new Set<CityClimateLabel>([]),
};

/**
 * Resolve the climate label of a city into the user-preference bucket it
 * most closely matches. Used by the "why this fits you" generator to phrase
 * the templated explanation.
 */
export const CLIMATE_LABEL_TO_PREFERENCE: Readonly<
  Record<CityClimateLabel, ClimatePreference>
> = {
  Tropical: 'tropical',
  Temperate: 'temperate',
  Mediterranean: 'mediterranean',
  Continental: 'continental',
  Cold: 'cold',
  Arid: 'arid',
  Highland: 'temperate',
};
