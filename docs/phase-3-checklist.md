# Phase 3 — Manual Checklist (Diff-Before-Debit Credit System)

Run 2026-07-17 against the live Claude API (`claude-opus-4-8`), production
build, headless Chromium. Pricing per the concept doc's table: element edit
1 credit, screen edit 5, generation 10; starter balance 2,000.

| # | Step | Expected | Result |
|---|------|----------|--------|
| 1 | Fresh browser opens `/studio` | Balance badge shows 2,000 | ✅ |
| 2 | Live generation succeeds | Exactly 10 debited (1,990) | ✅ |
| 3 | Element selected, live edit proposed | Cost quoted upfront ("1 credit — charged only when you approve"); balance unchanged after proposal | ✅ |
| 4 | Diff approved | Exactly the quoted 1 credit debited (1,989) | ✅ |
| 5 | Page reload | Balance persists at 1,989 (localStorage) | ✅ |

Zero page errors across the whole session. Charge-avoidance paths (reject,
empty diff, API failure, insufficient balance) are covered deterministically
in `e2e/credits.spec.ts` with mocked APIs — they don't depend on the model,
so they aren't repeated live.

## Design decisions

- **Debit point:** edits charge at diff approval only — never on proposal,
  reject, dismiss, or failure. Generation charges on success (there is no
  diff to gate; a failed generation charges nothing).
- **Empty-diff gate:** `isEmptyDiff` (`src/lib/edit/diff.ts`) — when the
  proposed screen is indistinguishable from the current one, the approve
  button is removed entirely and a "no visible change — no credit charged"
  notice renders instead (`DiffDecision.tsx`).
- **Insufficient balance:** the propose/generate buttons disable *before*
  any API call is made, so an unaffordable action never spends tokens.
  `debit()` throws on overdraft as a guard against missing UI checks.
- **Storage:** `CreditStore` interface (`src/lib/credits/ledger.ts`) with a
  localStorage implementation (`frmake.credits.v1`). A Supabase adapter can
  slot in later without touching call sites — there is no Supabase project
  yet.

## Deliberately out of scope (per phase plan)

- Server-side ledger / auth-bound balances — needs Supabase + Clerk keys
  (still pending).
- Monthly refill, plan tiers, top-ups — pricing-model work after the
  storage backend exists.
- LCS-based diff alignment (carried over from the Phase 2 known
  limitation).
