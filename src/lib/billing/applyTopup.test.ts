import { afterAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { getPool } from "@/lib/db";
import { getBalance } from "@/lib/credits/server";
import { applyTopup } from "./applyTopup";

/** Real-Postgres idempotency tests; skipped without DATABASE_URL (CI). */
const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("applyTopup (Postgres)", () => {
  const users: string[] = [];
  const testUser = (): string => {
    const id = `test_topup_${randomUUID()}`;
    users.push(id);
    return id;
  };

  afterAll(async () => {
    if (!hasDb || users.length === 0) return;
    await getPool().query("DELETE FROM credit_transactions WHERE user_id = ANY($1)", [users]);
    await getPool().end();
  });

  it("credits once, then treats the same session id as a duplicate", async () => {
    const user = testUser();
    const session = `cs_test_${randomUUID()}`;
    expect(await applyTopup(user, 1000, session)).toBe("applied");
    expect(await applyTopup(user, 1000, session)).toBe("duplicate");
    expect(await applyTopup(user, 1000, session)).toBe("duplicate");

    const { rows } = await getPool().query(
      "SELECT amount, reason, stripe_ref FROM credit_transactions WHERE user_id = $1",
      [user],
    );
    expect(rows).toEqual([{ amount: 1000, reason: "stripe_topup", stripe_ref: session }]);
    expect(await getBalance(user)).toBe(1000);
  });

  it("distinct sessions credit independently; NULL stripe_refs never collide", async () => {
    const user = testUser();
    expect(await applyTopup(user, 500, `cs_test_${randomUUID()}`)).toBe("applied");
    expect(await applyTopup(user, 500, `cs_test_${randomUUID()}`)).toBe("applied");
    // Ordinary charges have NULL stripe_ref — two of them must not conflict.
    await getPool().query(
      "INSERT INTO credit_transactions (user_id, amount, reason) VALUES ($1, -1, 'edit_element'), ($1, -1, 'edit_element')",
      [user],
    );
    expect(await getBalance(user)).toBe(998);
  });

  it("rejects nonsense credit amounts", async () => {
    await expect(applyTopup(testUser(), 0, "cs_x")).rejects.toThrow("Invalid top-up credits");
    await expect(applyTopup(testUser(), -5, "cs_y")).rejects.toThrow("Invalid top-up credits");
  });
});
