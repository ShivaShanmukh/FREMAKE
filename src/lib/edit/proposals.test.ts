import { afterAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { getPool } from "@/lib/db";
import { ensureSignupGrant, getBalance } from "@/lib/credits/server";
import { approveProposal, createProposal } from "./proposals";

/**
 * Integration tests against real Postgres — skipped without DATABASE_URL
 * (CI has no DB service). These are the server-side proof that /api/approve
 * cannot be tampered with: approveProposal takes only a proposalId and
 * always charges the kind/cost recorded when the proposal was created,
 * never a value supplied at approval time (there is no such parameter).
 */
const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("edit proposals (Postgres)", () => {
  const users: string[] = [];
  const testUser = (): string => {
    const id = `test_proposal_${randomUUID()}`;
    users.push(id);
    return id;
  };

  afterAll(async () => {
    if (!hasDb || users.length === 0) return;
    await getPool().query("DELETE FROM edit_proposals WHERE user_id = ANY($1)", [users]);
    await getPool().query("DELETE FROM credit_transactions WHERE user_id = ANY($1)", [users]);
    await getPool().end();
  });

  it("charges the cost recorded at creation, never a client-supplied one", async () => {
    const user = testUser();
    await ensureSignupGrant(user);
    const proposalId = await createProposal(user, "screen");

    const result = await approveProposal(user, proposalId);
    expect(result).toEqual({ ok: true, balance: 2000 - 5 });
    expect(await getBalance(user)).toBe(1995);

    const { rows } = await getPool().query(
      "SELECT amount, reason FROM credit_transactions WHERE user_id = $1 AND reason <> 'signup_grant'",
      [user],
    );
    expect(rows).toEqual([{ amount: -5, reason: "edit_screen" }]);
  });

  it("element proposals charge 1, screen proposals charge 5 — set at creation time", async () => {
    const user = testUser();
    await ensureSignupGrant(user);
    const elementProposal = await createProposal(user, "element");
    const screenProposal = await createProposal(user, "screen");

    expect(await approveProposal(user, elementProposal)).toEqual({ ok: true, balance: 1999 });
    expect(await approveProposal(user, screenProposal)).toEqual({ ok: true, balance: 1994 });
  });

  it("a proposal can only be approved once", async () => {
    const user = testUser();
    await ensureSignupGrant(user);
    const proposalId = await createProposal(user, "element");

    expect(await approveProposal(user, proposalId)).toEqual({ ok: true, balance: 1999 });
    expect(await approveProposal(user, proposalId)).toEqual({ ok: false, reason: "already_used" });
    expect(await getBalance(user)).toBe(1999); // not double-charged
  });

  it("an unaffordable proposal is rejected and stays approvable later", async () => {
    const user = testUser();
    await ensureSignupGrant(user);
    // Drain the balance to 2 (below the 5-credit screen edit).
    await getPool().query(
      "INSERT INTO credit_transactions (user_id, amount, reason) VALUES ($1, -1998, 'edit_screen')",
      [user],
    );
    expect(await getBalance(user)).toBe(2);

    const proposalId = await createProposal(user, "screen");
    const result = await approveProposal(user, proposalId);
    expect(result).toEqual({ ok: false, reason: "insufficient", balance: 2, cost: 5 });
    expect(await getBalance(user)).toBe(2); // unchanged — no partial charge

    // Top up, then the SAME proposal can still be approved.
    await getPool().query(
      "INSERT INTO credit_transactions (user_id, amount, reason) VALUES ($1, 10, 'refund')",
      [user],
    );
    expect(await approveProposal(user, proposalId)).toEqual({ ok: true, balance: 7 });
  });

  it("rejects an unknown proposal id and a proposal belonging to another user", async () => {
    const userA = testUser();
    const userB = testUser();
    await ensureSignupGrant(userA);
    await ensureSignupGrant(userB);

    expect(await approveProposal(userA, "9999999")).toEqual({ ok: false, reason: "not_found" });

    const proposalId = await createProposal(userA, "element");
    // userB cannot approve userA's proposal, tampered user or not.
    expect(await approveProposal(userB, proposalId)).toEqual({ ok: false, reason: "not_found" });
    expect(await getBalance(userA)).toBe(2000);
    expect(await getBalance(userB)).toBe(2000);
  });

  it("concurrent approvals of the same proposal only charge once", async () => {
    const user = testUser();
    await ensureSignupGrant(user);
    const proposalId = await createProposal(user, "screen");

    const results = await Promise.all([
      approveProposal(user, proposalId),
      approveProposal(user, proposalId),
      approveProposal(user, proposalId),
    ]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok && r.reason === "already_used")).toHaveLength(2);
    expect(await getBalance(user)).toBe(1995);
  });
});
