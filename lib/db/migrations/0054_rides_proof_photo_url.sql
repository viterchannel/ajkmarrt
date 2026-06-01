-- Migration: Add proof_photo_url column to rides table.
--
-- Rider delivery/completion proof photos were previously stored as raw base64
-- data URIs in the orders table only. This migration adds a nullable VARCHAR
-- column to the rides table so that ride-completion proof photos can be stored
-- as object-storage URLs (uploaded via POST /uploads/proof) rather than inline
-- base64 blobs, matching the pattern already used by the orders table.
--
-- The column is nullable so existing rows are unaffected and no backfill is
-- required. New ride completions will populate proof_photo_url with the URL
-- returned by the upload endpoint.

ALTER TABLE rides
  ADD COLUMN IF NOT EXISTS proof_photo_url TEXT;
