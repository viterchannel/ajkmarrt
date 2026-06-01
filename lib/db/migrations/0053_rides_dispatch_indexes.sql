-- Migration: Performance indexes for dispatch, scheduling, and pool-ride queries.
--
-- dispatched_rider_id: The dispatch loop frequently queries rides WHERE
--   dispatched_rider_id = $1 to locate which ride is currently assigned to a
--   rider candidate. Without this index the query does a full table scan as the
--   rides table grows.
--
-- scheduled_at: Scheduled-ride pre-fetch queries filter on scheduled_at to find
--   upcoming trips within a time window. The partial WHERE clause limits index
--   size to only rows that are actual scheduled rides.
--
-- pool_group_id: Pool-ride grouping joins on pool_group_id to assemble all legs
--   of a shared trip. The partial WHERE clause excludes the majority of
--   non-pool rows.
--
-- NOTE: CONCURRENTLY is intentionally omitted — the migration runner executes
-- inside a transaction block and CONCURRENTLY is incompatible with transactions.
-- These indexes are created synchronously; for large live tables run them
-- manually with CONCURRENTLY outside a transaction before applying this file.

CREATE INDEX IF NOT EXISTS rides_dispatched_rider_id_idx
  ON rides (dispatched_rider_id)
  WHERE dispatched_rider_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS rides_scheduled_at_idx
  ON rides (scheduled_at)
  WHERE is_scheduled = true;

CREATE INDEX IF NOT EXISTS rides_pool_group_id_idx
  ON rides (pool_group_id)
  WHERE pool_group_id IS NOT NULL;
