-- Migration: PERF-05 — Replace plain unique index on wallet_transactions.idempotency_key
-- with a covering index that INCLUDEs (type, amount).
--
-- Motivation: Under high-concurrency financial operations (mass payouts, flash sales)
-- the plain B-tree index becomes a hot-page contention point. Adding INCLUDE (type, amount)
-- allows idempotency lookups (WHERE idempotency_key = $1) to resolve via index-only scan
-- without touching the heap, reducing both I/O and lock contention.
--
-- IMPORTANT — MANUAL DEPLOYMENT REQUIRED:
--   CREATE INDEX CONCURRENTLY and DROP INDEX CONCURRENTLY cannot run inside a
--   transaction block. The migration runner wraps every file in a transaction, so
--   this migration MUST be applied manually against the live database before or after
--   the auto-runner processes this file.
--
--   Steps for production deployment:
--     1. Connect to the database with psql (outside any transaction).
--     2. Run the three statements below in order.
--     3. Verify with: \d wallet_transactions
--
-- The auto-runner will record this file as applied but the statements below are
-- no-ops if the index already exists (CREATE ... IF NOT EXISTS / DROP ... IF EXISTS).

-- Step 1: Build the new covering index without blocking reads/writes.
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS wallet_txn_idempotency_covering_idx
  ON wallet_transactions (idempotency_key)
  INCLUDE (type, amount)
  WHERE idempotency_key IS NOT NULL;

-- Step 2: Drop the old plain unique index once the new one is fully built.
DROP INDEX CONCURRENTLY IF EXISTS wallet_txn_idempotency_key_idx;

-- Step 3: Rename the new index to the canonical name so application code and
-- Drizzle schema tracking remain consistent.
ALTER INDEX IF EXISTS wallet_txn_idempotency_covering_idx
  RENAME TO wallet_txn_idempotency_key_idx;
