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
    rural: num('rural', 0),
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
  const militarySafety = byDim.get('military_safety')?.score ?? 3;
  const militarySafetySub = asMilitarySafetySub(
    byDim.get('military_safety')?.sub_scores ?? null,
  );

  const dimensions: CityDimensions = {
    climate,
    cost,
    housing,
    career,
    education,
    healthcare,
    community,
    military_safety: militarySafety,
    ...(militarySafetySub ? { military_safety_sub: militarySafetySub } : {}),
  };

  // Static image URLs are sourced from the seed (Architecture §5.2:
  // the static dataset is the source of truth for non-dynamic fields).
  // The seed carries `landmark_image_url` and `flag_image_url` per
  // city; the DB only stores the dynamic dimension scores.
  const flagUrl = `/flags/${city.country_code.toLowerCase()}.svg`;
  const landmarkUrl = LANDMARK_BY_SLUG.get(city.slug) ?? PLACEHOLDER_LANDMARK;

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
    flag_image_url: flagUrl,
    landmark_image_url: landmarkUrl,
    dimensions,
  };
}

/**
 * Curated landmark URLs keyed by city slug. The DB stores dynamic
 * scores only; the static landmark image (a public-domain Wikimedia
 * Commons thumbnail) is sourced from this map. New cities must add
 * an entry here AND in `cities.seed.ts`; the build-time drift check
 * (`cities.seed-sync.test.ts`) catches any mismatch.
 */
const LANDMARK_BY_SLUG = new Map<string, string>([
  ['new-york-us', 'https://commons.wikimedia.org/wiki/Special:FilePath/New_York_City_at_night_HDR.jpg'],
  ['austin-us', 'https://commons.wikimedia.org/wiki/Special:FilePath/Congress_Avenue_Bridge_Bats.jpg'],
  ['toronto-ca', 'https://commons.wikimedia.org/wiki/Special:FilePath/Toronto_-_ON_-_CN_Tower.jpg'],
  ['vancouver-ca', 'https://commons.wikimedia.org/wiki/Special:FilePath/Vancouver_skyline_at_night.jpg'],
  ['san-francisco-us', 'https://commons.wikimedia.org/wiki/Special:FilePath/Golden_Gate_Bridge_from_Battery_Spencer.jpg'],
  ['seattle-us', 'https://commons.wikimedia.org/wiki/Special:FilePath/Seattle_Skyline_(49875804988).jpg'],
  ['boston-us', 'https://commons.wikimedia.org/wiki/Special:FilePath/Boston_Skyline_at_Twilight.jpg'],
  ['chicago-us', 'https://commons.wikimedia.org/wiki/Special:FilePath/Chicago_Skyline_at_Sunset.jpg'],
  ['denver-us', 'https://commons.wikimedia.org/wiki/Special:FilePath/Denver_Skyline_at_Dusk.jpg'],
  ['miami-us', 'https://commons.wikimedia.org/wiki/Special:FilePath/Miami_Skyline_at_Dusk_Panorama.jpg'],
  ['portland-us', 'https://commons.wikimedia.org/wiki/Special:FilePath/Portland_Skyline_at_Dusk.jpg'],
  ['montreal-ca', 'https://commons.wikimedia.org/wiki/Special:FilePath/Montreal_skyline_at_dusk.jpg'],
  ['mexico-city-mx', 'https://commons.wikimedia.org/wiki/Special:FilePath/Mexico_City_at_dusk.jpg'],
  ['los-angeles-us', 'https://commons.wikimedia.org/wiki/Special:FilePath/Los_Angeles_Skyline_at_Dusk.jpg'],
  ['atlanta-us', 'https://commons.wikimedia.org/wiki/Special:FilePath/Atlanta_Skyline_at_Night.jpg'],
  ['lisbon-pt', 'https://commons.wikimedia.org/wiki/Special:FilePath/Lisbon_(36831531576).jpg'],
  ['porto-pt', 'https://commons.wikimedia.org/wiki/Special:FilePath/Porto_(36751735360).jpg'],
  ['barcelona-es', 'https://commons.wikimedia.org/wiki/Special:FilePath/Barcelona_-_Sagrada_Fam%C3%ADlia_at_sunrise.jpg'],
  ['madrid-es', 'https://commons.wikimedia.org/wiki/Special:FilePath/Madrid_Skyline_(36199480953).jpg'],
  ['paris-fr', 'https://commons.wikimedia.org/wiki/Special:FilePath/Paris_-_Eiffelturm_und_Trocad%C3%A9ro_bei_Nacht.jpg'],
  ['amsterdam-nl', 'https://commons.wikimedia.org/wiki/Special:FilePath/Amsterdam_Canals_at_Sunset.jpg'],
  ['berlin-de', 'https://commons.wikimedia.org/wiki/Special:FilePath/Berlin_Fernsehturm_at_Sunset.jpg'],
  ['zurich-ch', 'https://commons.wikimedia.org/wiki/Special:FilePath/Zurich_Skyline_at_Sunset.jpg'],
  ['prague-cz', 'https://commons.wikimedia.org/wiki/Special:FilePath/Prague_Bridge_at_Dawn.jpg'],
  ['london-uk', 'https://commons.wikimedia.org/wiki/Special:FilePath/London_Skyline_at_Dusk.jpg'],
  ['tokyo-jp', 'https://commons.wikimedia.org/wiki/Special:FilePath/Tokyo_Skyline_at_Sunset.jpg'],
  ['seoul-kr', 'https://commons.wikimedia.org/wiki/Special:FilePath/Seoul_Skyline_at_Night.jpg'],
  ['sydney-au', 'https://commons.wikimedia.org/wiki/Special:FilePath/Sydney_Opera_House_and_Harbour_Bridge_at_Dusk.jpg'],
  ['singapore-sg', 'https://commons.wikimedia.org/wiki/Special:FilePath/Singapore_Skyline_at_Dusk.jpg'],
  ['bangkok-th', 'https://commons.wikimedia.org/wiki/Special:FilePath/Bangkok_Skyline_at_Dusk.jpg'],
  ['buenos-aires-ar', 'https://commons.wikimedia.org/wiki/Special:FilePath/Buenos_Aires_Skyline_at_Dusk.jpg'],
  ['santiago-cl', 'https://commons.wikimedia.org/wiki/Special:FilePath/Santiago_de_Chile_skyline_at_dusk.jpg'],
  ['lima-pe', 'https://commons.wikimedia.org/wiki/Special:FilePath/Lima_skyline_at_dusk.jpg'],
  ['sao-paulo-br', 'https://commons.wikimedia.org/wiki/Special:FilePath/S%C3%A3o_Paulo_skyline_at_dusk.jpg'],
  ['medellin-co', 'https://commons.wikimedia.org/wiki/Special:FilePath/Medell%C3%ADn_skyline_at_dusk.jpg'],
  ['cape-town-za', 'https://commons.wikimedia.org/wiki/Special:FilePath/Cape_Town_and_Table_Mountain.jpg'],
  ['dubai-ae', 'https://commons.wikimedia.org/wiki/Special:FilePath/Dubai_Skyline_at_Night_(Pexels_4393660).jpg'],
  ['tel-aviv-il', 'https://commons.wikimedia.org/wiki/Special:FilePath/Tel_Aviv_skyline_at_dusk.jpg'],
  ['istanbul-tr', 'https://commons.wikimedia.org/wiki/Special:FilePath/Istanbul_skyline_at_dusk.jpg'],
  ['casablanca-ma', 'https://commons.wikimedia.org/wiki/Special:FilePath/Hassan_II_Mosque_at_Casablanca.jpg'],
]);

/** Fallback landmark when a slug is unknown (1x1 transparent png). */
const PLACEHOLDER_LANDMARK =
  'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxNiA5Ij48cmVjdCB3aWR0aD0iMTYiIGhlaWdodD0iOSIgZmlsbD0iIzFhMWEyYSIvPjwvc3ZnPg==';

const CONFLICT_RISK_VALUES: ReadonlySet<string> = new Set([
  'low',
  'moderate',
  'elevated',
  'high',
  'severe',
]);

function asMilitarySafetySub(
  sub: Record<string, number | string> | null,
): { conflict_risk: 'low' | 'moderate' | 'elevated' | 'high' | 'severe'; travel_advisory: string } | null {
  if (!sub) return null;
  const risk = String(sub.conflict_risk ?? '').toLowerCase();
  const advisory = String(sub.travel_advisory ?? '').toLowerCase();
  if (!CONFLICT_RISK_VALUES.has(risk)) return null;
  if (!advisory) return null;
  return {
    conflict_risk: risk as 'low' | 'moderate' | 'elevated' | 'high' | 'severe',
    travel_advisory: advisory,
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
