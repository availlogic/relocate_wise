/**
 * Zod schema for `PUT /api/internal/cities/:slug/scores` (Architecture
 * §4.4, API_Spec §2.5, Database §5).
 *
 * This is the **internal sync contract** between the Data Ingestion
 * Service and the Matching Service. The route is gated by a bearer
 * token (see `api/src/routes/internal.ts`); cross-schema writes from
 * the matching service are impossible because the database role
 * grants SELECT-only on `ingestion.*` and R/W on `matching.*`.
 *
 * Each dimension carries:
 *   - `score`       : 0..5 integer (matches the DB CHECK constraint).
 *   - `sub_scores`  : optional JSONB blob (string-keyed object).
 *   - `label`       : only meaningful for `climate`; ignored otherwise.
 *
 * Sub-scores carry the documented shape per Database §3:
 *   - `climate.label`         : canonical CityClimateLabel string.
 *   - `career`                : { tech, finance, healthcare, creative, manufacturing }.
 *   - `community`             : { urban, suburban, rural, coastal, mountain, arts_culture, family_oriented, expat_friendly }.
 *   - `military_safety`       : { conflict_risk, travel_advisory }.
 */
import { z } from 'zod';

const cityClimateLabel = z.enum([
  'Tropical',
  'Temperate',
  'Mediterranean',
  'Continental',
  'Cold',
  'Arid',
  'Highland',
]);

const climateDimension = z
  .object({
    label: cityClimateLabel,
  })
  .strict();

const score0to5 = z.number().int().min(0).max(5);

const careerDimension = z
  .object({
    tech: score0to5,
    finance: score0to5,
    healthcare: score0to5,
    creative: score0to5,
    manufacturing: score0to5,
  })
  .strict();

const communityDimension = z
  .object({
    urban: score0to5,
    suburban: score0to5,
    rural: score0to5,
    coastal: score0to5,
    mountain: score0to5,
    arts_culture: score0to5,
    family_oriented: score0to5,
    expat_friendly: score0to5,
  })
  .strict();

const militarySafetyDimension = z
  .object({
    score: score0to5,
    sub_scores: z
      .object({
        conflict_risk: z.enum(['low', 'moderate', 'elevated', 'high', 'severe']),
        travel_advisory: z.string().min(1).max(64),
      })
      .strict()
      .optional(),
  })
  .strict();

/**
 * Body of `PUT /api/internal/cities/:slug/scores`. At least one
 * dimension must be present — an empty body would be a no-op request
 * and is rejected with a 400 to surface client drift early.
 */
export const InternalScoresUpdateSchema = z
  .object({
    dimensions: z
      .object({
        climate: climateDimension.optional(),
        cost: score0to5.optional(),
        housing: score0to5.optional(),
        career: careerDimension.optional(),
        education: score0to5.optional(),
        healthcare: score0to5.optional(),
        community: communityDimension.optional(),
        military_safety: score0to5.optional(),
      })
      .strict()
      .refine(
        (d) => Object.values(d).some((v) => v !== undefined),
        { message: 'At least one dimension must be supplied.' },
      ),
  })
  .strict();

export type InternalScoresUpdateInput = z.infer<typeof InternalScoresUpdateSchema>;

/**
 * Lightweight wrapper used by the ingestion service. The matching
 * service's full schema accepts rich sub_scores per dimension; the
 * ingestion writer only sends `score` + an opaque JSONB blob (which
 * the matching service stores verbatim). This keeps the wire shape
 * forward-compatible: a future sub-score can be added without a new
 * Zod schema on either side.
 */
export const ScoresWriterPayloadSchema = z
  .object({
    dimensions: z.record(z.union([z.number(), z.record(z.unknown())])),
  })
  .strict();

export type ScoresWriterPayload = z.infer<typeof ScoresWriterPayloadSchema>;
// Re-export so the route module can validate the rich schema AND the
// ingestion service can validate the simpler payload.
export { militarySafetyDimension };