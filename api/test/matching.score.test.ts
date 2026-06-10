/**
 * Tests for the deterministic matching engine.
 *
 * These tests pin down the spec in Architecture §6.2 / §6.3:
 *   - Per-dimension match m(c, d) ∈ [0, 1]
 *   - Per-dimension raw weight
 *   - Normalization over included dimensions
 *   - Round-to-0..100
 *   - Tie-breaking on (score DESC, name ASC)
 *   - Determinism (PRD FR-6, AC-4)
 *   - Default topN = 10 (PRD AC-3)
 */
import { describe, it, expect } from 'vitest';
import { withDefaults } from '../src/matching/defaults.js';
import { rankCities, scoreCity, SEVEN_DIMENSIONS } from '../src/matching/score.js';
import { CITIES, makeCity } from './fixtures.js';
import type { City, UserProfile } from '@relocatewise/shared';

const baseUser: UserProfile = withDefaults({});

describe('matching engine — defaults', () => {
  it('withDefaults returns a fully-populated profile', () => {
    const p = withDefaults({});
    expect(p.climate).toBeNull();
    expect(p.cost_importance).toBe(0);
    expect(p.cost_ceiling).toBeNull();
    expect(p.housing_importance).toBe(0);
    expect(p.housing_ceiling).toBeNull();
    expect(p.career_industry).toBeNull();
    expect(p.education).toBe('not_relevant');
    expect(p.healthcare_importance).toBe(0);
    expect(p.lifestyle_tags).toEqual([]);
  });

  it('withDefaults fills only the missing fields', () => {
    const p = withDefaults({ climate: 'temperate', lifestyle_tags: ['urban'] });
    expect(p.climate).toBe('temperate');
    expect(p.lifestyle_tags).toEqual(['urban']);
    expect(p.cost_importance).toBe(0);
  });
});

describe('matching engine — per-dimension match', () => {
  const user: UserProfile = withDefaults({
    climate: 'mediterranean',
    cost_importance: 3,
    cost_ceiling: 2,
    housing_importance: 3,
    housing_ceiling: 2,
    career_industry: 'tech',
    education: 'important',
    healthcare_importance: 2,
    lifestyle_tags: ['urban', 'coastal'],
  });

  it('climate: 1.0 for exact label match', () => {
    const city = makeCity({
      slug: 'a', name: 'A', country: 'X',
      dimensions: { ...makeCity({ slug: 'b', name: 'B', country: 'X' }).dimensions, climate: { label: 'Mediterranean' } },
    });
    const c = scoreCity(city, user);
    const climateC = c.contributions.find((x) => x.dimension === 'climate')!;
    expect(climateC.match).toBe(1.0);
  });

  it('climate: 0.5 for compatible group', () => {
    const city = makeCity({
      slug: 'a', name: 'A', country: 'X',
      dimensions: { ...makeCity({ slug: 'b', name: 'B', country: 'X' }).dimensions, climate: { label: 'Temperate' } },
    });
    const c = scoreCity(city, user);
    const climateC = c.contributions.find((x) => x.dimension === 'climate')!;
    expect(climateC.match).toBe(0.5);
  });

  it('climate: 0.0 for incompatible label', () => {
    const city = makeCity({
      slug: 'a', name: 'A', country: 'X',
      dimensions: { ...makeCity({ slug: 'b', name: 'B', country: 'X' }).dimensions, climate: { label: 'Cold' } },
    });
    const c = scoreCity(city, user);
    const climateC = c.contributions.find((x) => x.dimension === 'climate')!;
    expect(climateC.match).toBe(0.0);
  });

  it('climate: 1.0 for "no_preference" user regardless of city label', () => {
    const city = makeCity({
      slug: 'a', name: 'A', country: 'X',
      dimensions: { ...makeCity({ slug: 'b', name: 'B', country: 'X' }).dimensions, climate: { label: 'Tropical' } },
    });
    const c = scoreCity(city, withDefaults({ climate: null }));
    const climateC = c.contributions.find((x) => x.dimension === 'climate')!;
    expect(climateC.match).toBe(1.0);
  });

  it('cost: 1.0 when city score is at or below ceiling', () => {
    const city = makeCity({
      slug: 'a', name: 'A', country: 'X',
      dimensions: { ...makeCity({ slug: 'b', name: 'B', country: 'X' }).dimensions, cost: 2 },
    });
    const c = scoreCity(city, withDefaults({ cost_importance: 3, cost_ceiling: 2 }));
    expect(c.contributions.find((x) => x.dimension === 'cost')!.match).toBe(1.0);
  });

  it('cost: linear penalty when above ceiling', () => {
    const city = makeCity({
      slug: 'a', name: 'A', country: 'X',
      dimensions: { ...makeCity({ slug: 'b', name: 'B', country: 'X' }).dimensions, cost: 4 },
    });
    // ceiling 2 → (5 - 4) / (5 - 2) = 1/3
    const c = scoreCity(city, withDefaults({ cost_importance: 3, cost_ceiling: 2 }));
    expect(c.contributions.find((x) => x.dimension === 'cost')!.match).toBeCloseTo(1 / 3, 5);
  });

  it('cost: 0.0 when city is well above the ceiling', () => {
    const city = makeCity({
      slug: 'a', name: 'A', country: 'X',
      dimensions: { ...makeCity({ slug: 'b', name: 'B', country: 'X' }).dimensions, cost: 5 },
    });
    // ceiling 3 → (5 - 5) / (5 - 3) = 0
    const c = scoreCity(city, withDefaults({ cost_importance: 3, cost_ceiling: 3 }));
    expect(c.contributions.find((x) => x.dimension === 'cost')!.match).toBe(0.0);
  });

  it('cost: 1.0 when city is at the ceiling (within budget)', () => {
    const city = makeCity({
      slug: 'a', name: 'A', country: 'X',
      dimensions: { ...makeCity({ slug: 'b', name: 'B', country: 'X' }).dimensions, cost: 5 },
    });
    // City at cost 5, ceiling at 5: still within the user's budget.
    const c = scoreCity(city, withDefaults({ cost_importance: 3, cost_ceiling: 5 }));
    expect(c.contributions.find((x) => x.dimension === 'cost')!.match).toBe(1.0);
  });

  it('cost: 0.5 neutral when no ceiling provided', () => {
    const city = makeCity({
      slug: 'a', name: 'A', country: 'X',
      dimensions: { ...makeCity({ slug: 'b', name: 'B', country: 'X' }).dimensions, cost: 5 },
    });
    const c = scoreCity(city, withDefaults({ cost_importance: 3, cost_ceiling: null }));
    expect(c.contributions.find((x) => x.dimension === 'cost')!.match).toBe(0.5);
  });

  it('housing: same formula as cost', () => {
    const city = makeCity({
      slug: 'a', name: 'A', country: 'X',
      dimensions: { ...makeCity({ slug: 'b', name: 'B', country: 'X' }).dimensions, housing: 4 },
    });
    // ceiling 2 → (5 - 4) / (5 - 2) = 1/3
    const c = scoreCity(city, withDefaults({ housing_importance: 3, housing_ceiling: 2 }));
    expect(c.contributions.find((x) => x.dimension === 'housing')!.match).toBeCloseTo(1 / 3, 5);
  });

  it('career: uses the per-industry sub-score', () => {
    const city = makeCity({
      slug: 'a', name: 'A', country: 'X',
      dimensions: { ...makeCity({ slug: 'b', name: 'B', country: 'X' }).dimensions, career: { tech: 4, finance: 1, healthcare: 1, creative: 1, manufacturing: 1 } },
    });
    const cTech = scoreCity(city, withDefaults({ career_industry: 'tech' }));
    const cFin = scoreCity(city, withDefaults({ career_industry: 'finance' }));
    expect(cTech.contributions.find((x) => x.dimension === 'career')!.match).toBe(4 / 5);
    expect(cFin.contributions.find((x) => x.dimension === 'career')!.match).toBe(1 / 5);
  });

  it('career: 0.5 neutral when user has no industry', () => {
    const city = makeCity({
      slug: 'a', name: 'A', country: 'X',
      dimensions: { ...makeCity({ slug: 'b', name: 'B', country: 'X' }).dimensions, career: { tech: 5, finance: 5, healthcare: 5, creative: 5, manufacturing: 5 } },
    });
    const c = scoreCity(city, withDefaults({ career_industry: null }));
    expect(c.contributions.find((x) => x.dimension === 'career')!.match).toBe(0.5);
  });

  it('education: divides city score by 5 when relevant', () => {
    const city = makeCity({
      slug: 'a', name: 'A', country: 'X',
      dimensions: { ...makeCity({ slug: 'b', name: 'B', country: 'X' }).dimensions, education: 4 },
    });
    const c = scoreCity(city, withDefaults({ education: 'important' }));
    expect(c.contributions.find((x) => x.dimension === 'education')!.match).toBeCloseTo(0.8, 5);
  });

  it('education: 0.5 neutral when "not_relevant"', () => {
    const city = makeCity({
      slug: 'a', name: 'A', country: 'X',
      dimensions: { ...makeCity({ slug: 'b', name: 'B', country: 'X' }).dimensions, education: 5 },
    });
    const c = scoreCity(city, withDefaults({ education: 'not_relevant' }));
    expect(c.contributions.find((x) => x.dimension === 'education')!.match).toBe(0.5);
  });

  it('healthcare: city score / 5', () => {
    const city = makeCity({
      slug: 'a', name: 'A', country: 'X',
      dimensions: { ...makeCity({ slug: 'b', name: 'B', country: 'X' }).dimensions, healthcare: 3 },
    });
    const c = scoreCity(city, withDefaults({ healthcare_importance: 2 }));
    expect(c.contributions.find((x) => x.dimension === 'healthcare')!.match).toBeCloseTo(0.6, 5);
  });

  it('community: max of city sub-scores over user tags, divided by 5', () => {
    const city = makeCity({
      slug: 'a', name: 'A', country: 'X',
      dimensions: {
        ...makeCity({ slug: 'b', name: 'B', country: 'X' }).dimensions,
        community: { urban: 4, suburban: 2, rural: 0, coastal: 5, mountain: 1, arts_culture: 3, family_oriented: 3, expat_friendly: 4 },
      },
    });
    const c = scoreCity(city, withDefaults({ lifestyle_tags: ['urban', 'coastal'] }));
    expect(c.contributions.find((x) => x.dimension === 'community')!.match).toBe(1.0);
  });

  it('community: 0.5 neutral when no tags chosen', () => {
    const city = makeCity({
      slug: 'a', name: 'A', country: 'X',
      dimensions: { ...makeCity({ slug: 'b', name: 'B', country: 'X' }).dimensions, community: { urban: 5, suburban: 5, rural: 0, coastal: 5, mountain: 5, arts_culture: 5, family_oriented: 5, expat_friendly: 5 } },
    });
    const c = scoreCity(city, withDefaults({ lifestyle_tags: [] }));
    expect(c.contributions.find((x) => x.dimension === 'community')!.match).toBe(0.5);
  });
});

describe('matching engine — weighting and normalization', () => {
  it('importance 0/1/2/3 maps to raw weight 0/0.5/1/2 for cost', () => {
    const city = makeCity({ slug: 'a', name: 'A', country: 'X' });
    for (const [imp, w] of [[0, 0], [1, 0.5], [2, 1], [3, 2]] as const) {
      const c = scoreCity(
        city,
        withDefaults({ cost_importance: imp as 0 | 1 | 2 | 3, cost_ceiling: 3 }),
      );
      expect(c.contributions.find((x) => x.dimension === 'cost')!.rawWeight).toBeCloseTo(w, 5);
    }
  });

  it('importance 0/1/2/3 maps to raw weight 0/0.5/1/2 for housing', () => {
    const city = makeCity({ slug: 'a', name: 'A', country: 'X' });
    for (const [imp, w] of [[0, 0], [1, 0.5], [2, 1], [3, 2]] as const) {
      const c = scoreCity(
        city,
        withDefaults({ housing_importance: imp as 0 | 1 | 2 | 3, housing_ceiling: 3 }),
      );
      expect(c.contributions.find((x) => x.dimension === 'housing')!.rawWeight).toBeCloseTo(w, 5);
    }
  });

  it('importance 0/1/2/3 maps to raw weight 0/0.5/1/2 for healthcare', () => {
    const city = makeCity({ slug: 'a', name: 'A', country: 'X' });
    for (const [imp, w] of [[0, 0], [1, 0.5], [2, 1], [3, 2]] as const) {
      const c = scoreCity(
        city,
        withDefaults({ healthcare_importance: imp as 0 | 1 | 2 | 3 }),
      );
      expect(
        c.contributions.find((x) => x.dimension === 'healthcare')!.rawWeight,
      ).toBeCloseTo(w, 5);
    }
  });

  it('climate raw weight is always 1', () => {
    const city = makeCity({ slug: 'a', name: 'A', country: 'X' });
    for (const climate of ['tropical', 'cold', 'no_preference'] as const) {
      const c = scoreCity(city, withDefaults({ climate }));
      expect(c.contributions.find((x) => x.dimension === 'climate')!.rawWeight).toBeCloseTo(1, 5);
    }
  });

  it('normalized weights preserve the raw weight ratios when other dimensions are also weighted in', () => {
    // With climate rawW=1, cost importance=3 → rawW=2, healthcare importance=1 → rawW=0.5
    // Total = 3.5, so cost is 2/3.5 ≈ 0.5714, climate 1/3.5 ≈ 0.2857, healthcare 0.5/3.5 ≈ 0.1429
    const city = makeCity({ slug: 'a', name: 'A', country: 'X' });
    const c = scoreCity(
      city,
      withDefaults({
        climate: 'temperate',
        cost_importance: 3,
        cost_ceiling: 3,
        healthcare_importance: 1,
      }),
    );
    expect(c.contributions.find((x) => x.dimension === 'cost')!.weight).toBeCloseTo(2 / 3.5, 5);
    expect(c.contributions.find((x) => x.dimension === 'climate')!.weight).toBeCloseTo(1 / 3.5, 5);
    expect(c.contributions.find((x) => x.dimension === 'healthcare')!.weight).toBeCloseTo(
      0.5 / 3.5,
      5,
    );
  });

  it('career weight is 0 when no industry picked, else 1', () => {
    const city = makeCity({ slug: 'a', name: 'A', country: 'X' });
    expect(
      scoreCity(city, withDefaults({ career_industry: null })).contributions.find(
        (x) => x.dimension === 'career',
      )!.weight,
    ).toBe(0);
    expect(
      scoreCity(city, withDefaults({ career_industry: 'tech' })).contributions.find(
        (x) => x.dimension === 'career',
      )!.weight,
    ).toBeGreaterThan(0);
  });

  it('education weight is 0 when "not_relevant", else 1', () => {
    const city = makeCity({ slug: 'a', name: 'A', country: 'X' });
    expect(
      scoreCity(city, withDefaults({ education: 'not_relevant' })).contributions.find(
        (x) => x.dimension === 'education',
      )!.weight,
    ).toBe(0);
    expect(
      scoreCity(city, withDefaults({ education: 'important' })).contributions.find(
        (x) => x.dimension === 'education',
      )!.weight,
    ).toBeGreaterThan(0);
  });

  it('weights of included dimensions sum to 1 after normalization', () => {
    const city = makeCity({ slug: 'a', name: 'A', country: 'X' });
    const c = scoreCity(
      city,
      withDefaults({
        climate: 'temperate',
        cost_importance: 3,
        cost_ceiling: 3,
        housing_importance: 3,
        housing_ceiling: 3,
        career_industry: 'tech',
        education: 'important',
        healthcare_importance: 3,
        lifestyle_tags: ['urban'],
      }),
    );
    const sum = c.contributions.reduce((acc, x) => acc + x.weight, 0);
    expect(sum).toBeCloseTo(1, 5);
  });

  it('excluded dimensions get weight 0 and contribute 0', () => {
    const city = makeCity({ slug: 'a', name: 'A', country: 'X' });
    const c = scoreCity(city, baseUser); // all skipped
    for (const d of SEVEN_DIMENSIONS) {
      const c2 = c.contributions.find((x) => x.dimension === d)!;
      if (d === 'climate') {
        // climate is always weight 1
        expect(c2.weight).toBeCloseTo(1, 5);
      } else {
        expect(c2.weight).toBe(0);
        expect(c2.contribution).toBe(0);
      }
    }
  });

  it('overall score is integer in [0, 100]', () => {
    const user = withDefaults({
      climate: 'mediterranean',
      cost_importance: 2,
      cost_ceiling: 3,
      housing_importance: 2,
      housing_ceiling: 3,
      career_industry: 'tech',
      education: 'important',
      healthcare_importance: 2,
      lifestyle_tags: ['urban', 'coastal'],
    });
    for (const city of CITIES) {
      const c = scoreCity(city, user);
      expect(Number.isInteger(c.score)).toBe(true);
      expect(c.score).toBeGreaterThanOrEqual(0);
      expect(c.score).toBeLessThanOrEqual(100);
    }
  });
});

describe('matching engine — determinism (PRD FR-6, AC-4)', () => {
  const user = withDefaults({
    climate: 'mediterranean',
    cost_importance: 2,
    cost_ceiling: 3,
    housing_importance: 2,
    housing_ceiling: 3,
    career_industry: 'tech',
    education: 'important',
    healthcare_importance: 2,
    lifestyle_tags: ['urban', 'coastal'],
  });

  it('rankCities is a pure function of its inputs', () => {
    const a = rankCities(user, CITIES);
    const b = rankCities(user, CITIES);
    expect(a.map((x) => x.city.slug)).toEqual(b.map((x) => x.city.slug));
    expect(a.map((x) => x.score)).toEqual(b.map((x) => x.score));
  });

  it('reordering the input does not change the output ordering', () => {
    const shuffled = [...CITIES].reverse();
    const r1 = rankCities(user, CITIES);
    const r2 = rankCities(user, shuffled);
    expect(r1.map((x) => x.city.slug)).toEqual(r2.map((x) => x.city.slug));
  });

  it('ties on score are broken by city name ascending', () => {
    const a = makeCity({ slug: 'a', name: 'Alpha', country: 'X' });
    const b = makeCity({ slug: 'b', name: 'Bravo', country: 'X' });
    const c = makeCity({ slug: 'c', name: 'Charlie', country: 'X' });
    // All dimensions equal, no user input → all should get 50.
    const r = rankCities(user, [b, c, a]);
    expect(r.map((x) => x.city.name)).toEqual(['Alpha', 'Bravo', 'Charlie']);
  });

  it('changing the user profile changes the ranking', () => {
    const u1 = withDefaults({ climate: 'tropical' });
    const u2 = withDefaults({ climate: 'cold' });
    const r1 = rankCities(u1, CITIES).map((x) => x.city.slug);
    const r2 = rankCities(u2, CITIES).map((x) => x.city.slug);
    // Tropical should put Bangkok first; Cold should put Reykjavik first.
    expect(r1[0]).toBe('bangkok-th');
    expect(r2[0]).toBe('reykjavik-is');
  });
});

describe('matching engine — topN (PRD AC-3)', () => {
  const user = withDefaults({});

  it('returns exactly 10 cities when input has ≥ 10', () => {
    const cities: City[] = Array.from({ length: 25 }, (_, i) =>
      makeCity({ slug: `c${i}`, name: `City ${i}`, country: 'X' }),
    );
    const r = rankCities(user, cities);
    expect(r).toHaveLength(10);
  });

  it('returns all cities when input has < 10', () => {
    const r = rankCities(user, CITIES.slice(0, 3));
    expect(r).toHaveLength(3);
  });

  it('default topN is 10', () => {
    const cities: City[] = Array.from({ length: 12 }, (_, i) =>
      makeCity({ slug: `c${i}`, name: `City ${i}`, country: 'X' }),
    );
    expect(rankCities(user, cities)).toHaveLength(10);
  });

  it('topN option overrides the default', () => {
    const cities: City[] = Array.from({ length: 12 }, (_, i) =>
      makeCity({ slug: `c${i}`, name: `City ${i}`, country: 'X' }),
    );
    expect(rankCities(user, cities, { topN: 3 })).toHaveLength(3);
    expect(rankCities(user, cities, { topN: 20 })).toHaveLength(12);
  });
});
