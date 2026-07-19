# Phase 3 Rebuild — Real Auth + Server-Side Credit Ledger

Run 2026-07-19. Replaces the localStorage balance with an append-only
Postgres ledger and moves all credit enforcement server-side.
Local dev DB: Dockerized Postgres 16 (`frmake-pg`, port 5434 — 5433 is
occupied by a native Windows Postgres). Schema in
`db/migrations/001_credit_ledger.sql`, applied via `npm run db:migrate`.

## Architecture

- **Append-only ledger**: `credit_transactions(id, user_id, amount, reason,
  created_at)`; `reason ∈ {signup_grant, generation, edit_element,
  edit_screen, refund}`. Balance is ALWAYS `SUM(amount)` — no stored total.
- **Charges**: `src/lib/credits/server.ts` — `charge()` takes a per-user
  advisory lock, re-checks the balance, appends one negative row, all in
  one transaction. `ensureSignupGrant()` grants 2000 once per user, ever.
- **Enforcement order**: `/api/generate` and `/api/edit` authenticate and
  check the balance BEFORE calling Claude (`requireCredits` guard).
  Generation debits after a validated result; edit proposals never debit —
  `/api/approve` is the only edit-debit path, called on diff approval.
  Client applies the change only after the server confirms the debit.
- **Auth**: Clerk when keys are present. Until then, `DEV_AUTH_BYPASS=1`
  (dev-only, documented in `.env.example`) accepts an `x-dev-user` header.
- **Kept from before**: `isEmptyDiff` gate (client removes the approve
  action for empty diffs), approve/reject UI, deterministic export.

## Acceptance results (real server, real Postgres, real Claude calls)

**Two users, separate balances** — first contact grants each 2000; after
alice's audit: alice 1976, bob still 2000.

**Direct API calls (no UI)** — unauthenticated `/api/edit` → `401`.
Drained user (balance 0) → `402 {"error":"Not enough credits: this needs
1, you have 0."}` in **47 ms** (real Claude proposals took 1.4–9.9 s, so
the 402 provably fired before any model call).

**10 mixed edits with real Claude proposals** (4 element + 2 screen
approves, 4 rejects), plus one real generation, one failed generation
(model returned 4 screens — 502, no charge):

```
 id | amount |    reason    |    at
----+--------+--------------+----------
 13 |   2000 | signup_grant | 16:12:25
 15 |     -1 | edit_element | 16:13:01
 16 |     -1 | edit_element | 16:13:05
 17 |     -5 | edit_screen  | 16:13:16
 18 |     -1 | edit_element | 16:13:20
 19 |     -5 | edit_screen  | 16:13:24
 20 |     -1 | edit_element | 16:13:28
 23 |    -10 | generation   | 16:15:47
SUM = 1976 over 8 rows;  GET /api/credits → {"balance":1976}  ✓
```

Rejects and the failed generation produced **zero rows**. Sum of rows
equals the reported balance exactly.

**Tests**: 37 vitest (incl. 5 Postgres integration tests: grant
idempotency, append semantics, unaffordable-writes-nothing, 5-way
concurrent charge cannot overspend, per-user isolation — skipped in CI
where no DB exists) + 12 e2e (server-contract mocks: approve called
exactly once per approval and never on reject/empty; failed debit leaves
the diff open and applies nothing; signed-out state).

**Bug found & fixed during the audit**: structured-output parse failures
(`AnthropicError`, e.g. model returns 4 screens) previously escaped as raw
500s; both routes now return a clean 502 and, provably, no charge.

## Real-Clerk verification (2026-07-19, keys added by Siva)

Two real Clerk users created in the dev instance and signed in through
the real Clerk client (sign-in-token ticket flow) in separate browser
contexts:

```
alice user_3GjJEoIxwc89CdU6V4hkwSZ7UNw → grant 2000, approve −1 → 1999
bob   user_3GjJEsDPWZwkYLySX6oEhJhwhmo → grant 2000, untouched  → 2000
```

Ledger rows keyed by real Clerk user IDs match the API balances exactly;
the studio badge for signed-in alice reads "Credits: 1999".
Unauthenticated `/api/credits` with Clerk active → 401. With keys
present the dev bypass is dead code (Clerk branch resolves first). The
two test users were left in the Clerk dev instance as reusable test
accounts.

## Known limitations / next

- `/api/approve` trusts the claimed target kind (1 vs 5 credits); binding
  approvals to a server-stored proposal needs persisted designs (future
  phase, same as monthly refills and paid export gating).
- Hosted Supabase swap = set `DATABASE_URL` to the Supabase connection
  string and run `npm run db:migrate`; no code changes.
