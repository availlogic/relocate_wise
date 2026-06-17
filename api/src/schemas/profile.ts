/**
 * Zod schema for the POST /api/match request body.
 *
 * This is the **wire contract** — the architecture document's §6.1 shape.
 * We treat every field as optional and let `withDefaults` fill in
 * documented defaults for any skipped question (PRD FR-3).
 */
import { z } from 'zod';

const climate = z.enum([
  'tropical',
  'temperate',
  'mediterranean',
  'continental',
  'cold',
  'arid',
  'no_preference',
]);

const education = z.enum(['important', 'somewhat', 'not_relevant']);

const industry = z.enum(['tech', 'finance', 'healthcare', 'creative', 'manufacturing']);

const lifestyleTag = z.enum([
  'urban',
  'suburban',
  'rural',
  'coastal',
  'mountain',
  'arts_culture',
  'family_oriented',
  'expat_friendly',
]);

const importance = z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]);
const ceiling = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]).nullable();

export const UserProfileSchema = z
  .object({
    climate: climate.optional(),
    cost_importance: importance.optional(),
    cost_ceiling: ceiling.optional(),
    housing_importance: importance.optional(),
    housing_ceiling: ceiling.optional(),
    career_industry: industry.nullable().optional(),
    education: education.optional(),
    healthcare_importance: importance.optional(),
    military_safety_importance: importance.optional(),
    lifestyle_tags: z.array(lifestyleTag).optional(),
  })
  .strict(); // reject unknown fields so we can spot client drift early

export type UserProfileInput = z.infer<typeof UserProfileSchema>;
