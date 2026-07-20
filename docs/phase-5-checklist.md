# Phase 5 — Manual Checklist (Stripe Billing + Onboarding)

Run 2026-07-20 with real Stripe test-mode keys, real Clerk, real Postgres,
`stripe listen` forwarding real webhook deliveries to a production build.

## Architecture change during verification: embedded Elements, not hosted Checkout

The initial implementation used Stripe's hosted Checkout (redirect to
`checkout.stripe.com`). Live testing hit a hard blocker: this Stripe
account (`acct_1N81ahSC6pnSVNLR`) has `charges_enabled: false` /
`details_submitted: false` — it was never taken through account
activation — and hosted Checkout specifically refuses to render without
a public business name, which the dashboard wouldn't save for this
account (likely gated behind the same unfinished activation flow).

Diagnosis: a direct PaymentIntents API call on the same account
succeeded, proving the account **can** process real charges — the
restriction is specific to the hosted Checkout product, which must
legally display a business name. The fix: swap to an **embedded Stripe
Elements payment form** inside `/studio` (`CheckoutModal.tsx`,
`@stripe/react-stripe-js`), using PaymentIntents directly. Same real
card processing, same webhook, no hosted page. `/api/billing/checkout`
now returns a PaymentIntent `client_secret` instead of a redirect URL;
the webhook listens for `payment_intent.succeeded` instead of
`checkout.session.completed`; `stripe_ref` stores the PaymentIntent id
(`pi_...`) instead of a Checkout Session id (`cs_...`) — `applyTopup`
itself is unchanged, since it never inspected the ref's shape.

Two further live-only errors surfaced and were fixed the same way
(caught only by an actual payment attempt, not by any mock):
1. `PaymentIntent` needed a `description` — this account is
   India-domiciled, and RBI export regulations require one on any
   foreign-currency (GBP) charge.
2. Same regulation additionally requires customer **name and address**.
   The Payment Element didn't surface those fields on its own in
   automated testing, so `CheckoutModal` now collects them in a plain
   form and passes them via `confirmParams.payment_method_data.billing_details`.

## Live results (real Stripe, real Clerk, real Postgres)

| # | Step | Result |
|---|------|--------|
| 1 | Fresh real Clerk user signs in | Onboarding walkthrough shows; 3 steps completed; starter grant 2000 |
| 2 | Buy 1,000 credits (£6), real `4242` test card + billing details, embedded Elements | Payment succeeds client-side; webhook (`stripe listen`, real signature) credits the ledger; badge 2000 → 3000 |
| 3 | Ledger dump for that user | `2000 signup_grant` + `1000 stripe_topup (stripe_ref=pi_3TvE0gSC6pnSVNLR0PXH2nm6)`; sum = 3000, matches `/api/credits` |
| 4 | Resend the **same** webhook event (`stripe events resend evt_3TvE0gSC6pnSVNLR0Wj6N44L`) | Forwarder shows a second real delivery, 200 OK; ledger still exactly 2 rows, balance still 3000 — **zero double-credit** |
| 5 | Reload `/studio` | Onboarding does not reappear; balance persists at 3000 |

Zero page errors across the whole session. 40 vitest (incl. 3 Postgres
top-up idempotency tests) + 15 e2e green; lint/typecheck/build clean.

## Design decisions

- **Idempotency is a database constraint, not application logic**:
  `stripe_ref` carries a partial unique index (migration 002); `applyTopup`
  inserts with `ON CONFLICT DO NOTHING` and reports `"duplicate"`. This
  is what actually stopped the resent webhook from double-crediting —
  verified against a real Stripe-redelivered event, not a synthetic one.
- **Packages**: 500/£3, 1000/£6, 2000/£12 — flat base rate, no volume
  discounts, matching the concept doc's "no overage pricing traps"
  promise.
- **Onboarding state lives in Clerk `publicMetadata`**, so it follows
  the user across devices/sessions rather than being local UI state.
  Skip counts as completed.

## Known limitations / next

- The billing-details form is minimal (no address validation, no saved
  cards, no receipts/invoices).
- No subscription/plan tiers yet — top-ups only, per the phase's scope.
- Stripe account activation is still incomplete (`charges_enabled: false`
  in test mode is unusual but functional for testing; this account
  cannot go live until Siva completes activation in the dashboard —
  unrelated to anything this phase built).
