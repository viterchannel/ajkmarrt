-- Migration: Progressive Verification — users columns + feature_rules + verification_bonuses
--
-- Adds the columns and tables required by the progressive verification system.
-- All changes are idempotent (ADD COLUMN IF NOT EXISTS / CREATE TABLE IF NOT EXISTS).
--
-- users.cnic already captures the national ID card number; no new idCardNumber column is added.

-- ── 1. New columns on users ──────────────────────────────────────────────────

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS documents_submitted     BOOLEAN     NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS documents_approved      BOOLEAN     NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS registration_lat        REAL,
  ADD COLUMN IF NOT EXISTS registration_lng        REAL,
  ADD COLUMN IF NOT EXISTS verification_bonus_claimed JSONB    NOT NULL DEFAULT '{}';

-- Add unique constraint on cnic (the id_card_number column, reused in Drizzle as idCardNumber)
-- Guard against duplicate values that may exist before this migration
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'users_cnic_unique' AND conrelid = 'users'::regclass
  ) THEN
    -- Remove any duplicate non-null values first (keep oldest row's value)
    UPDATE users u
    SET cnic = NULL
    WHERE cnic IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM users u2
        WHERE u2.cnic = u.cnic AND u2.id < u.id
      );
    ALTER TABLE users ADD CONSTRAINT users_cnic_unique UNIQUE (cnic);
  END IF;
END
$$;

-- ── 2. feature_rules table ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS feature_rules (
  id                      SERIAL      PRIMARY KEY,
  role                    TEXT        NOT NULL,
  feature_name            TEXT        NOT NULL,
  required_verifications  JSONB       NOT NULL DEFAULT '[]',
  max_daily_limit         INTEGER     NOT NULL DEFAULT 0,
  is_active               BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS feature_rules_role_idx         ON feature_rules (role);
CREATE INDEX IF NOT EXISTS feature_rules_feature_name_idx ON feature_rules (feature_name);

-- ── 3. verification_bonuses table ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS verification_bonuses (
  id                SERIAL          PRIMARY KEY,
  verification_type TEXT            NOT NULL UNIQUE,
  bonus_amount      NUMERIC(10, 2)  NOT NULL DEFAULT 0,
  bonus_type        TEXT            NOT NULL DEFAULT 'coins',
  is_active         BOOLEAN         NOT NULL DEFAULT TRUE
);

-- ── 4. Default seed rows ─────────────────────────────────────────────────────

INSERT INTO feature_rules (role, feature_name, required_verifications, max_daily_limit, is_active)
VALUES
  ('customer', 'order_grocery',       '[]'::jsonb,                                        0, TRUE),
  ('customer', 'ride_booking',        '["phone_verified"]'::jsonb,                        0, TRUE),
  ('customer', 'wallet_topup',        '["phone_verified"]'::jsonb,                        0, TRUE),
  ('rider',    'view_earnings',       '["phone_verified"]'::jsonb,                        0, TRUE),
  ('rider',    'accept_ride',         '["phone_verified","documents_approved"]'::jsonb,    0, TRUE),
  ('vendor',   'create_menu_item',    '["phone_verified","documents_approved"]'::jsonb,    0, TRUE)
ON CONFLICT DO NOTHING;

/* Ensure unique constraint exists before the ON CONFLICT clause uses it.
   Drizzle push may have created the table without it if schema definition drifted. */
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'verification_bonuses_verification_type_unique'
      AND conrelid = 'verification_bonuses'::regclass
  ) THEN
    ALTER TABLE verification_bonuses
      ADD CONSTRAINT verification_bonuses_verification_type_unique
      UNIQUE (verification_type);
  END IF;
END
$$;

INSERT INTO verification_bonuses (verification_type, bonus_amount, bonus_type, is_active)
VALUES
  ('email_verified',      50, 'coins', TRUE),
  ('phone_verified',      50, 'coins', TRUE),
  ('documents_approved',  50, 'coins', TRUE)
ON CONFLICT (verification_type) DO NOTHING;
