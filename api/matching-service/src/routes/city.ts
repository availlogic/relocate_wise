/**
 * `GET /api/cities` — list all cities (lightweight projection for the UI).
 * `GET /api/cities/:slug` — full city profile.
 *
 * The list endpoint returns `{ cities: City[] }` (slim summary fields only)
 * so the results page can render rank cards without downloading the
 * full per-dimension detail for every city.
 *
 * Returns 200 with the full City record, or 404 if the slug is unknown.
 */
import type { FastifyInstance } from 'fastify';
import type { City } from '@relocatewise/shared';
import type { CityRepository } from '../db/repository.js';

type CitySummary = Pick<
  City,
  'slug' | 'name' | 'country' | 'country_code' | 'region' | 'lat' | 'lng' | 'description'
>;

export function cityRoute(app: FastifyInstance, repo: CityRepository, prefix = ''): void {
  app.get(`${prefix}/cities`, async () => {
    const cities = await repo.listAll();
    const summary: CitySummary[] = cities.map((c) => ({
      slug: c.slug,
      name: c.name,
      country: c.country,
      country_code: c.country_code,
      region: c.region,
      lat: c.lat,
      lng: c.lng,
      description: c.description,
    }));
    return { cities: summary };
  });

  app.get<{ Params: { slug: string } }>(`${prefix}/cities/:slug`, async (req, reply) => {
    const { slug } = req.params;
    const city = await repo.findBySlug(slug);
    if (!city) {
      return reply.code(404).send({        error: 'city_not_found',
        message: `No city with slug "${slug}"`,
      });
    }
    return city;
  });
}
