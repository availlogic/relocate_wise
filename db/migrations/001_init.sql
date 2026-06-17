-- RelocateWise initial schema (Architecture §5.1).
--
-- Run with: psql "$DATABASE_URL" -f db/migrations/001_init.sql
-- The `api` container also runs this on first boot via `npm run db:migrate`
-- (see api/src/db/migrate.ts). Both paths are idempotent.

-- PostGIS is provisioned for forward-compat (post-MVP "within 50 km of X"
-- filtering). The geometry column is not used by any MVP query, by design.
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS cities (
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
CREATE TABLE IF NOT EXISTS city_scores (
  city_id     INTEGER NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
  dimension   TEXT NOT NULL CHECK (dimension IN (
                'climate', 'cost', 'housing', 'career', 'education',
                'healthcare', 'community', 'military_safety'
              )),
  score       SMALLINT NOT NULL CHECK (score BETWEEN 0 AND 5),
  sub_scores  JSONB,
  PRIMARY KEY (city_id, dimension)
);

CREATE INDEX IF NOT EXISTS cities_region_idx          ON cities (region);
CREATE INDEX IF NOT EXISTS cities_country_code_idx   ON cities (country_code);
CREATE INDEX IF NOT EXISTS city_scores_dimension_idx ON city_scores (dimension);

