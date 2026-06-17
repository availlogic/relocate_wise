/**
 * Documented defaults applied to a UserProfile when the user skips a
 * question (PRD FR-3: "all questionnaire questions shall be skippable; the
 * system shall use a documented default weight for any skipped dimension").
 *
 * Keeping defaults in one file lets the matching engine stay pure and lets
 * the test suite pin them to specific values.
 */
import type { UserProfile } from '@relocatewise/shared';

/**
 * Build a fully-populated UserProfile by filling in documented defaults
 * for any field the user did not set. Pure function.
 */
export function withDefaults(profile: Partial<UserProfile>): UserProfile {
  return {
    climate: profile.climate ?? null,
    cost_importance: profile.cost_importance ?? 0,
    cost_ceiling: profile.cost_ceiling ?? null,
    housing_importance: profile.housing_importance ?? 0,
    housing_ceiling: profile.housing_ceiling ?? null,
    career_industry: profile.career_industry ?? null,
    education: profile.education ?? 'not_relevant',
    healthcare_importance: profile.healthcare_importance ?? 0,
    military_safety_importance: profile.military_safety_importance ?? 0,
    lifestyle_tags: profile.lifestyle_tags ?? [],
  };
}
