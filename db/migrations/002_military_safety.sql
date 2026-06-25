-- RelocateWise v0.3.0 → v1.0.0 GA: 8th dimension + schema segregation.
--
-- v0.2.0 shipped 7 dimensions. v0.3.0 added `military_safety` (PRD
-- §6.1 D8, Architecture §5.1) and lifted the existing CHECK constraint
-- to enumerate all 8 dimension names. Migration is idempotent.
--
-- As of Phase A (v1.0.0 GA) the constraint targets `matching.city_scores`
-- (the schema-qualified name) instead of `public.city_scores`.
--
-- This migration runs as part of `runMigrations()` on every boot. The
-- migrator records the filename in `_migrations` so it only runs once
-- per database. It must run **before** `003_schemas.sql` on a legacy DB
-- (which moves the table into the `matching` schema); on a fresh DB
-- `001_init.sql` already creates the table in `matching`, so this
-- migration's ALTER is a no-op.

-- 1. Drop the old (permissive) dimension CHECK constraint, if any.
--    PostgreSQL names the auto-generated constraint `city_scores_dimension_check`.
ALTER TABLE IF EXISTS matching.city_scores
  DROP CONSTRAINT IF EXISTS city_scores_dimension_check;
ALTER TABLE IF EXISTS public.city_scores
  DROP CONSTRAINT IF EXISTS city_scores_dimension_check;

-- 2. Add the new explicit CHECK constraint that enumerates all 8 dimensions.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'matching' AND table_name = 'city_scores'
  ) THEN
    ALTER TABLE matching.city_scores
      ADD CONSTRAINT city_scores_dimension_check
      CHECK (dimension IN (
        'climate', 'cost', 'housing', 'career', 'education',
        'healthcare', 'community', 'military_safety'
      ));
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'city_scores'
  ) THEN
    ALTER TABLE public.city_scores
      ADD CONSTRAINT city_scores_dimension_check
      CHECK (dimension IN (
        'climate', 'cost', 'housing', 'career', 'education',
        'healthcare', 'community', 'military_safety'
      ));
  END IF;
END
$$;