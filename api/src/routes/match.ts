/**
 * `POST /api/match` — rank cities from a user profile.
 *
 * Body shape is the §6.1 contract (validated by `UserProfileSchema`).
 * Returns 200 with a `MatchResponse`, or 400 with an `ApiError` envelope
 * if validation fails.
 *
 * The matching engine is a pure function (no I/O), so we could run it
 * inline. We still go through the repository for `listAll` so the
 * TTL cache layer is exercised the same way it is in production.
 */
import type { FastifyInstance } from 'fastify';
import type { CityRepository } from '../db/repository.js';
import { UserProfileSchema } from '../schemas/profile.js';
import { withDefaults } from '../matching/defaults.js';
import { rankCities } from '../matching/score.js';
import { buildMatchResponse } from '../matching/result.js';

export function matchRoute(app: FastifyInstance, repo: CityRepository, prefix = ''): void {
  app.post(`${prefix}/match`, async (req, reply) => {
    const parsed = UserProfileSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: 'invalid_profile',
        message: 'The request body is not a valid UserProfile.',
        details: parsed.error.issues,
      });
    }
    const profile = withDefaults(parsed.data);
    const cities = await repo.listAll();
    const ranked = rankCities(profile, cities);
    return buildMatchResponse(ranked);
  });
}
