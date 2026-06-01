-- Migration: Compound index on account_conditions(user_id, is_active, severity)
--
-- PERF-03: Tier-based admin user filtering uses correlated EXISTS subqueries
-- against account_conditions filtered by (user_id, is_active, severity).
-- Without a compound index each EXISTS probe requires a partial scan of the
-- account_conditions rows for that user.  This index lets PostgreSQL satisfy
-- each probe with a single index lookup.

CREATE INDEX IF NOT EXISTS ac_user_active_severity_idx
  ON account_conditions (user_id, is_active, severity);
