import { getPool } from "@/lib/db";

export type TopupResult = "applied" | "duplicate";

/**
 * Appends the top-up ledger row for a paid Checkout Session. Idempotent
 * by design: stripe_ref (the session id) carries a partial unique index,
 * so a resent webhook — Stripe re-delivers events at-least-once — hits
 * ON CONFLICT DO NOTHING and adds zero credits the second time.
 */
export async function applyTopup(
  userId: string,
  credits: number,
  sessionId: string,
): Promise<TopupResult> {
  if (!Number.isInteger(credits) || credits <= 0) {
    throw new Error(`Invalid top-up credits: ${credits}`);
  }
  const { rowCount } = await getPool().query(
    `INSERT INTO credit_transactions (user_id, amount, reason, stripe_ref)
     VALUES ($1, $2, 'stripe_topup', $3)
     ON CONFLICT (stripe_ref) WHERE stripe_ref IS NOT NULL DO NOTHING`,
    [userId, credits, sessionId],
  );
  return rowCount === 1 ? "applied" : "duplicate";
}
