import { getPool } from "@/lib/db";

/**
 * Per-user sliding-window rate limit backed by Postgres. Protects
 * against a runaway client loop or a single user hammering the Claude
 * API — not distributed abuse. Good enough for a beta; a real attacker
 * with many accounts isn't the threat model here.
 */

export type RateLimitAction = "generation" | "edit";

const LIMITS: Record<RateLimitAction, { max: number; windowSeconds: number }> = {
  generation: { max: 5, windowSeconds: 60 },
  edit: { max: 10, windowSeconds: 60 },
};

export type RateLimitResult = { ok: true } | { ok: false; retryAfterSeconds: number };

export async function checkRateLimit(userId: string, action: RateLimitAction): Promise<RateLimitResult> {
  const { max, windowSeconds } = LIMITS[action];
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    // Lock per user+action so two near-simultaneous requests can't both
    // slip through at exactly the limit boundary.
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`ratelimit:${userId}:${action}`]);

    const { rows } = await client.query<{ count: string; oldest: Date | null }>(
      `SELECT COUNT(*)::int AS count, MIN(created_at) AS oldest
       FROM rate_limit_hits
       WHERE user_id = $1 AND action = $2
         AND created_at > now() - ($3 || ' seconds')::interval`,
      [userId, action, windowSeconds],
    );
    const count = Number(rows[0].count);

    if (count >= max) {
      await client.query("ROLLBACK");
      const oldest = rows[0].oldest;
      const elapsedSeconds = oldest ? (Date.now() - new Date(oldest).getTime()) / 1000 : 0;
      const retryAfterSeconds = Math.max(1, Math.ceil(windowSeconds - elapsedSeconds));
      return { ok: false, retryAfterSeconds };
    }

    await client.query("INSERT INTO rate_limit_hits (user_id, action) VALUES ($1, $2)", [userId, action]);
    await client.query("COMMIT");
    return { ok: true };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
