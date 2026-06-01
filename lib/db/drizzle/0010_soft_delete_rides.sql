-- Add soft-delete support to the rides table.
-- Matches the pattern already used in orders (0008) and users (0009).
-- Hard DELETEs should be replaced with SET deleted_at = now().
ALTER TABLE "rides" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp with time zone;
