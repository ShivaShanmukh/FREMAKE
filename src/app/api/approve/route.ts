import { NextResponse } from "next/server";
import { z } from "zod";
import { editCost } from "@/lib/credits/costs";
import { requireCredits } from "@/lib/credits/guard";
import { charge } from "@/lib/credits/server";

export const dynamic = "force-dynamic";

/**
 * The debit endpoint. Called exactly once per approved edit diff — never
 * on propose, reject, dismiss, or an empty diff (the client removes the
 * approve action for those, and no other code path posts here). Writes
 * one negative ledger row atomically with a balance re-check.
 */
const requestSchema = z.object({
  kind: z.enum(["element", "screen"]),
});

export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be JSON." }, { status: 400 });
  }
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "kind must be 'element' or 'screen'." }, { status: 400 });
  }

  const cost = editCost(parsed.data.kind);
  const guard = await requireCredits(request, cost);
  if (guard instanceof NextResponse) {
    return guard;
  }

  const result = await charge(
    guard.userId,
    cost,
    parsed.data.kind === "element" ? "edit_element" : "edit_screen",
  );
  if (!result.ok) {
    return NextResponse.json(
      { error: `Not enough credits: this needs ${cost}, you have ${result.balance}.`, balance: result.balance },
      { status: 402 },
    );
  }
  return NextResponse.json({ balance: result.balance });
}
