import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import { isDbConfigured } from "@/lib/db";
import { checkRateLimit, type RateLimitAction } from "@/lib/rateLimit/limiter";
import { ensureSignupGrant } from "./server";

export type CreditGuard = { userId: string; balance: number };

/**
 * Shared route preamble: authenticate, rate-limit, apply the one-time
 * signup grant, and verify the balance covers `cost` — all BEFORE any
 * model call fires. Returns a ready NextResponse on any failure — the
 * caller just returns it.
 */
export async function requireCredits(
  request: Request,
  cost: number,
  rateLimitAction: RateLimitAction,
): Promise<CreditGuard | NextResponse> {
  const userId = await requireUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Sign in to use FrMake Studio." }, { status: 401 });
  }
  if (!isDbConfigured()) {
    return NextResponse.json(
      { error: "The credit ledger is not configured: set DATABASE_URL." },
      { status: 503 },
    );
  }
  const rate = await checkRateLimit(userId, rateLimitAction);
  if (!rate.ok) {
    return NextResponse.json(
      { error: `Too many requests — wait ${rate.retryAfterSeconds}s and try again.` },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }
  const balance = await ensureSignupGrant(userId);
  if (balance < cost) {
    return NextResponse.json(
      { error: `Not enough credits: this needs ${cost}, you have ${balance}.`, balance },
      { status: 402 },
    );
  }
  return { userId, balance };
}
