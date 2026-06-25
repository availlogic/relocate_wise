-- RelocateWise v1.0.0 GA (Phase A): schema segregation + role isolation.
--
-- Per docs/Architecture.md §5.1, docs/Database.md §1.4 / §3 / §5 and
-- ITC-11, the database instance must enforce a strict logical
-- boundary between the **matching** service and the **ingestion**
-- service. Each service owns exactly one PostgreSQL schema and
-- connects with a dedicated role whose `GRANT`s are scoped to that
-- schema:
--
--   matching_service  : USAGE on `matching` schema;
--                       SELECT / INSERT / UPDATE / DELETE on every
--                       table in `matching`; sequence grants.
--   ingestion_service : USAGE on `ingestion` schema;
--                       SELECT / INSERT / UPDATE on every table in
--                       `ingestion`; **SELECT-only** on `matching`
--                       (so the ingestion pipeline can read city
--                       metadata but is structurally blocked from
--                       writing city scores — those writes go through
--                       the matching service's internal PUT endpoint,
--                       added in Phase C).
--
-- The migration is idempotent. It is safe to run on a fresh database
-- (`001_init.sql` / `002_military_safety.sql` have already created
-- the tables in `public`) and on a partially-migrated DB.
--
-- A superuser connection is required to CREATE ROLE / ALTER SCHEMA /
-- ALTER DEFAULT PRIVILEGES. The `db` service in `docker-compose.yml`
-- provisions the `POSTGRES_USER` as a superuser so this migration can
-- be applied during `bootstrap()`.

CREATE EXTENSION IF NOT EXISTS postgis;

-- ---------------------------------------------------------------------------
-- 1. Schemas
-- ---------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS matching;
CREATE SCHEMA IF NOT EXISTS ingestion;

-- ---------------------------------------------------------------------------
-- 2. Move existing tables into the matching schema if they are still in
--    `public` (legacy pre-Phase-A layout). Once moved, future migrations
--    target the schema directly.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'cities'
  ) THEN
    ALTER TABLE public.cities SET SCHEMA matching;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'city_scores'
  ) THEN
    ALTER TABLE public.city_scores SET SCHEMA matching;
  END IF;
END
$$;

-- Indexes are recreated inside the matching schema because their names are
-- scoped to the schema.
CREATE INDEX IF NOT EXISTS cities_region_idx          ON matching.cities (region);
CREATE INDEX IF NOT EXISTS cities_country_code_idx   ON matching.cities (country_code);
CREATE INDEX IF NOT EXISTS city_scores_dimension_idx ON matching.city_scores (dimension);

-- ---------------------------------------------------------------------------
-- 3. ingestion.pipeline_logs (Database §3.2)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ingestion.pipeline_logs (
  id             SERIAL PRIMARY KEY,
  job_name       TEXT NOT NULL,
  started_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at   TIMESTAMPTZ,
  status         TEXT NOT NULL CHECK (status IN ('success', 'failed')),
  error_details  TEXT
);
CREATE INDEX IF NOT EXISTS pipeline_logs_status_idx ON ingestion.pipeline_logs (status);

-- ---------------------------------------------------------------------------
-- 4. Roles
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'matching_service') THEN
    CREATE ROLE matching_service LOGIN PASSWORD 'matching_service';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ingestion_service') THEN
    CREATE ROLE ingestion_service LOGIN PASSWORD 'ingestion_service';
  END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- 5. matching_service grants: full R/W on the matching schema.
-- ---------------------------------------------------------------------------
GRANT USAGE ON SCHEMA matching TO matching_service;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON ALL TABLES IN SCHEMA matching TO matching_service;
GRANT USAGE, SELECT
  ON ALL SEQUENCES IN SCHEMA matching TO matching_service;
ALTER DEFAULT PRIVILEGES IN SCHEMA matching
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO matching_service;
ALTER DEFAULT PRIVILEGES IN SCHEMA matching
  GRANT USAGE, SELECT ON SEQUENCES TO matching_service;

-- Explicitly revoke any ingestion-schema rights in case the role was
-- previously granted them. Defence-in-depth: the role is for the
-- matching service only.
REVOKE ALL ON SCHEMA ingestion FROM matching_service;
REVOKE ALL ON ALL TABLES IN SCHEMA ingestion FROM matching_service;

-- ---------------------------------------------------------------------------
-- 6. ingestion_service grants: SELECT-only on matching, full R/W on ingestion.
-- ---------------------------------------------------------------------------
GRANT USAGE ON SCHEMA matching TO ingestion_service;
GRANT SELECT ON ALL TABLES IN SCHEMA matching TO ingestion_service;
ALTER DEFAULT PRIVILEGES IN SCHEMA matching
  GRANT SELECT ON TABLES TO ingestion_service;

GRANT USAGE ON SCHEMA ingestion TO ingestion_service;
GRANT SELECT, INSERT, UPDATE
  ON ALL TABLES IN SCHEMA ingestion TO ingestion_service;
GRANT USAGE, SELECT
  ON ALL SEQUENCES IN SCHEMA ingestion TO ingestion_service;
ALTER DEFAULT PRIVILEGES IN SCHEMA ingestion
  GRANT SELECT, INSERT, UPDATE ON TABLES TO ingestion_service;
ALTER DEFAULT PRIVILEGES IN SCHEMA ingestion
  GRANT USAGE, SELECT ON SEQUENCES TO ingestion_service;

-- Ensure the ingestion role has no write capability on the matching
-- schema. REVOKE is defensive — the GRANTs above are limited, but if
-- a future migration accidentally grants INSERT/UPDATE the REVOKE
-- makes the intent explicit.
REVOKE INSERT, UPDATE, DELETE
  ON ALL TABLES IN SCHEMA matching FROM ingestion_service;
ALTER DEFAULT PRIVILEGES IN SCHEMA matching
  REVOKE INSERT, UPDATE, DELETE ON TABLES FROM ingestion_service;