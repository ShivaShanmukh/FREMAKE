import { NextResponse } from "next/server";
import Stripe from "stripe";
import { trackServerEvent } from "@/lib/analytics/server";
import { applyTopup } from "@/lib/billing/applyTopup";
import { isDbConfigured } from "@/lib/db";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * Stripe webhook. Signature-verified against STRIPE_WEBHOOK_SECRET; only
 * `payment_intent.succeeded` credits the ledger (top-ups use an embedded
 * Stripe Elements PaymentIntent, not hosted Checkout — see
 * checkout/route.ts for why). Idempotency lives in applyTopup (unique
 * stripe_ref = the PaymentIntent id), so Stripe's at-least-once delivery
 * can never double-credit.
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

  if (event.type !== "payment_intent.succeeded") {
    return NextResponse.json({ received: true, ignored: event.type });
  }

  const intent = event.data.object;
  const userId = intent.metadata?.userId;
  const credits = Number(intent.metadata?.credits);
  if (intent.status !== "succeeded" || !userId || !Number.isInteger(credits) || credits <= 0) {
    logger.warn(`[billing] unusable payment_intent.succeeded ${intent.id}`);
    return NextResponse.json({ received: true, ignored: "unusable payment intent" });
  }

  const outcome = await applyTopup(userId, credits, intent.id);
  logger.info(`[billing] payment ${intent.id}: ${outcome} (${credits} credits for ${userId})`);
  if (outcome === "applied") {
    await trackServerEvent(userId, "credit_topup", { credits, stripeRef: intent.id });
  }
  return NextResponse.json({ received: true, outcome });
}
