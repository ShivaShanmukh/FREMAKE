# /api/approve Cost Integrity Fix

Run 2026-07-21. Closes a real gap flagged (but not fixed) since the
Phase 3 rebuild: `/api/approve` derived the charge from a `kind` field
in the request body, with nothing binding it to what `/api/edit` had
actually scoped and proposed. A client could approve an expensive edit
while claiming a cheaper `kind`.

## The fix: server-persisted proposals

- **`db/migrations/003_edit_proposals.sql`** — `edit_proposals(id, user_id,
  kind, cost, created_at, used_at)`. `kind`/`cost` are set once, at
  creation, from the server's own `editCost(target.kind)` — never from
  anything a client claims later.
- **`/api/edit`** now creates a proposal row after a validated model
  result and returns its id (`proposalId`) alongside the edit. The
  proposal records the *true* kind — which is itself already
  scope-bound: an `element`-kind request payload can only contain one
  element (Phase 2's scoping guarantee), so the kind faithfully reflects
  what was actually editable in that request.
- **`/api/approve`** now takes only `{ proposalId }`. There is no `kind`
  or `cost` field in its request schema at all — extra fields are
  silently stripped by zod, so a forged `kind`/`cost` in the body simply
  has nowhere to go. `approveProposal` (`src/lib/edit/proposals.ts`)
  atomically: locks the proposal row, checks it belongs to the caller,
  is unused, and isn't expired (30 min TTL), checks the balance, then
  marks it used and appends the ledger row — all under the same
  per-user advisory lock `charge()` uses, so concurrent approvals can't
  overspend. An insufficient balance rolls back *without* consuming the
  proposal, so the user can retry after topping up rather than losing
  the proposal (and the tokens already spent generating it).

## Live tamper test (real Clerk user, real Claude proposal, real Postgres)

1. Fresh Clerk user, starting balance 2000.
2. `POST /api/edit` with a **screen**-kind target (server-priced at 5
   credits) → real Claude call → `proposalId: 8` returned. The proposal
   row: `kind=screen, cost=5`.
3. **Tampered** `POST /api/approve` with body
   `{ "proposalId": 8, "kind": "element", "cost": 1 }`.
4. Response: `200 {"balance": 1995}` — a drop of **5**, not 1.
5. Direct Postgres query on the ledger:
   ```
   amount |    reason
   -------+--------------
     2000 | signup_grant
       -5 | edit_screen
   ```
   `edit_proposals` row: `kind=screen, cost=5, used=true`. The forged
   `kind`/`cost` in the request body had no effect whatsoever — the
   schema doesn't even have fields for them.

## Tests

- `src/lib/edit/proposals.test.ts` (6 new Postgres integration tests):
  charges the cost recorded at creation; element vs screen cost by
  creation-time kind; single-use (double-approve → `already_used`, no
  double charge); insufficient balance rolls back without consuming the
  proposal, and the same proposal can be approved later after a top-up;
  unknown proposal id and cross-user proposal both rejected as
  `not_found` (no information leak distinguishing "wrong owner" from
  "doesn't exist"); 3-way concurrent approval of the same proposal
  charges exactly once.
- e2e mocks (`credits.spec.ts`, `edit.spec.ts`) updated to the new
  `proposalId`-based contract — all 15 e2e + 46 unit tests green, plus
  lint/typecheck/build.

## Known limitation

`approveProposal`'s not-found and cross-user-ownership cases return the
same generic error, which is intentional (no user-enumeration signal) —
but it also means a legitimate typo in a proposal id is indistinguishable
from someone else's proposal at the API level. Acceptable for now; not a
security issue, just a slightly generic error message.
