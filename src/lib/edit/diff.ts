import type { Screen, WireframeElement } from "@/lib/generation/schema";

/**
 * Deterministic element-level diff between two versions of one screen.
 * Elements are aligned by index — wireframe edits replace a component in
 * place, so positional alignment is exact, not heuristic.
 *
 * NOTE: whether a diff is "empty" or "big enough to charge for" is
 * deliberately NOT computed here — that is Phase 3 (debit decision) work.
 */

export type ElementDiffStatus = "unchanged" | "changed" | "added" | "removed";

export type ElementDiffEntry = {
  /** Index in after.elements (or before.elements for "removed"). */
  index: number;
  status: ElementDiffStatus;
  before: WireframeElement | null;
  after: WireframeElement | null;
};

export type ScreenDiff = {
  nameChanged: boolean;
  purposeChanged: boolean;
  entries: ElementDiffEntry[];
};

function sameElement(a: WireframeElement, b: WireframeElement): boolean {
  return a.type === b.type && a.label === b.label;
}

export function diffScreens(before: Screen, after: Screen): ScreenDiff {
  const entries: ElementDiffEntry[] = [];
  const max = Math.max(before.elements.length, after.elements.length);

  for (let i = 0; i < max; i++) {
    const b = before.elements[i] ?? null;
    const a = after.elements[i] ?? null;
    if (b && a) {
      entries.push({ index: i, status: sameElement(b, a) ? "unchanged" : "changed", before: b, after: a });
    } else if (a) {
      entries.push({ index: i, status: "added", before: null, after: a });
    } else if (b) {
      entries.push({ index: i, status: "removed", before: b, after: null });
    }
  }

  return {
    nameChanged: before.name !== after.name,
    purposeChanged: before.purpose !== after.purpose,
    entries,
  };
}

/** Indices into after.elements that should be highlighted on the "new" side. */
export function highlightedAfterIndices(diff: ScreenDiff): number[] {
  return diff.entries
    .filter((e) => e.status === "changed" || e.status === "added")
    .map((e) => e.index);
}

/** Indices into before.elements that were removed (indicated on the "old" side). */
export function removedBeforeIndices(diff: ScreenDiff): number[] {
  return diff.entries.filter((e) => e.status === "removed").map((e) => e.index);
}
