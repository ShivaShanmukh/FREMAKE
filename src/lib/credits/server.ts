import type { PoolClient } from "pg";
import { getPool } from "@/lib/db";
import { STARTING_BALANCE } from "./costs";

/**
 * Server-side credit ledger. Append-only: every action inserts a row into
 * credit_transactions; a balance is always SUM(amount), never a stored
 * total. All mutations take a per-user advisory lock so a concurrent
 * check+insert can never overspend.
 */

export type ChargeReason = "generation" | "edit_element" | "edit_screen";

export type ChargeResult =
  | { ok: true; balance: number }
  | { ok: false; balance: number };

/** Exported so approveProposal (src/lib/edit/proposals.ts) can read the
 *  balance inside the SAME transaction that consumes a proposal. */
export async function sumBalance(client: PoolClient, userId: string): Promise<number> {
  const { rows } = await client.query<{ balance: number }>(
    "SELECT COALESCE(SUM(amount), 0)::int AS balance FROM credit_transactions WHERE user_id = $1",
    [userId],
  );
  return rows[0].balance;
}

/** Current balance — a plain read, safe for prechecks and the UI badge. */
export async function getBalance(userId: string): Promise<number> {
  const client = await getPool().connect();
  try {
    return await sumBalance(client, userId);
  } finally {
    client.release();
  }
}

/**
 * First-contact grant: inserts the starter allowance once per user, ever.
 * Runs under the user lock so two concurrent first requests can't both
 * grant. Returns the user's balance after the (possible) grant.
 */
export async function ensureSignupGrant(userId: string): Promise<number> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [userId]);
    await client.query(
      `INSERT INTO credit_transactions (user_id, amount, reason)
       SELECT $1, $2, 'signup_grant'
       WHERE NOT EXISTS (SELECT 1 FROM credit_transactions WHERE user_id = $1)`,
      [userId, STARTING_BALANCE],
    );
    const balance = await sumBalance(client, userId);
    await client.query("COMMIT");
    return balance;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Atomically re-checks the balance and appends the charge row. This is the
 * ONLY place a charge is written. Returns ok:false (and writes nothing)
 * when the balance cannot cover the cost.
 */
export async function charge(
  userId: string,
  cost: number,
  reason: ChargeReason,
): Promise<ChargeResult> {
  if (!Number.isInteger(cost) || cost <= 0) {
    throw new Error(`Invalid credit cost: ${cost}`);
  }
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [userId]);
    const balance = await sumBalance(client, userId);
    if (balance < cost) {
      await client.query("ROLLBACK");
      return { ok: false, balance };
    }
    await client.query(
      "INSERT INTO credit_transactions (user_id, amount, reason) VALUES ($1, $2, $3)",
      [userId, -cost, reason],
    );
    await client.query("COMMIT");
    return { ok: true, balance: balance - cost };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
