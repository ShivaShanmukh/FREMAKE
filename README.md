# FrMake

The token-efficient AI design copilot for founders and product teams.
Every credit spent must map to a visible, inspectable change — diff before
debit, surgical edits over whole-file reasoning.

## Status

**Phase 0 — Scaffolding & Environment.** The app boots, shows a placeholder
home page, has a Supabase health check and a Clerk sign-in stub. No feature
code yet. See the phased execution prompt in the parent folder for the full
build plan.

## Stack

- Next.js 16 (App Router) + TypeScript, strict mode
- Next.js API routes (no separate backend for MVP)
- Supabase (Postgres)
- Clerk (auth)
- Deploy target: Railway

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in keys — all optional for Phase 0
npm run dev                  # http://localhost:3000
```

Without any secrets configured the app still boots: `/sign-in` shows a setup
notice and `/api/health` reports `"database": "not_configured"`.

### Wiring Supabase

1. Create a project at supabase.com, run `supabase/schema.sql` in the SQL
   editor.
2. Set `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (or the
   anon key) in `.env.local`.
3. `GET /api/health` should now return `"database": "ok"`.

### Wiring Clerk

1. Create an app at dashboard.clerk.com.
2. Set `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` in
   `.env.local`.
3. `/sign-in` renders the real Clerk sign-in. No routes are gated yet —
   gating lands in Phase 5.

## Commands

```bash
npm run dev        # dev server
npm run build      # production build
npm run lint       # ESLint
npm run typecheck  # tsc --noEmit
```

CI (GitHub Actions) runs lint + typecheck + build on every push and PR.

## Conventions

- TypeScript strict, no `any`
- Next.js 16 uses `src/proxy.ts` (the middleware.ts replacement)
- Secrets live in `.env.local` only; `.env.example` documents every var
- Default exports only where Next.js requires them (pages, layouts, proxy)
