import { afterAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { getPool } from "@/lib/db";
import { STARTING_BALANCE } from "./costs";
import { charge, ensureSignupGrant, getBalance } from "./server";

/**
 * Integration tests against a real Postgres (local Docker in dev). Skipped
 * when DATABASE_URL is unset (e.g. CI without a database service) — run
 * locally with `npm test` after `docker start frmake-pg`.
 */
const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("credit ledger (Postgres)", () => {
  const users: string[] = [];
  const testUser = (): string => {
    const id = `test_${randomUUID()}`;
    users.push(id);
    return id;
  };

  afterAll(async () => {
    if (!hasDb || users.length === 0) return;
    await getPool().query("DELETE FROM credit_transactions WHERE user_id = ANY($1)", [users]);
    await getPool().end();
  });

  it("grants the starter balance exactly once, ever", async () => {
    const user = testUser();
    expect(await ensureSignupGrant(user)).toBe(STARTING_BALANCE);
    expect(await ensureSignupGrant(user)).toBe(STARTING_BALANCE);
    const { rows } = await getPool().query(
      "SELECT COUNT(*)::int AS n FROM credit_transactions WHERE user_id = $1 AND reason = 'signup_grant'",
      [user],
    );
    expect(rows[0].n).toBe(1);
  });

  it("charge appends one negative row and the balance is the sum of rows", async () => {
    const user = testUser();
    await ensureSignupGrant(user);
    const result = await charge(user, 10, "generation");
    expect(result).toEqual({ ok: true, balance: STARTING_BALANCE - 10 });
    const { rows } = await getPool().query(
      "SELECT amount, reason FROM credit_transactions WHERE user_id = $1 ORDER BY id",
      [user],
    );
    expect(rows).toEqual([
      { amount: STARTING_BALANCE, reason: "signup_grant" },
      { amount: -10, reason: "generation" },
    ]);
    expect(await getBalance(user)).toBe(STARTING_BALANCE - 10);
  });

  it("an unaffordable charge writes nothing", async () => {
    const user = testUser();
    await ensureSignupGrant(user);
    const result = await charge(user, STARTING_BALANCE + 1, "edit_screen");
    expect(result).toEqual({ ok: false, balance: STARTING_BALANCE });
    const { rows } = await getPool().query(
      "SELECT COUNT(*)::int AS n FROM credit_transactions WHERE user_id = $1",
      [user],
    );
    expect(rows[0].n).toBe(1); // only the grant
  });

  it("concurrent charges can never overspend (advisory lock)", async () => {
    const user = testUser();
    await ensureSignupGrant(user); // 2000
    const results = await Promise.all(
      Array.from({ length: 5 }, () => charge(user, 500, "edit_screen")),
    );
    expect(results.filter((r) => r.ok)).toHaveLength(4);
    expect(await getBalance(user)).toBe(0);
  });

  it("balances are per-user", async () => {
    const a = testUser();
    const b = testUser();
    await ensureSignupGrant(a);
    await ensureSignupGrant(b);
    await charge(a, 100, "generation");
    expect(await getBalance(a)).toBe(STARTING_BALANCE - 100);
    expect(await getBalance(b)).toBe(STARTING_BALANCE);
  });
});
