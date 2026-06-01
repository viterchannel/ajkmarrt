-- Migration: user_roles join table — replaces comma-separated users.roles text column
--
-- CRIT-04 + PERF-01: users.roles is a plain text column filtered with ILIKE '%rider%',
-- which forces a full sequential scan and cannot use any B-tree index.  This migration
-- introduces a normalised join table with a proper enum column so all role filters can
-- use indexed equality lookups.
--
-- The legacy users.roles column is RETAINED for the duration of the migration window so
-- all existing consumers continue to function.  Full removal is a follow-up migration
-- once all query call sites have been switched over.
--
-- This migration is idempotent — safe to re-run.

-- 1. Create the role enum (skip if it already exists from a re-run)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM (
      'customer',
      'rider',
      'vendor',
      'admin',
      'van_driver'
    );
  END IF;
END
$$;

-- 2. Create user_roles join table
CREATE TABLE IF NOT EXISTS user_roles (
  id          TEXT        PRIMARY KEY,
  user_id     TEXT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role        user_role   NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT  user_roles_user_id_role_unique UNIQUE (user_id, role)
);

-- 3. Indexes for fast lookups
CREATE INDEX IF NOT EXISTS user_roles_user_id_idx ON user_roles (user_id);
CREATE INDEX IF NOT EXISTS user_roles_role_idx     ON user_roles (role);

-- 4. Backfill: split every users.roles CSV string into individual rows.
--    The INSERT ... ON CONFLICT DO NOTHING makes this idempotent.
INSERT INTO user_roles (id, user_id, role, created_at)
SELECT
  -- deterministic id: md5 of "userId:role" so re-runs produce the same rows
  md5(u.id || ':' || r.role) AS id,
  u.id                        AS user_id,
  r.role::user_role           AS role,
  u.created_at                AS created_at
FROM users u
CROSS JOIN LATERAL (
  SELECT trim(part) AS role
  FROM unnest(string_to_array(u.roles, ',')) AS part
  WHERE trim(part) <> ''
    AND trim(part) IN ('customer','rider','vendor','admin','van_driver')
) r
ON CONFLICT (user_id, role) DO NOTHING;
