/**
 * `PUT /api/internal/cities/:slug/scores` — internal sync endpoint
 * (Architecture §4.4, API_Spec §2.5, Database §5, AC Feature 8).
 *
 * The Data Ingestion Service calls this endpoint to push newly
 * compiled 1-5 dimension scores into the Matching Service. The route
 * is gated by a bearer token (the same `API_SECRET` env var that
 * already protects the public surface) and is intentionally NOT
 * exposed publicly — Phase B will move it behind the API Gateway,
 * which will reject `/api/internal/*` requests arriving on the public
 * ingress. For now (Phase C), the bearer is the only line of defence.
 *
 * Body shape is validated by `InternalScoresUpdateSchema`
 * (`api/src/schemas/internal.ts`). On success the route:
 *   1. UPSERTs every supplied dimension into `matching.city_scores`
 *      with the new score (and an optional sub_scores JSONB blob).
 *   2. Updates `matching.cities.last_updated = CURRENT_DATE`.
 *
 * The transaction is atomic per slug: either all supplied dimensions
 * are persisted and the last_updated bump happens, or the whole call
 * rolls back and the route returns a 5xx.
 *
 * Errors:
 *   - 400 on body validation failure (Zod rejection).
 *   - 401 on missing or invalid bearer token.
 *   - 404 on an unknown slug.
 *   - 200 on success with `{ success: true, message }`.
 */
import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import { InternalScoresUpdateSchema } from '../schemas/internal.js';

/**
 * Pull the bearer token from the `Authorization` header. The expected
 * shape is `Authorization: Bearer <secret>`; case-insensitive scheme,
 * case-sensitive token (matches API_Spec §2.5).
 */
function extractBearer(header: string | string[] | undefined): string | null {
  if (!header || typeof header !== 'string') return null;
  const trimmed = header.trim();
  if (!trimmed.toLowerCase().startsWith('bearer ')) return null;
  return trimmed.slice('bearer '.length).trim();
}

export interface InternalRouteDeps {
  /** Matching-service pool (R/W on `matching.*`). */
  pool: Pool;
  /**
   * Bearer token expected in the `Authorization` header. When unset
   * the route rejects all requests with 401 — defence-in-depth so a
   * missing env var cannot accidentally expose the internal surface.
   */
  expectedToken: string | undefined;
}

export function internalRoute(
  app: FastifyInstance,
  deps: InternalRouteDeps,
  prefix = '',
): void {
  app.put<{ Params: { slug: string }; Body: unknown }>(
    `${prefix}/internal/cities/:slug/scores`,
    {
      // Pre-validation hook: reject early with a 401 envelope if the
      // bearer token is missing or doesn't match. Keeps the contract
      // identical to ITC-10.
      preHandler: async (req, reply) => {
        const provided = extractBearer(req.headers.authorization);
        const expected = deps.expectedToken;
        if (!expected) {
          return reply.code(503).send({
            error: 'internal_disabled',
            message: 'Internal sync endpoint is not configured on this server.',
          });
        }
        if (!provided || provided !== expected) {
          return reply.code(401).send({
            error: 'unauthorized',
            message: 'Missing or invalid bearer token.',
          });
        }
      },
    },
    async (req, reply) => {
      const { slug } = req.params;
      const parsed = InternalScoresUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({
          error: 'invalid_dimensions',
          message: 'The request body is not a valid InternalScoresUpdate.',
          details: parsed.error.issues,
        });
      }

      // Find the city id; 404 when the slug is unknown (API_Spec §2.5
      // step 4).
      const idRes = await deps.pool.query<{ id: number }>(
        `SELECT id FROM matching.cities WHERE slug = $1 LIMIT 1`,
        [slug],
      );
      if (idRes.rowCount === 0) {
        return reply.code(404).send({
          error: 'city_not_found',
          message: `No city with slug "${slug}"`,
        });
      }
      const cityId = idRes.rows[0]!.id;

      const { dimensions } = parsed.data;
      const client = await deps.pool.connect();
      try {
        await client.query('BEGIN');

        // Each UPSERT is keyed by (city_id, dimension) and writes the
        // new score + the dimension-specific sub_scores JSONB blob.
        // On conflict we replace both fields so a re-ingestion cleanly
        // overwrites stale data.
        const upserts: ReadonlyArray<{
          dimension: string;
          score: number;
          subScores: Record<string, unknown> | null;
        }> = [
          ...(dimensions.climate
            ? [
                {
                  dimension: 'climate',
                  score: 0, // matching engine reads the label, not the numeric score
                  subScores: { label: dimensions.climate.label },
                },
              ]
            : []),
          ...(dimensions.cost !== undefined
            ? [{ dimension: 'cost', score: dimensions.cost, subScores: null }]
            : []),
          ...(dimensions.housing !== undefined
            ? [
                {
                  dimension: 'housing',
                  score: dimensions.housing,
                  subScores: null,
                },
              ]
            : []),
          ...(dimensions.career
            ? [
                {
                  dimension: 'career',
                  score: 0,
                  subScores: dimensions.career as unknown as Record<string, unknown>,
                },
              ]
            : []),
          ...(dimensions.education !== undefined
            ? [
                {
                  dimension: 'education',
                  score: dimensions.education,
                  subScores: null,
                },
              ]
            : []),
          ...(dimensions.healthcare !== undefined
            ? [
                {
                  dimension: 'healthcare',
                  score: dimensions.healthcare,
                  subScores: null,
                },
              ]
            : []),
          ...(dimensions.community
            ? [
                {
                  dimension: 'community',
                  score: 0,
                  subScores: dimensions.community as unknown as Record<string, unknown>,
                },
              ]
            : []),
          ...(dimensions.military_safety !== undefined
            ? [
                {
                  dimension: 'military_safety',
                  score: dimensions.military_safety,
                  subScores: null,
                },
              ]
            : []),
        ];

        for (const u of upserts) {
          await client.query(
            `INSERT INTO matching.city_scores (city_id, dimension, score, sub_scores)
             VALUES ($1, $2, $3, $4::jsonb)
             ON CONFLICT (city_id, dimension) DO UPDATE
               SET score = EXCLUDED.score,
                   sub_scores = EXCLUDED.sub_scores`,
            [cityId, u.dimension, u.score, u.subScores ? JSON.stringify(u.subScores) : null],
          );
        }

        // Per Database §5, the last_updated bump is the matching
        // service's responsibility — never done by the ingestion role.
        await client.query(
          `UPDATE matching.cities SET last_updated = CURRENT_DATE WHERE id = $1`,
          [cityId],
        );

        await client.query('COMMIT');

        return reply.code(200).send({
          success: true,
          message: `Scores updated for city ${slug}`,
          dimensions: upserts.map((u) => u.dimension),
        });
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    },
  );
}