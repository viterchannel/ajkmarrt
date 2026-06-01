-- Migration: add cnic_provided boolean column to users table
-- Backfills existing rows: if the user has a cnic (id_card_number) set, mark as provided.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "cnic_provided" boolean NOT NULL DEFAULT false;
UPDATE "users" SET "cnic_provided" = true WHERE "cnic" IS NOT NULL AND "cnic" != '';
