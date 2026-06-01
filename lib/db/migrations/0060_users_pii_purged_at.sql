-- Migration: add pii_purged_at to users table
-- Tracks when a soft-deleted user's personal data was permanently wiped by
-- the 30-day PII purge scheduler job.  NULL = not yet purged.
-- Stamped by the scheduler's purgeDeletedUserPii() function after nulling
-- name, phone, email, cnic, address, emergency_contact, bank fields, etc.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS pii_purged_at TIMESTAMP;

-- Index to make the scheduler's WHERE clause fast:
--   WHERE deleted_at IS NOT NULL AND deleted_at < $cutoff AND pii_purged_at IS NULL
CREATE INDEX IF NOT EXISTS idx_users_pii_purge_candidates
  ON users (deleted_at)
  WHERE deleted_at IS NOT NULL AND pii_purged_at IS NULL;
