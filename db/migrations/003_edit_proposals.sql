-- Server-authoritative record of what a proposed edit actually costs.
-- /api/approve looks up cost/kind from this row by id and ignores
-- anything a client claims — closing the tamper vector where a client
-- could approve an expensive edit while declaring a cheaper kind.
CREATE TABLE IF NOT EXISTS edit_proposals (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('element', 'screen')),
  cost INTEGER NOT NULL CHECK (cost > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  used_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_edit_proposals_user ON edit_proposals (user_id);
