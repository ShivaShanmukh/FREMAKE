import { NextResponse } from "next/server";
import Stripe from "stripe";
import { applyTopup } from "@/lib/billing/applyTopup";
import { isDbConfigured } from "@/lib/db";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * Stripe webhook. Signature-verified against STRIPE_WEBHOOK_SECRET; only
 * `checkout.session.completed` with payment_status "paid" credits the
 * ledger. Idempotency lives in applyTopup (unique stripe_ref), so
 * Stripe's at-least-once delivery can never double-credit.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secretKey || !webhookSecret || !isDbConfigured()) {
    return NextResponse.json({ error: "Billing webhook is not configured." }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header." }, { status: 400 });
  }

  const stripe = new Stripe(secretKey);
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      await request.text(),
      signature,
      webhookSecret,
    );
  } catch {
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 400 });
  }

  if (event.type !== "checkout.session.completed") {
    return NextResponse.json({ received: true, ignored: event.type });
  }

  const session = event.data.object;
  const userId = session.metadata?.userId;
  const credits = Number(session.metadata?.credits);
  if (session.payment_status !== "paid" || !userId || !Number.isInteger(credits) || credits <= 0) {
    logger.warn(`[billing] unusable checkout.session.completed ${session.id}`);
    return NextResponse.json({ received: true, ignored: "unusable session" });
  }

  const outcome = await applyTopup(userId, credits, session.id);
  logger.info(`[billing] session ${session.id}: ${outcome} (${credits} credits for ${userId})`);
  return NextResponse.json({ received: true, outcome });
}
