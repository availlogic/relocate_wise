/**
 * Templated "why this fits you" generator (Architecture §6.5, CEO decision 3
 * in PRD §9: "Templated for MVP").
 *
 * For each scored city, we look at the top 1–2 dimensions by contribution
 * (w_d' · m(c, d)). When two dimensions tie within 10% of each other we
 * emit both, joined with " and ".
 *
 * Templates:
 *   climate    | "Matches your {preference} climate preference"
 *   cost       | "Fits your housing and cost budget"
 *   housing    | "Fits your housing and cost budget"     (shared with cost)
 *   career     | "Strong {industry} job market"
 *   education  | "Strong schools and education options"
 *   healthcare | "Strong healthcare access"
 *   community  | "Matches your {tag1, tag2} lifestyle"
 */
import { CLIMATE_LABEL_TO_PREFERENCE } from '@relocatewise/shared/climate';
import type { LifestyleTag } from '@relocatewise/shared';
import type { PerDimensionContribution, ScoredCity } from './score.js';

const TIE_THRESHOLD = 0.1; // 10% (Architecture §6.5)
const CLIMATE_PRETTY: Record<string, string> = {
  tropical: 'tropical',
  temperate: 'temperate',
  mediterranean: 'Mediterranean',
  continental: 'continental',
  cold: 'cold',
  arid: 'arid',
  no_preference: '',
};

const INDUSTRY_PRETTY: Record<string, string> = {
  tech: 'tech',
  finance: 'finance',
  healthcare: 'healthcare',
  creative: 'creative',
  manufacturing: 'manufacturing',
};

const TAG_PRETTY: Record<LifestyleTag, string> = {
  urban: 'urban',
  suburban: 'suburban',
  coastal: 'coastal',
  mountain: 'mountain',
  arts_culture: 'arts & culture',
  family_oriented: 'family-oriented',
  expat_friendly: 'expat-friendly',
};

/**
 * Format the top 1–2 contributing dimensions as a single human-readable
 * sentence. Always returns a non-empty string (AC-5: "non-empty 'why this
 * fits you' line that references at least one user-stated priority").
 */
export function whyThisFitsYou(scored: ScoredCity): string {
  // Only consider dimensions the user actually weighted in (rawW > 0).
  // For the special "user skipped everything" case we use a neutral line.
  const included = scored.contributions.filter(
    (c) => c.weight > 0 && (c.userValue === undefined || hasUserValue(c)),
  );

  if (included.length === 0) {
    return 'A balanced match across all your priorities';
  }

  // Rank by contribution descending; if two are within 10% of each other,
  // keep both.
  const sorted = [...included].sort((a, b) => b.contribution - a.contribution);
  const top = sorted[0]!;
  const second = sorted[1];

  let topReasons: PerDimensionContribution[] = [top];
  if (
    second &&
    second.contribution > 0 &&
    Math.abs(top.contribution - second.contribution) <= TIE_THRESHOLD
  ) {
    topReasons.push(second);
  }

  // Cap at 2 dimensions.
  topReasons = topReasons.slice(0, 2);

  const parts = topReasons.map(formatReason);
  if (parts.length === 1) return parts[0]!;
  return `${parts[0]} and ${parts[1]}`;
}

function hasUserValue(c: PerDimensionContribution): boolean {
  if (!c.userValue) return false;
  const v = c.userValue;
  switch (c.dimension) {
    case 'climate':
      return v.climate !== 'no_preference' && v.climate !== null;
    case 'cost':
      return v.importance !== 0;
    case 'housing':
      return v.importance !== 0;
    case 'career':
      return v.industry !== null && v.industry !== undefined;
    case 'education':
      return v.education !== 'not_relevant';
    case 'healthcare':
      return v.importance !== 0;
    case 'community':
      return Array.isArray(v.tags) && v.tags.length > 0;
  }
}

function formatReason(c: PerDimensionContribution): string {
  const v = c.userValue ?? {};
  switch (c.dimension) {
    case 'climate': {
      const pref = CLIMATE_PRETTY[String(v.climate)] ?? String(v.climate);
      return `Matches your ${pref} climate preference`;
    }
    case 'cost':
    case 'housing':
      // Cost and housing share a template per the architecture.
      return 'Fits your housing and cost budget';
    case 'career': {
      const ind = INDUSTRY_PRETTY[String(v.industry)] ?? String(v.industry);
      return `Strong ${ind} job market`;
    }
    case 'education':
      return 'Strong schools and education options';
    case 'healthcare':
      return 'Strong healthcare access';
    case 'community': {
      const tags = (v.tags as LifestyleTag[] | undefined) ?? [];
      if (tags.length === 0) return 'Matches your lifestyle';
      if (tags.length === 1) {
        return `Matches your ${TAG_PRETTY[tags[0]!]} lifestyle`;
      }
      const pretty = tags.slice(0, 2).map((t) => TAG_PRETTY[t]);
      return `Matches your ${pretty.join(' and ')} lifestyle`;
    }
  }
}

// Re-export for tests
export { CLIMATE_LABEL_TO_PREFERENCE };
