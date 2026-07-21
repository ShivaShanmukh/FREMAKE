-- Simple per-user sliding-window rate limit. One row per request that
-- passed the check; counting rows in the window is enough at this scale
-- and keeps the same append-only-Postgres pattern as the credit ledger.
CREATE TABLE IF NOT EXISTS rate_limit_hits (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('generation', 'edit')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_hits_lookup
  ON rate_limit_hits (user_id, action, created_at);
