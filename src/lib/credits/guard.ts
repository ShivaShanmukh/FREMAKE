import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import { isDbConfigured } from "@/lib/db";
import { ensureSignupGrant } from "./server";

export type CreditGuard = { userId: string; balance: number };

/**
 * Shared route preamble: authenticate, apply the one-time signup grant,
 * and verify the balance covers `cost` BEFORE any model call fires.
 * Returns a ready NextResponse on any failure — the caller just returns it.
 */
export async function requireCredits(
  request: Request,
  cost: number,
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
  const balance = await ensureSignupGrant(userId);
  if (balance < cost) {
    return NextResponse.json(
      { error: `Not enough credits: this needs ${cost}, you have ${balance}.`, balance },
      { status: 402 },
    );
  }
  return { userId, balance };
}
