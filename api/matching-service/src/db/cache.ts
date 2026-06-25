/**
 * TTL cache wrapper for the city repository.
 *
 * Architecture §5.2 calls for a 60s in-memory TTL cache around
 * `GET /api/cities/:id` to absorb traffic spikes. We cache both
 * `listAll` and `findBySlug` because the matching endpoint always
 * loads the full city list.
 *
 * The cache is intentionally simple: a single `Map<key, {value, expiresAt}>`.
 * No eviction, no concurrency control — fine for the MVP which has
 * exactly one API process and < 100 cities.
 */
import type { City } from '@relocatewise/shared';
import type { CityRepository } from './repository.js';

export interface TtlCache {
  /** Currently cached TTL for `listAll`, or `null` if absent/expired. */
  listAll: { value: City[]; expiresAt: number } | null;
  /** Currently cached TTLs for individual slugs. */
  bySlug: Map<string, { value: City | null; expiresAt: number }>;
}

export class TtlCachedCityRepository implements CityRepository {
  public readonly cache: TtlCache = { listAll: null, bySlug: new Map() };

  constructor(
    private readonly upstream: CityRepository,
    private readonly ttlMs: number = 60_000,
  ) {}

  async listAll(): Promise<City[]> {
    const now = Date.now();
    if (this.cache.listAll && this.cache.listAll.expiresAt > now) {
      return this.cache.listAll.value;
    }
    const fresh = await this.upstream.listAll();
    this.cache.listAll = { value: fresh, expiresAt: now + this.ttlMs };
    return fresh;
  }

  async findBySlug(slug: string): Promise<City | null> {
    const now = Date.now();
    const cached = this.cache.bySlug.get(slug);
    if (cached && cached.expiresAt > now) {
      return cached.value;
    }
    const fresh = await this.upstream.findBySlug(slug);
    this.cache.bySlug.set(slug, { value: fresh, expiresAt: now + this.ttlMs });
    return fresh;
  }
}
