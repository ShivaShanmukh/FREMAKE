-- Stripe top-ups append to the same ledger with reason 'stripe_topup'.
-- stripe_ref holds the Checkout Session id; the partial unique index is
-- the idempotency guard — a resent webhook inserts nothing.
-- (Rerunnable: the migration runner applies every file on every run.)
ALTER TABLE credit_transactions
  DROP CONSTRAINT IF EXISTS credit_transactions_reason_check;
ALTER TABLE credit_transactions
  ADD CONSTRAINT credit_transactions_reason_check CHECK (
    reason IN ('signup_grant', 'generation', 'edit_element', 'edit_screen', 'refund', 'stripe_topup')
  );

ALTER TABLE credit_transactions
  ADD COLUMN IF NOT EXISTS stripe_ref TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_credit_transactions_stripe_ref
  ON credit_transactions (stripe_ref)
  WHERE stripe_ref IS NOT NULL;
