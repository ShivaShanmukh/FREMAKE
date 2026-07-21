import { afterAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { getPool } from "@/lib/db";
import { checkRateLimit } from "./limiter";

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("checkRateLimit (Postgres)", () => {
  const users: string[] = [];
  const testUser = (): string => {
    const id = `test_ratelimit_${randomUUID()}`;
    users.push(id);
    return id;
  };

  afterAll(async () => {
    if (!hasDb || users.length === 0) return;
    await getPool().query("DELETE FROM rate_limit_hits WHERE user_id = ANY($1)", [users]);
    await getPool().end();
  });

  it("allows requests up to the edit limit (10/min), then blocks", async () => {
    const user = testUser();
    for (let i = 0; i < 10; i++) {
      expect(await checkRateLimit(user, "edit")).toEqual({ ok: true });
    }
    const blocked = await checkRateLimit(user, "edit");
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) {
      expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
      expect(blocked.retryAfterSeconds).toBeLessThanOrEqual(60);
    }
  });

  it("allows requests up to the generation limit (5/min), then blocks", async () => {
    const user = testUser();
    for (let i = 0; i < 5; i++) {
      expect(await checkRateLimit(user, "generation")).toEqual({ ok: true });
    }
    expect((await checkRateLimit(user, "generation")).ok).toBe(false);
  });

  it("tracks each action independently — hitting one limit doesn't block the other", async () => {
    const user = testUser();
    for (let i = 0; i < 5; i++) {
      await checkRateLimit(user, "generation");
    }
    expect((await checkRateLimit(user, "generation")).ok).toBe(false);
    expect((await checkRateLimit(user, "edit")).ok).toBe(true);
  });

  it("tracks each user independently", async () => {
    const a = testUser();
    const b = testUser();
    for (let i = 0; i < 5; i++) {
      await checkRateLimit(a, "generation");
    }
    expect((await checkRateLimit(a, "generation")).ok).toBe(false);
    expect((await checkRateLimit(b, "generation")).ok).toBe(true);
  });

  it("concurrent requests at the boundary never let more than the limit through", async () => {
    const user = testUser();
    // Fire 8 concurrent generation checks (limit 5) — exactly 5 should
    // pass regardless of race timing, thanks to the per-user advisory lock.
    const results = await Promise.all(
      Array.from({ length: 8 }, () => checkRateLimit(user, "generation")),
    );
    expect(results.filter((r) => r.ok)).toHaveLength(5);
    expect(results.filter((r) => !r.ok)).toHaveLength(3);
  });
});
