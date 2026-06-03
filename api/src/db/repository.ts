/**
 * City repository — the only thing in the API that talks to storage.
 *
 * The architecture document calls for a 60s in-memory TTL cache (Architecture
 * §5.2) and a Postgres + PostGIS backend. The repository interface is the
 * same whether the data comes from Postgres, a JSON file, or hard-coded
 * seeds; this keeps the matching engine and routes easily testable.
 *
 * `InMemoryCityRepository` is the default — it ships the 40-city seed and
 * is used in tests. `PostgresCityRepository` is provided as a sibling
 * implementation; production code chooses at boot via DATABASE_URL.
 */
import type { City } from '@relocatewise/shared';

export interface CityRepository {
  listAll(): Promise<City[]>;
  findBySlug(slug: string): Promise<City | null>;
}

/**
 * In-process repository, suitable for tests, local dev without Postgres,
 * and as a thin layer over Postgres in production. All data lives in
 * memory; mutations are not supported in the MVP.
 */
export class InMemoryCityRepository implements CityRepository {
  private readonly bySlug: Map<string, City>;

  constructor(cities: readonly City[]) {
    this.bySlug = new Map(cities.map((c) => [c.slug, c]));
  }

  async listAll(): Promise<City[]> {
    return [...this.bySlug.values()];
  }

  async findBySlug(slug: string): Promise<City | null> {
    return this.bySlug.get(slug) ?? null;
  }
}
