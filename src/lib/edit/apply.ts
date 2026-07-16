import type { GenerationResult, Screen, WireframeElement } from "@/lib/generation/schema";
import type { Selection } from "./types";

/**
 * Pure, immutable application of an accepted edit. The candidate result
 * built here is the SAME object the diff view renders and that approval
 * commits — diff and applied state cannot drift apart by construction.
 * Untouched screens keep reference identity (structural sharing).
 */

export function applyElementEdit(
  result: GenerationResult,
  screenIndex: number,
  elementIndex: number,
  element: WireframeElement,
): GenerationResult {
  const screen = result.screens[screenIndex];
  return {
    ...result,
    screens: result.screens.map((s, i) =>
      i === screenIndex
        ? { ...screen, elements: screen.elements.map((el, j) => (j === elementIndex ? element : el)) }
        : s,
    ),
  };
}

export function applyScreenEdit(
  result: GenerationResult,
  screenIndex: number,
  screen: Screen,
): GenerationResult {
  return {
    ...result,
    screens: result.screens.map((s, i) => (i === screenIndex ? screen : s)),
  };
}

/** Dispatches on selection shape; returns null if the replacement does not match it. */
export function applyEdit(
  result: GenerationResult,
  selection: Selection,
  replacement: { element: WireframeElement } | { screen: Screen },
): GenerationResult | null {
  if (selection.elementIndex !== null) {
    if (!("element" in replacement)) {
      return null;
    }
    return applyElementEdit(result, selection.screenIndex, selection.elementIndex, replacement.element);
  }
  if (!("screen" in replacement)) {
    return null;
  }
  return applyScreenEdit(result, selection.screenIndex, replacement.screen);
}
