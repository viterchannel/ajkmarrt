ALTER TABLE live_locations
  ADD COLUMN IF NOT EXISTS last_ping_at TIMESTAMP DEFAULT NOW();

-- Backfill existing rows so ghost-rider detection works immediately after deploy
UPDATE live_locations
SET last_ping_at = updated_at
WHERE last_ping_at IS NULL AND updated_at IS NOT NULL;

UPDATE live_locations
SET last_ping_at = NOW()
WHERE last_ping_at IS NULL;
