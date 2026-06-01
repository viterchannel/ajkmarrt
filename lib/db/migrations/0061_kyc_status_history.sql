-- Migration: kyc_status_history
-- Creates an audit table for every KYC status change so admins can trace
-- who revoked (or otherwise changed) a rider's KYC approval and when.

CREATE TABLE IF NOT EXISTS kyc_status_history (
  id                   TEXT        PRIMARY KEY,
  user_id              TEXT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  from_status          TEXT        NOT NULL,
  to_status            TEXT        NOT NULL,
  reason               TEXT,
  changed_by_admin_id  TEXT,
  changed_by_admin_name TEXT,
  ip                   TEXT,
  created_at           TIMESTAMP   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS kyc_status_history_user_id_idx ON kyc_status_history (user_id);
CREATE INDEX IF NOT EXISTS kyc_status_history_created_at_idx ON kyc_status_history (created_at);
