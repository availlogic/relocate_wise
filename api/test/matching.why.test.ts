/**
 * Tests for the templated "why this fits you" generator (Architecture §6.5).
 *
 * Verifies:
 *   - Returns a non-empty string (PRD AC-5).
 *   - References at least one user-stated priority.
 *   - Uses the documented templates per dimension.
 *   - When two dimensions tie within 10% of the top, both are emitted and
 *     joined with " and ".
 */
import { describe, it, expect } from 'vitest';
import { whyThisFitsYou } from '../src/matching/why.js';
import { rankCities, scoreCity } from '../src/matching/score.js';
import { withDefaults } from '../src/matching/defaults.js';
import { CITIES, makeCity } from './fixtures.js';
import type { UserProfile } from '@relocatewise/shared';

describe('why this fits you — templates per dimension', () => {
  const city = CITIES[0]!; // Lisbon

  it('climate template uses the user preference verbatim (pretty-printed)', () => {
    const user: UserProfile = withDefaults({ climate: 'mediterranean' });
    const scored = scoreCity(city, user);
    expect(whyThisFitsYou(scored)).toContain('Matches your Mediterranean climate preference');
  });

  it('cost / housing share a single template', () => {
    const user: UserProfile = withDefaults({
      cost_importance: 3,
      cost_ceiling: 5,
      housing_importance: 3,
      housing_ceiling: 5,
    });
    const scored = scoreCity(city, user);
    expect(whyThisFitsYou(scored)).toContain('Fits your housing and cost budget');
  });

  it('career template uses the chosen industry', () => {
    const user: UserProfile = withDefaults({ career_industry: 'tech' });
    const scored = scoreCity(city, user);
    expect(whyThisFitsYou(scored)).toContain('Strong tech job market');
  });

  it('education template', () => {
    const user: UserProfile = withDefaults({ education: 'important' });
    const scored = scoreCity(city, user);
    expect(whyThisFitsYou(scored)).toContain('Strong schools and education options');
  });

  it('healthcare template', () => {
    const user: UserProfile = withDefaults({ healthcare_importance: 3 });
    const scored = scoreCity(city, user);
    expect(whyThisFitsYou(scored)).toContain('Strong healthcare access');
  });

  it('community template lists 1 tag', () => {
    const user: UserProfile = withDefaults({ lifestyle_tags: ['urban'] });
    const scored = scoreCity(city, user);
    expect(whyThisFitsYou(scored)).toContain('Matches your urban lifestyle');
  });

  it('community template lists 2 tags joined with " and "', () => {
    const user: UserProfile = withDefaults({ lifestyle_tags: ['urban', 'coastal'] });
    const scored = scoreCity(city, user);
    expect(whyThisFitsYou(scored)).toContain('Matches your urban and coastal lifestyle');
  });

  it('military_safety template (Architecture §6.5, PRD v3.1.0)', () => {
    const user: UserProfile = withDefaults({ military_safety_importance: 3 });
    const scored = scoreCity(city, user);
    expect(whyThisFitsYou(scored)).toContain(
      'High geopolitical stability and physical safety',
    );
  });
});

describe('why this fits you — tie-breaking (within 0.1 absolute)', () => {
  it('emits a single dimension when the runner-up is far below the top', () => {
    // Set up: climate weight 1, match 1.0 → contribution 0.5.
    //         cost weight 2, city cost 5 with ceiling 2 → match 0 (above ceiling).
    // After normalization: climate weight = 1/3, cost weight = 2/3.
    //   climate contribution = 1/3 * 1.0 = 0.333
    //   cost contribution    = 2/3 * 0.0 = 0
    // Gap is 0.333 — well over 0.1 — so only climate should appear.
    const city = makeCity({
      slug: 'x', name: 'X', country: 'X',
      dimensions: { ...makeCity({ slug: 'y', name: 'Y', country: 'X' }).dimensions, climate: { label: 'Mediterranean' }, cost: 5 },
    });
    const user: UserProfile = withDefaults({
      climate: 'mediterranean',
      cost_importance: 3,
      cost_ceiling: 2,
    });
    const scored = scoreCity(city, user);
    const why = whyThisFitsYou(scored);
    expect(why).toContain('Matches your Mediterranean climate preference');
    expect(why).not.toContain('Fits your housing and cost budget');
  });

  it('emits two dimensions joined with " and " when contributions tie within 0.1', () => {
    // Set up: climate weight 1, match 1.0; cost weight 2, city cost 1, ceiling 5
    // (match 1.0). After normalization: climate weight 1/3, cost weight 2/3.
    //   climate contribution = 1/3 * 1.0 = 0.333
    //   cost contribution    = 2/3 * 1.0 = 0.667
    //   gap = 0.333  — over 0.1. So actually NOT a tie. Let me use weights
    //   that produce a tighter gap.
    // Set cost_importance=1 → raw weight 0.5, so total = 1.5.
    //   climate weight = 1/1.5 ≈ 0.667, contribution 0.667
    //   cost weight    = 0.5/1.5 ≈ 0.333, contribution 0.333
    //   gap = 0.333  — still over 0.1.
    // For a real tie I need equal weights and equal matches. Both climate
    // and cost match 1.0, with equal weights → tied. Set climate=mediterranean
    // (always rawW 1) and career=tech (rawW 1, match 1.0). Total rawW = 2,
    // each gets 0.5, each contributes 0.5. Gap = 0. Tie.
    const city = makeCity({
      slug: 'x', name: 'X', country: 'X',
      dimensions: {
        ...makeCity({ slug: 'y', name: 'Y', country: 'X' }).dimensions,
        climate: { label: 'Mediterranean' },
        career: { tech: 5, finance: 1, healthcare: 1, creative: 1, manufacturing: 1 },
      },
    });
    const user: UserProfile = withDefaults({
      climate: 'mediterranean',
      career_industry: 'tech',
    });
    const scored = scoreCity(city, user);
    const why = whyThisFitsYou(scored);
    expect(why).toContain('Matches your Mediterranean climate preference');
    expect(why).toContain('Strong tech job market');
    expect(why).toMatch(/ and /);
  });

  it('emits a single dimension when the second-best is just outside the 0.1 tie window', () => {
    // climate=mediterranean, rawW 1, match 1.0 → contribution 0.5
    // career=tech, rawW 1, match 4/5 = 0.8 → contribution 0.4
    // gap = 0.1  — right at the boundary. With Math.abs <= 0.1 this ties.
    // Now set career match to 3/5 = 0.6 → contribution 0.3, gap = 0.2. No tie.
    const city = makeCity({
      slug: 'x', name: 'X', country: 'X',
      dimensions: {
        ...makeCity({ slug: 'y', name: 'Y', country: 'X' }).dimensions,
        climate: { label: 'Mediterranean' },
        career: { tech: 3, finance: 1, healthcare: 1, creative: 1, manufacturing: 1 },
      },
    });
    const user: UserProfile = withDefaults({
      climate: 'mediterranean',
      career_industry: 'tech',
    });
    const scored = scoreCity(city, user);
    const why = whyThisFitsYou(scored);
    expect(why).toContain('Matches your Mediterranean climate preference');
    expect(why).not.toContain('Strong tech job market');
  });
});

describe('why this fits you — non-empty guarantee (PRD AC-5)', () => {
  it('returns a non-empty string for the canonical "all skipped" profile', () => {
    const user: UserProfile = withDefaults({});
    for (const city of CITIES) {
      const scored = scoreCity(city, user);
      const why = whyThisFitsYou(scored);
      expect(typeof why).toBe('string');
      expect(why.length).toBeGreaterThan(0);
    }
  });

  it('emits at least one user-stated priority when at least one is set', () => {
    const user: UserProfile = withDefaults({
      climate: 'mediterranean',
      career_industry: 'tech',
      lifestyle_tags: ['urban', 'coastal'],
    });
    const top = rankCities(user, CITIES)[0]!;
    const why = whyThisFitsYou(top);
    // It should mention at least one of: climate/career/community.
    const mentions =
      why.includes('climate') ||
      why.includes('tech job market') ||
      why.includes('lifestyle');
    expect(mentions).toBe(true);
  });
});
