CREATE TABLE IF NOT EXISTS rider_gate_events (
  id SERIAL PRIMARY KEY,
  rider_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  gate INTEGER NOT NULL,
  reason TEXT NOT NULL,
  metadata TEXT,
  blocked_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS rider_gate_events_rider_id_idx ON rider_gate_events (rider_id);

CREATE INDEX IF NOT EXISTS rider_gate_events_blocked_at_idx ON rider_gate_events (blocked_at);
