-- RelocateWise initial schema (Architecture §5.1, Database §3.1, v1.0.0 GA).
--
-- Run with: psql "$DATABASE_URL" -f db/migrations/001_init.sql
-- The `api` container also runs this on first boot via `npm run db:migrate`
-- (see api/src/db/migrate.ts). Both paths are idempotent.
--
-- As of Phase A (v1.0.0 GA) every table lives in the `matching` schema.
-- The schema itself is created by `003_schemas.sql` which runs after this
-- file. To keep a fresh install fully segregated on first boot, this
-- migration creates the matching schema too (the second `CREATE SCHEMA`
-- in `003_schemas.sql` is a no-op).

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE SCHEMA IF NOT EXISTS matching;

CREATE TABLE IF NOT EXISTS matching.cities (
  id            SERIAL PRIMARY KEY,
  slug          TEXT UNIQUE NOT NULL,
  name          TEXT NOT NULL,
  country       TEXT NOT NULL,
  country_code  CHAR(2) NOT NULL,
  region        TEXT NOT NULL,
  lat           DOUBLE PRECISION NOT NULL,
  lng           DOUBLE PRECISION NOT NULL,
  geom          GEOMETRY(Point, 4326),
  description   TEXT NOT NULL,
  last_updated  DATE NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One row per (city, dimension). A normalized design keeps scores consistent
-- and lets us add a new dimension without a migration.
CREATE TABLE IF NOT EXISTS matching.city_scores (
  city_id     INTEGER NOT NULL REFERENCES matching.cities(id) ON DELETE CASCADE,
  dimension   TEXT NOT NULL CHECK (dimension IN (
                'climate', 'cost', 'housing', 'career', 'education',
                'healthcare', 'community', 'military_safety'
              )),
  score       SMALLINT NOT NULL CHECK (score BETWEEN 0 AND 5),
  sub_scores  JSONB,
  PRIMARY KEY (city_id, dimension)
);

CREATE INDEX IF NOT EXISTS cities_region_idx          ON matching.cities (region);
CREATE INDEX IF NOT EXISTS cities_country_code_idx   ON matching.cities (country_code);
CREATE INDEX IF NOT EXISTS city_scores_dimension_idx ON matching.city_scores (dimension);