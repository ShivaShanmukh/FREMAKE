# Phase 2 — Manual Checklist (Component Targeting & Diff View)

Run 2026-07-16 against the live Claude API (`claude-opus-4-8`, edit prompt v1),
production build, headless Chromium. The Phase 1 wireframe model is semantic
(element type + label — no colours, no pixel styling), so the generic
"button label / color / layout property" checklist maps to what the model
actually stores:

| # | Edit | Target | Result |
|---|------|--------|--------|
| 1 | Button label: "Join flat" → "Get started now" | element (screen 1) | ✅ Diff highlighted only the renamed button; applied state matched proposed side exactly |
| 2 | Type change: text → search input | element (screen 2) | ✅ Only the changed element highlighted; downstream layout shift rendered correctly on both sides |
| 3 | Structural: "Add a search input below the header" | whole screen (screen 3) | ✅ Insertion applied at the right position; applied state matched proposed side exactly (see note) |

Also verified across all three edits:

- Scoped context: the `/api/edit` payload contained only the selected
  component (asserted at the network boundary in `e2e/edit.spec.ts`, plus
  unit tests in `src/lib/edit/scope.test.ts`).
- No leftover artifacts: after each approval the main canvas showed the
  new state; the next edit's "Current" side matched it.
- Zero page errors across the whole session.

## Known limitation (accepted for Phase 2)

Element diffing aligns by index (`src/lib/edit/diff.ts`). For a mid-screen
insertion, every element after the insertion point is also marked changed —
the highlighting is conservative, never under-reporting. The proposed side
is always byte-for-byte the state that approval applies (`applyEdit`
returns the single candidate object used for both). If founders find the
insertion highlighting noisy, an LCS-based alignment can replace
`diffScreens` without touching the apply path.

## Deliberately out of scope (per phase plan)

- Empty-diff / "no visible change" detection — Phase 3, wired to the
  debit decision.
- Overlay diff mode — possible v2 enhancement after user feedback on
  side-by-side.
