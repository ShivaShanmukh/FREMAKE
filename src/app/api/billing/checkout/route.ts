import { NextResponse } from "next/server";
import Stripe from "stripe";
import { z } from "zod";
import { requireUserId } from "@/lib/auth";
import { findPackage } from "@/lib/billing/packages";

export const dynamic = "force-dynamic";

const requestSchema = z.object({ packageId: z.string().min(1) });

/**
 * Creates a Stripe PaymentIntent for a credit top-up and returns its
 * client secret, so the client can render an embedded Stripe Elements
 * form (rather than redirect to Stripe's hosted Checkout page, which
 * requires the account to have a public business name set — this
 * account doesn't, and Elements has no such requirement). The ledger is
 * credited by the webhook on `payment_intent.succeeded`, never here.
 */
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

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const intent = await stripe.paymentIntents.create({
    amount: pack.pricePence,
    currency: "gbp",
    // India-domiciled Stripe accounts require a description on
    // cross-border (export) transactions per RBI regulations.
    description: `FrMake — ${pack.label}`,
    automatic_payment_methods: { enabled: true, allow_redirects: "never" },
    // The webhook reads these to write the ledger row.
    metadata: { userId, packageId: pack.id, credits: String(pack.credits) },
  });

  return NextResponse.json({
    clientSecret: intent.client_secret,
    label: pack.label,
    publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  });
}
