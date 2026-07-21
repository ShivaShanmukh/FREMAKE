import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/lib/auth";
import { isDbConfigured } from "@/lib/db";
import { approveProposal } from "@/lib/edit/proposals";

export const dynamic = "force-dynamic";

/**
 * The debit endpoint. Consumes a proposal created by /api/edit and
 * charges exactly the kind/cost stored on that row — a client cannot
 * influence the charge by sending any other field (extra keys in the
 * request body are simply ignored by the schema below; there is no
 * `kind` or `cost` field to tamper with in the first place).
 */
const requestSchema = z.object({
  proposalId: z.string().min(1),
});

export async function POST(request: Request): Promise<NextResponse> {
  const userId = await requireUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Sign in to approve an edit." }, { status: 401 });
  }
  if (!isDbConfigured()) {
    return NextResponse.json(
      { error: "The credit ledger is not configured: set DATABASE_URL." },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be JSON." }, { status: 400 });
  }
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "proposalId is required." }, { status: 400 });
  }

  const result = await approveProposal(userId, parsed.data.proposalId);
  if (result.ok) {
    return NextResponse.json({ balance: result.balance });
  }
  switch (result.reason) {
    case "not_found":
      return NextResponse.json({ error: "Unknown proposal — propose the edit again." }, { status: 404 });
    case "already_used":
      return NextResponse.json({ error: "This edit has already been approved." }, { status: 409 });
    case "expired":
      return NextResponse.json({ error: "This proposal expired — propose the edit again." }, { status: 410 });
    case "insufficient":
      return NextResponse.json(
        { error: `Not enough credits: this needs ${result.cost}, you have ${result.balance}.`, balance: result.balance },
        { status: 402 },
      );
  }
}
