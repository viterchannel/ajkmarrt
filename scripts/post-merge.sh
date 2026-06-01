#!/usr/bin/env bash
# =============================================================================
#  AJKMart — Replit Post-Merge Bootstrap
#  Runs automatically after every task merge.
#
#  What it does (in order):
#    1. Install all pnpm dependencies
#    2. Push Drizzle schema to the database
# =============================================================================
set -e

WORKSPACE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$WORKSPACE"

echo "[post-merge] Installing dependencies..."
HUSKY=0 pnpm install --no-frozen-lockfile
echo "[post-merge] Dependencies installed"

echo "[post-merge] Pushing DB schema..."
if [ -n "${DATABASE_URL:-}" ]; then
  printf "0\n0\n0\n0\n0\n0\n0\n0\n" | pnpm --filter @workspace/db run push-force
  echo "[post-merge] Schema push complete"
else
  echo "[post-merge] DATABASE_URL not set — skipping schema push"
fi

echo "[post-merge] Done"
