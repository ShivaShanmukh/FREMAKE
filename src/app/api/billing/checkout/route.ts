import { NextResponse } from "next/server";
import Stripe from "stripe";
import { z } from "zod";
import { requireUserId } from "@/lib/auth";
import { findPackage } from "@/lib/billing/packages";

export const dynamic = "force-dynamic";

const requestSchema = z.object({ packageId: z.string().min(1) });

/** Creates a Stripe Checkout Session for a credit top-up. */
export async function POST(request: Request): Promise<NextResponse> {
  const userId = await requireUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Sign in to buy credits." }, { status: 401 });
  }
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json(
      { error: "Billing is not configured: set STRIPE_SECRET_KEY." },
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
  const pack = parsed.success ? findPackage(parsed.data.packageId) : undefined;
  if (!pack) {
    return NextResponse.json({ error: "Unknown credit package." }, { status: 400 });
  }

  const origin = request.headers.get("origin") ?? "http://localhost:3000";
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "gbp",
          unit_amount: pack.pricePence,
          product_data: { name: `FrMake — ${pack.label}` },
        },
      },
    ],
    // The webhook reads these to write the ledger row.
    metadata: { userId, packageId: pack.id, credits: String(pack.credits) },
    success_url: `${origin}/studio?topup=success`,
    cancel_url: `${origin}/studio?topup=cancelled`,
  });

  return NextResponse.json({ url: session.url });
}
