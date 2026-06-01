-- Migration: Compound index on auth_audit_log(user_id, event, created_at)
--
-- CRIT-07: Admin OTP audit views filter and sort by (user_id, event, created_at).
-- Without a compound index this is a full table scan that degrades linearly as
-- auth activity accumulates.  A covering compound index on all three columns lets
-- PostgreSQL satisfy these queries with an index-only scan.

CREATE INDEX IF NOT EXISTS auth_audit_log_user_event_created_idx
  ON auth_audit_log (user_id, event, created_at);
