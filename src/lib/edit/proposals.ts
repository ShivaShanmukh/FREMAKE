import { getPool } from "@/lib/db";
import { editCost } from "@/lib/credits/costs";
import { sumBalance } from "@/lib/credits/server";

/**
 * Server-authoritative record of what a proposed edit costs. /api/approve
 * consumes a proposal by id and charges exactly the kind/cost stored
 * here — never a value the client sends — so approving cannot be
 * tampered with by claiming a cheaper kind than what was proposed.
 */

export type ProposalKind = "element" | "screen";

const PROPOSAL_TTL_MS = 30 * 60 * 1000;

export async function createProposal(userId: string, kind: ProposalKind): Promise<string> {
  const cost = editCost(kind);
  const { rows } = await getPool().query<{ id: string }>(
    "INSERT INTO edit_proposals (user_id, kind, cost) VALUES ($1, $2, $3) RETURNING id::text",
    [userId, kind, cost],
  );
  return rows[0].id;
}

export type ApproveResult =
  | { ok: true; balance: number }
  | { ok: false; reason: "not_found" | "already_used" | "expired" }
  | { ok: false; reason: "insufficient"; balance: number; cost: number };

/**
 * Atomically: look up the proposal (locked, scoped to this user), verify
 * it is unused and unexpired, check the balance, then mark it used and
 * append the charge row — all in one transaction, under the same
 * per-user advisory lock `charge()` uses, so concurrent approvals for
 * the same user can never overspend. An insufficient balance rolls back
 * without consuming the proposal, so the user can retry after topping up.
 */
export async function approveProposal(userId: string, proposalId: string): Promise<ApproveResult> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [userId]);

    const { rows } = await client.query<{
      kind: ProposalKind;
      cost: number;
      used_at: Date | null;
      created_at: Date;
    }>(
      `SELECT kind, cost, used_at, created_at
       FROM edit_proposals
       WHERE id = $1 AND user_id = $2
       FOR UPDATE`,
      [proposalId, userId],
    );

    if (rows.length === 0) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "not_found" };
    }
    const proposal = rows[0];
    if (proposal.used_at !== null) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "already_used" };
    }
    if (Date.now() - new Date(proposal.created_at).getTime() > PROPOSAL_TTL_MS) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "expired" };
    }

    const balance = await sumBalance(client, userId);
    if (balance < proposal.cost) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "insufficient", balance, cost: proposal.cost };
    }

    await client.query("UPDATE edit_proposals SET used_at = now() WHERE id = $1", [proposalId]);
    await client.query(
      "INSERT INTO credit_transactions (user_id, amount, reason) VALUES ($1, $2, $3)",
      [userId, -proposal.cost, proposal.kind === "element" ? "edit_element" : "edit_screen"],
    );
    await client.query("COMMIT");
    return { ok: true, balance: balance - proposal.cost };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
