/**
 * Boot-time seed: if the `cities` table is empty, bulk-insert the
 * in-memory `SEED_CITIES` array. Idempotent — safe to call on every boot.
 *
 * Per Architecture §5.3 the data lives in git (`api/src/db/cities.seed.ts`
 * and its JSON mirror in `/db/seeds/cities.json`); the database is a
 * build artifact, not a source of truth. RPO = 0, RTO = re-run this.
 */
import type { Pool } from 'pg';
import type { City } from '@relocatewise/shared';
import { SEED_CITIES } from './cities.seed.js';

export interface SeedResult {
  inserted: boolean;
  cities: number;
}

export async function seedIfEmpty(pool: Pool): Promise<SeedResult> {
  const count = (await pool.query<{ n: number }>(`SELECT COUNT(*)::int AS n FROM cities`)).rows[0]!.n;
  if (count > 0) {
    return { inserted: false, cities: count };
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const city of SEED_CITIES) {
      await insertCity(client, city);
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  return { inserted: true, cities: SEED_CITIES.length };
}

async function insertCity(
  client: import('pg').PoolClient,
  city: City,
): Promise<void> {
  const cityRes = await client.query<{ id: number }>(
    `INSERT INTO cities (
       slug, name, country, country_code, region,
       lat, lng, geom, description, last_updated
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,ST_SetSRID(ST_MakePoint($8,$9),4326),$10,$11)
     RETURNING id`,
    [
      city.slug,
      city.name,
      city.country,
      city.country_code,
      city.region,
      city.lat,
      city.lng,
      city.lng,
      city.lat,
      city.description,
      city.last_updated,
    ],
  );
  const cityId = cityRes.rows[0]!.id;

  await client.query(
    `INSERT INTO city_scores (city_id, dimension, score, sub_scores) VALUES
       ($1, 'climate',    $2, $3::jsonb),
       ($1, 'cost',       $4, NULL),
       ($1, 'housing',    $5, NULL),
       ($1, 'career',     0, $6::jsonb),
       ($1, 'education',  $7, NULL),
       ($1, 'healthcare', $8, NULL),
       ($1, 'community',  0, $9::jsonb)`,
    [
      cityId,
      0, // climate score is not used by the matching engine; the label is
      JSON.stringify({ label: city.dimensions.climate.label }),
      city.dimensions.cost,
      city.dimensions.housing,
      JSON.stringify(city.dimensions.career),
      city.dimensions.education,
      city.dimensions.healthcare,
      JSON.stringify(city.dimensions.community),
    ],
  );
}

/**
 * CLI entrypoint: `npm run db:seed` (sets `DATABASE_URL` first).
 * Connects, runs migrations, then seeds.
 */
export async function runSeedCli(): Promise<void> {
  const { getPool, closePool } = await import('./pool.js');
  const { runMigrations } = await import('./migrate.js');
  const pool = getPool();
  const applied = await runMigrations(pool);
  if (applied.length > 0) {
    // eslint-disable-next-line no-console
    console.log(`Applied ${applied.length} migration(s): ${applied.join(', ')}`);
  }
  const result = await seedIfEmpty(pool);
  if (result.inserted) {
    // eslint-disable-next-line no-console
    console.log(`Seeded ${result.cities} cities.`);
  } else {
    // eslint-disable-next-line no-console
    console.log(`Database already has ${result.cities} cities; skipped seeding.`);
  }
  await closePool();
}

// Run when invoked directly: `tsx src/db/seed.ts`.
const invokedDirectly = import.meta.url === `file://${process.argv[1]}`;
if (invokedDirectly) {
  runSeedCli().catch((err: unknown) => {
    // eslint-disable-next-line no-console
    console.error('Seed failed:', err);
    process.exit(1);
  });
}
