/**
 * Templated "why this fits you" generator (Architecture §6.5, PRD
 * v3.2.0 S11 / Acceptance-Criteria Feature 6).
 *
 * For each scored city, we look at the top 1–2 dimensions by contribution
 * (w_d' · m(c, d)). When two dimensions tie within 10% of each other we
 * emit both, joined with " and ".
 *
 * Templates (the i18n keys map to the documented copy):
 *   climate         | "Matches your {preference} climate preference"
 *   cost            | "Fits your housing and cost budget"
 *   housing         | "Fits your housing and cost budget"     (shared with cost)
 *   career          | "Strong {industry} job market"
 *   education       | "Strong schools and education options"
 *   healthcare      | "Strong healthcare access"
 *   community       | "Matches your {tag1, tag2} lifestyle"
 *   military_safety | "High geopolitical stability and physical safety"
 *
 * v0.4.0 addition (PRD v3.2.0 S11): every result now also emits
 * `why_key` and `why_vars` so the frontend can render the explanation
 * in the active locale (English or Simplified Chinese) without
 * re-running the matching engine. The legacy English `why` string is
 * still returned for back-compat / non-localised callers.
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
  rural: 'rural',
  coastal: 'coastal',
  mountain: 'mountain',
  arts_culture: 'arts & culture',
  family_oriented: 'family-oriented',
  expat_friendly: 'expat-friendly',
};

/**
 * Build the templated "why" payload for a scored city.
 *
 * Returns the English fallback (`why`), the i18n key (`whyKey`), and
 * the variables to interpolate (`whyVars`). The frontend's
 * `renderWhyTemplate` resolves the key via i18next for the active
 * locale.
 */
export interface WhyTemplate {
  why: string;
  whyKey: string;
  // `whyVars` is a flat string-indexed record for the primary
  // dimension, but in the tied-reason case (v0.4.x — Bug 4) it also
  // carries `secondary_key: string` and `secondary_vars: Record<...>`.
  // The `unknown` value type lets `secondary_vars` nest a record
  // without breaking the i18next interpolation contract.
  whyVars?: Record<string, unknown>;
}

export function buildWhyTemplate(scored: ScoredCity): WhyTemplate {
  // Only consider dimensions the user actually weighted in (rawW > 0).
  // For the special "user skipped everything" case we use a neutral line.
  const included = scored.contributions.filter(
    (c) => c.weight > 0 && (c.userValue === undefined || hasUserValue(c)),
  );

  if (included.length === 0) {
    return { why: 'A balanced match across all your priorities', whyKey: 'neutral' };
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

  // Single-dimension case — emit one template.
  if (topReasons.length === 1) {
    const tpl = templateFor(top);
    return tpl;
  }

  // Two-dimension case (v0.4.x — Bug 4).
  //
  // Wire shape (no English string is ever packed into `whyVars`):
  //   why:      "<pre-joined English>"         — legacy back-compat
  //   whyKey:   "<primary dimension key>"      — e.g. "climate"
  //   whyVars:  {
  //     ...primaryVars,
  //     secondary_key:  "<secondary dimension key>",   // e.g. "career"
  //     secondary_vars: { ...secondaryVars },          // e.g. { industry: "tech" }
  //   }
  //
  // The frontend `renderWhyTemplate()` (web/src/i18n/why.ts) translates
  // both halves via i18next and joins them with " and " (English) or
  // " 且 " (Chinese) based on the active language.
  const a = templateFor(topReasons[0]!);
  const b = templateFor(topReasons[1]!);
  const joined = `${a.why} and ${b.why}`;
  return {
    why: joined,
    whyKey: a.whyKey,
    whyVars: {
      ...(a.whyVars ?? {}),
      secondary_key: b.whyKey,
      secondary_vars: b.whyVars ?? {},
    },
  };
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
    case 'military_safety':
      return v.importance !== 0;
  }
}

function templateFor(c: PerDimensionContribution): WhyTemplate {
  const v = c.userValue ?? {};
  switch (c.dimension) {
    case 'climate': {
      const pref = CLIMATE_PRETTY[String(v.climate)] ?? String(v.climate);
      return {
        why: `Matches your ${pref} climate preference`,
        whyKey: 'climate',
        whyVars: { climate: pref },
      };
    }
    case 'cost':
    case 'housing':
      // Cost and housing share a template per the architecture.
      return { why: 'Fits your housing and cost budget', whyKey: 'cost' };
    case 'career': {
      const ind = INDUSTRY_PRETTY[String(v.industry)] ?? String(v.industry);
      return {
        why: `Strong ${ind} job market`,
        whyKey: 'career',
        whyVars: { industry: ind },
      };
    }
    case 'education':
      return { why: 'Strong schools and education options', whyKey: 'education' };
    case 'healthcare':
      return { why: 'Strong healthcare access', whyKey: 'healthcare' };
    case 'community': {
      const tags = (v.tags as LifestyleTag[] | undefined) ?? [];
      if (tags.length === 0) {
        return { why: 'Matches your lifestyle', whyKey: 'community' };
      }
      if (tags.length === 1) {
        const pretty = TAG_PRETTY[tags[0]!];
        return {
          why: `Matches your ${pretty} lifestyle`,
          whyKey: 'community',
          whyVars: { tags: pretty },
        };
      }
      const pretty = tags.slice(0, 2).map((t) => TAG_PRETTY[t]).join(' and ');
      return {
        why: `Matches your ${pretty} lifestyle`,
        whyKey: 'community',
        whyVars: { tags: pretty },
      };
    }
    case 'military_safety':
      return {
        why: 'High geopolitical stability and physical safety',
        whyKey: 'military_safety',
      };
  }
}

// Legacy export kept for back-compat with the test suite.
export function whyThisFitsYou(scored: ScoredCity): string {
  return buildWhyTemplate(scored).why;
}

// Re-export for tests
export { CLIMATE_LABEL_TO_PREFERENCE };