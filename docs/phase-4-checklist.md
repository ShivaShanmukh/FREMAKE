# Phase 4 — Manual Checklist (React Native Export)

## Re-run 2026-07-19 against the rebuilt stack (real Clerk + Postgres ledger)

The original run below predates the Phase 3 rebuild. Re-verified with a
real Clerk session (alice test user), a real Claude generation charged
through the server ledger, and a real export download — nothing mocked:

| # | Step | Result |
|---|------|--------|
| 1 | Real generation as signed-in Clerk user | Server ledger row `-10 generation`; badge 1999 → 1989 | 
| 2 | Export clicked | `frmake-react-native-starter.zip` downloads; badge stays 1989; **zero new ledger rows** (DB row count 3 before and after) |
| 3 | Fresh zip → `npm install` → `npx tsc --noEmit` (strict) | Clean against real RN/Expo types (screens: OnboardingBudgetSetup, RecipeBox, RecipeDetail, ShoppingList, WeeklyMealPlanner) |
| 4 | Page errors across the session | None |

The export e2e test (`e2e/export.spec.ts`) was already updated to the
server-backed client contract during the rebuild and runs green in CI
(mocked endpoints there, as with all e2e).

## Original run (2026-07-17, pre-rebuild localStorage system)

Run 2026-07-17. Concept-doc milestone: "Week 5 — React Native export:
screens to Expo-compatible starter". The export is deterministic codegen
from the semantic wireframe schema — no model call, zero tokens — so it is
**free** (no debit). The concept's GTM plan gates export as *paid* only in
months 6–12, which arrives with real billing (blocked on Supabase/Clerk).

| # | Step | Expected | Result |
|---|------|----------|--------|
| 1 | "Export React Native starter — free" clicked after generation | `frmake-react-native-starter.zip` downloads; balance untouched | ✅ (e2e, real download event) |
| 2 | Zip contents | `App.tsx`, `screens/<Name>.tsx` ×5, `screens/ui.tsx`, `package.json`, `app.json`, `tsconfig.json`, `README.md` | ✅ |
| 3 | `npm install` inside the real exported zip | Installs Expo SDK 53 / RN 0.79 / React 19 cleanly | ✅ |
| 4 | `npx tsc --noEmit` (strict, `expo/tsconfig.base`) | Zero errors against real react-native types | ✅ |

## What the starter is

- `App.tsx` — dependency-free `useState` screen switcher with bottom tabs
  (no react-navigation, so `npm install && npx expo start` needs nothing else).
- `screens/ui.tsx` — low-fi UI kit (`UIHeader`, `UIText`, `UIButton`,
  `UIInput`, `UIImagePlaceholder`, `UIList`, `UINavBar`); one obvious place
  to restyle.
- One component per wireframe screen; flow elements scroll, the first
  `nav` element pins to the bottom — mirroring the wireframe layout rules.

## Safety & correctness

- All user/model-controlled text is embedded via `JSON.stringify`, so
  labels containing quotes, braces, or JSX can never escape their string
  literal. Unit-tested with hostile labels by walking the generated JSX
  AST (`src/lib/export/project.test.ts`) — only known primitives may
  appear as real elements.
- Every generated `.tsx` file is parse-validated with the TypeScript
  compiler in unit tests; JSON files must round-trip `JSON.parse`.
- Screen names are sanitized to PascalCase identifiers and deduped
  (`Home`, `Home2`) for file and component names.

## Deliberately out of scope (per phase plan)

- Paid export gating — arrives with billing (Week-6 milestone: auth,
  billing, onboarding; needs Supabase + Clerk).
- Higher-fidelity styling/theming of the starter — the export is
  deliberately low-fi to match the wireframes.
- LCS diff alignment (carried over from Phase 2).
