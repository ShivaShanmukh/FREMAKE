-- Append-only credit ledger. A user's balance is ALWAYS computed as
-- SUM(amount) over their rows — there is no stored total to drift out of
-- sync. Negative amounts are charges; positive are grants/refunds.
CREATE TABLE IF NOT EXISTS credit_transactions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK (amount <> 0),
  reason TEXT NOT NULL CHECK (
    reason IN ('signup_grant', 'generation', 'edit_element', 'edit_screen', 'refund')
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_credit_transactions_user
  ON credit_transactions (user_id);
