-- RelocateWise v0.3.0: 8th dimension (military_safety).
--
-- v0.2.0 shipped 7 dimensions. v0.3.0 adds `military_safety` (PRD
-- §6.1 D8, Architecture §5.1) and lifts the existing CHECK constraint
-- to enumerate all 8 dimension names. Migration is idempotent.
--
-- This migration runs as part of `runMigrations()` on every boot. The
-- migrator records the filename in `_migrations` so it only runs once
-- per database.

-- 1. Drop the old (permissive) dimension CHECK constraint, if any.
--    PostgreSQL names the auto-generated constraint `city_scores_dimension_check`.
ALTER TABLE city_scores
  DROP CONSTRAINT IF EXISTS city_scores_dimension_check;

-- 2. Add the new explicit CHECK constraint that enumerates all 8 dimensions.
ALTER TABLE city_scores
  ADD CONSTRAINT city_scores_dimension_check
  CHECK (dimension IN (
    'climate', 'cost', 'housing', 'career', 'education',
    'healthcare', 'community', 'military_safety'
  ));
