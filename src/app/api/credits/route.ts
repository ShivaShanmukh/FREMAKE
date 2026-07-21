import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import { isDbConfigured } from "@/lib/db";
import { ensureSignupGrant } from "@/lib/credits/server";

export const dynamic = "force-dynamic";

/** Current balance for the signed-in user (applies the signup grant on first contact). */
export async function GET(request: Request): Promise<NextResponse> {
  const userId = await requireUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Sign in to see your credits." }, { status: 401 });
  }
  if (!isDbConfigured()) {
    return NextResponse.json(
      { error: "The credit ledger is not configured: set DATABASE_URL." },
      { status: 503 },
    );
  }
  return NextResponse.json({ balance: await ensureSignupGrant(userId), userId });
}
