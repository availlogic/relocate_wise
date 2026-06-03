/**
 * Postgres + PostGIS implementation of the CityRepository interface.
 *
 * The schema (Architecture §5.1) normalizes the data into a `cities` table
 * (one row per city) and a `city_scores` table (one row per dimension).
 * A single SQL query joins them and rehydrates the `City` shape the
 * matching engine and the rest of the API consume.
 *
 * The repo is read-only on the MVP: writes happen once at boot via
 * `seedIfEmpty()` (see ../db/seed.ts). Mutations are intentionally not
 * supported.
 */
import type { Pool, PoolClient } from 'pg';
import type {
  City,
  CityCareerSub,
  CityClimateSub,
  CityCommunitySub,
  CityDimensions,
  CityClimateLabel,
} from '@relocatewise/shared';
import type { CityRepository } from './repository.js';

interface CityRow {
  id: number;
  slug: string;
  name: string;
  country: string;
  country_code: string;
  region: string;
  lat: number;
  lng: number;
  description: string;
  last_updated: Date | string;
}

interface ScoreRow {
  city_id: number;
  dimension: string;
  score: number;
  sub_scores: Record<string, number | string> | null;
}

const CLIMATE_LABELS: ReadonlySet<string> = new Set([
  'Tropical',
  'Temperate',
  'Mediterranean',
  'Continental',
  'Cold',
  'Arid',
  'Highland',
]);

function asClimateSub(sub: Record<string, number | string> | null): CityClimateSub {
  if (!sub) {
    return { label: 'Temperate' };
  }
  const label = String(sub.label ?? 'Temperate');
  return { label: (CLIMATE_LABELS.has(label) ? label : 'Temperate') as CityClimateLabel };
}

function asCareerSub(sub: Record<string, number | string> | null): CityCareerSub {
  const num = (k: string, fallback: number) =>
    typeof sub?.[k] === 'number' ? (sub[k] as number) : fallback;
  return {
    tech: num('tech', 0),
    finance: num('finance', 0),
    healthcare: num('healthcare', 0),
    creative: num('creative', 0),
    manufacturing: num('manufacturing', 0),
  };
}

function asCommunitySub(sub: Record<string, number | string> | null): CityCommunitySub {
  const num = (k: string, fallback: number) =>
    typeof sub?.[k] === 'number' ? (sub[k] as number) : fallback;
  return {
    urban: num('urban', 0),
    suburban: num('suburban', 0),
    coastal: num('coastal', 0),
    mountain: num('mountain', 0),
    arts_culture: num('arts_culture', 0),
    family_oriented: num('family_oriented', 0),
    expat_friendly: num('expat_friendly', 0),
  };
}

function toIsoDate(d: Date | string): string {
  if (typeof d === 'string') return d.slice(0, 10);
  return d.toISOString().slice(0, 10);
}

function joinCityAndScores(city: CityRow, scores: ScoreRow[]): City {
  const byDim = new Map(scores.map((s) => [s.dimension, s]));
  const climate = asClimateSub(byDim.get('climate')?.sub_scores ?? null);
  const cost = byDim.get('cost')?.score ?? 3;
  const housing = byDim.get('housing')?.score ?? 3;
  const career = asCareerSub(byDim.get('career')?.sub_scores ?? null);
  const education = byDim.get('education')?.score ?? 3;
  const healthcare = byDim.get('healthcare')?.score ?? 3;
  const community = asCommunitySub(byDim.get('community')?.sub_scores ?? null);

  const dimensions: CityDimensions = {
    climate,
    cost,
    housing,
    career,
    education,
    healthcare,
    community,
  };

  return {
    slug: city.slug,
    name: city.name,
    country: city.country,
    country_code: city.country_code,
    region: city.region,
    lat: city.lat,
    lng: city.lng,
    description: city.description,
    last_updated: toIsoDate(city.last_updated),
    dimensions,
  };
}

export class PostgresCityRepository implements CityRepository {
  constructor(private readonly pool: Pool) {}

  async listAll(): Promise<City[]> {
    const citiesRes = await this.pool.query<CityRow>(
      `SELECT id, slug, name, country, country_code, region, lat, lng,
              description, last_updated
         FROM cities
         ORDER BY name ASC`,
    );
    if (citiesRes.rowCount === 0) return [];
    const ids = citiesRes.rows.map((r) => r.id);
    const scoresRes = await this.pool.query<ScoreRow>(
      `SELECT city_id, dimension, score, sub_scores
         FROM city_scores
         WHERE city_id = ANY($1::int[])`,
      [ids],
    );
    const scoresByCity = new Map<number, ScoreRow[]>();
    for (const s of scoresRes.rows) {
      const arr = scoresByCity.get(s.city_id) ?? [];
      arr.push(s);
      scoresByCity.set(s.city_id, arr);
    }
    return citiesRes.rows.map((c) =>
      joinCityAndScores(c, scoresByCity.get(c.id) ?? []),
    );
  }

  async findBySlug(slug: string): Promise<City | null> {
    const cityRes = await this.pool.query<CityRow>(
      `SELECT id, slug, name, country, country_code, region, lat, lng,
              description, last_updated
         FROM cities
         WHERE slug = $1
         LIMIT 1`,
      [slug],
    );
    if (cityRes.rowCount === 0) return null;
    const city = cityRes.rows[0]!;
    const scoresRes = await this.pool.query<ScoreRow>(
      `SELECT city_id, dimension, score, sub_scores
         FROM city_scores
         WHERE city_id = $1`,
      [city.id],
    );
    return joinCityAndScores(city, scoresRes.rows);
  }

  /** Test/maintenance helper: wipe and re-seed in one transaction. */
  async truncateAll(client?: PoolClient): Promise<void> {
    const c = client ?? (await this.pool.connect());
    try {
      await c.query('TRUNCATE city_scores, cities RESTART IDENTITY CASCADE');
    } finally {
      if (client === undefined) c.release();
    }
  }
}
