# FrMake

**The token-efficient AI design copilot — diff before debit.**

Describe a product in a few sentences. FrMake generates personas, an
information architecture, and five low-fidelity wireframe screens you can
click into, edit surgically, and export as a working React Native starter.
Every credit spent maps to a visible, inspectable change: nothing is charged
until you approve a diff.

**Live:** [fremake-production.up.railway.app](https://fremake-production.up.railway.app)

---

## Why FrMake exists

Most AI design/prototyping tools burn tokens regenerating the whole file for
a one-line change, and charge you regardless of whether you liked the
result. FrMake does the opposite on both counts:

- **Surgical edits, not whole-file reasoning.** Click a single element or a
  whole screen; the model only ever sees and rewrites that one component.
  The rest of your design is stitched back in unchanged, in code.
- **Diff before debit.** Every edit renders a side-by-side before/after
  first. You approve or reject. Credits are only charged on approval, and a
  proposal that produces no visible change can't be approved at all — there's
  nothing to charge for.

## Screenshots

### Sign in
Clerk-backed auth — GitHub, Google, or email.

![Sign in](docs/screenshots/01-sign-in.png)

### First-run onboarding
A three-step walkthrough on first sign-in; skippable, shown once.

![Onboarding](docs/screenshots/02-onboarding.png)

### Studio — describe your product
Three to five sentences in, five wireframe screens out.

![Empty studio](docs/screenshots/03-studio-empty.png)

### Generated wireframes
Personas, information architecture, and five low-fidelity screens on a Konva
canvas — semantic elements from Claude, layout computed deterministically in
code (`src/lib/wireframe/layout.ts`), never by the model.

![Generated wireframes](docs/screenshots/06-generated-wireframes.png)

### Diff before debit
Click any element or screen frame, describe the change, and FrMake proposes
an edit scoped to *only* that component. Nothing is charged yet — you're
looking at a proposal.

![Diff before debit](docs/screenshots/07-diff-before-debit.png)

### Approved
Approve, and the change lands with exactly the 1-credit (element) or
5-credit (screen) charge shown up front — never more, never a surprise.

![Edit approved](docs/screenshots/08-edit-approved.png)

### Buy credits
Flat-rate top-ups, no subscription traps: 500 credits for £3, 1,000 for £6,
2,000 for £12.

![Buy credits menu](docs/screenshots/04-buy-credits-menu.png)

### Checkout
Embedded Stripe Elements — no redirect, stays in the app.

![Checkout modal](docs/screenshots/05-checkout-modal.png)

---

## How it works

```mermaid
flowchart LR
    A["Product description<br/>(3-5 sentences)"] --> B["Claude API<br/>structured outputs"]
    B --> C["Semantic elements only<br/>(type + label, no coordinates)"]
    C --> D["Deterministic layout engine<br/>src/lib/wireframe/layout.ts"]
    D --> E["Konva canvas<br/>5 wireframe screens"]
    E --> F{"Click element<br/>or screen"}
    F --> G["Scoped edit request<br/>only the target leaves the client"]
    G --> H["Side-by-side diff<br/>nothing charged yet"]
    H -->|Approve| I["Server-persisted proposal<br/>charged exactly as quoted"]
    H -->|Reject| J["Discarded, zero charge"]
    I --> K["Append-only credit ledger<br/>Postgres, balance = SUM(amount)"]
```

The model never returns pixel coordinates or full-file rewrites — it returns
semantic elements (`{type: "button", label: "Start free trial"}`), and the
same deterministic layout function turns those into boxes every time. That's
what makes single-element diffs possible: the layout algorithm, not the
model, decides where things sit, so editing one element can't silently
reshuffle the rest of the screen.

## Credit ledger — why it's append-only

Balances are never stored as a mutable number. Every grant, generation,
edit, top-up, and refund is one row in `credit_transactions`
(`db/migrations/001_credit_ledger.sql`); the balance is always
`SUM(amount)` for that user, computed on read. Charges take a per-user
Postgres advisory lock so concurrent requests can't double-spend. Auth and
balance checks happen *before* any Claude API call — an unaffordable request
never reaches the model.

Edit proposals go one step further (`db/migrations/003_edit_proposals.sql`):
`/api/edit` prices and persists the proposal server-side and hands back only
an opaque `proposalId`. `/api/approve` looks up the true cost by that id —
the client has no field it could forge to pay less than what was actually
proposed.

## Export — free, deterministic, zero lock-in

The same semantic screen data that renders the canvas also compiles to a
working Expo/React Native starter (`src/lib/export/`) — no model call, so
it's free and instant. You get `App.tsx` with a bottom-tab switcher, one
screen component per wireframe screen, and a small primitive kit
(`UIHeader`, `UIButton`, `UIInput`, `UIList`, …). Every generated file is
validated with `ts.transpileModule` in tests, and the zip has been
npm-installed and `tsc --noEmit`-checked against real RN types as part of
live verification.

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router), TypeScript strict |
| AI | Claude API (`claude-opus-4-8`), structured outputs via `zodOutputFormat` |
| Canvas | Konva / react-konva |
| Auth | Clerk |
| Database | Postgres (Supabase, via Supavisor pooler) |
| Payments | Stripe (embedded Elements + webhooks) |
| Error monitoring | Sentry |
| Product analytics | PostHog |
| Deploy | Railway, auto-deploy on push to `master` |
| Testing | Vitest (unit + Postgres integration) + Playwright (e2e) |

## Project structure

```
src/
  app/
    studio/           # main product surface
    api/
      generate/       # prompt → wireframes (debits on success)
      edit/            # scoped edit proposal (prices + persists, no debit)
      approve/          # the ONLY edit-debit path (server-priced, tamper-proof)
      credits/           # balance read
      billing/            # Stripe checkout + webhook
      onboarding/          # Clerk publicMetadata read/write
  components/            # BuyCredits, CheckoutModal, EditFlow, WireframeCanvas, ...
  lib/
    generation/           # Claude call + zod schema
    wireframe/             # deterministic layout engine
    edit/                   # target selection, diff, apply
    credits/                 # server-side ledger: charge(), guard(), costs
    export/                   # semantic screens → Expo starter zip
    billing/                   # Stripe checkout/webhook helpers
    rateLimit/                  # DB-backed rate limiting
    analytics/                   # PostHog client + server event tracking
db/migrations/                    # append-only SQL, applied via scripts/migrate.mjs
e2e/                                # Playwright, mocked API — deterministic, no secrets
docs/                                # phase-by-phase live-verification checklists
```

## Getting started

```bash
npm install
cp .env.example .env.local   # every var is optional — the app boots with zero secrets
npm run dev                  # http://localhost:3000
```

Without any secrets, `/studio` still renders and `/api/health` reports
`"database": "not_configured"` — every integration (Clerk, Stripe, Sentry,
PostHog, the credit ledger) degrades to a no-op rather than crashing the
build. Fill in `.env.local` incrementally as you wire each one up.

### Database

Local dev uses Dockerized Postgres:

```bash
docker run -d --name frmake-pg -p 5434:5432 \
  -e POSTGRES_PASSWORD=frmake_dev -e POSTGRES_DB=frmake postgres:16
DATABASE_URL=postgresql://postgres:frmake_dev@localhost:5434/frmake npm run db:migrate
```

Production runs on Supabase — point `DATABASE_URL` at the connection
pooler string (transaction mode, port 6543) and run `npm run db:migrate`;
no code changes needed to switch backends.

### Auth, payments, AI

1. **Clerk** — create an app at dashboard.clerk.com, set
   `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY`.
2. **Anthropic** — set `ANTHROPIC_API_KEY`.
3. **Stripe** — set `STRIPE_SECRET_KEY` / `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`;
   register a webhook endpoint for `payment_intent.succeeded` and set
   `STRIPE_WEBHOOK_SECRET` to *that endpoint's* secret (each endpoint —
   local via `stripe listen`, production — gets its own).
4. **Sentry / PostHog** — optional, set the DSN/key pairs in `.env.example`.

Without `DEV_AUTH_BYPASS=1` and no Clerk keys, sign-in simply isn't
available; with Clerk keys present, real auth always wins over the dev
bypass.

## Commands

```bash
npm run dev          # dev server
npm run build        # production build
npm run lint         # ESLint (includes eslint-plugin-react-hooks)
npm run typecheck    # tsc --noEmit
npm run test         # Vitest — unit + Postgres integration (skipped without DATABASE_URL)
npm run test:e2e     # Playwright — mocked API, deterministic, no secrets required
npm run db:migrate   # apply every db/migrations/*.sql, in order, idempotently
```

CI (GitHub Actions) runs lint + typecheck + build + test on every push and
PR. Railway auto-deploys `master` on a successful push.

## Live-verification discipline

Every phase in `docs/*-checklist.md` was signed off against the real stack,
not mocks: real Claude generations, real Clerk users, real Stripe payments
(via `stripe listen` and, on the switched-to UK account, real card charges),
a real deliberate Postgres outage to check the credit-ledger error banner,
and a real automated-browser fingerprint bug found and fixed while
live-verifying the last PostHog event (`docs/phase-6-checklist.md`). The e2e
suite mocks the API deliberately — for speed and to run without secrets —
but nothing in `docs/` claims "verified" without having actually happened
against a live dependency at least once.

## Conventions

- TypeScript strict, no `any` — `unknown` + narrowing or a real type
- Next.js 16 uses `src/proxy.ts` (the `middleware.ts` replacement)
- Secrets live in `.env.local` only; `.env.example` documents every var
- Server code never trusts a client-supplied cost or kind; costs are always
  re-derived or looked up from what the server itself persisted
