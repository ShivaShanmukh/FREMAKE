import type { GenerationResult, Screen, WireframeElement } from "@/lib/generation/schema";

/**
 * A canvas selection: a whole screen (elementIndex null) or one element
 * within a screen. Indices refer to result.screens / screen.elements.
 */
export type Selection = {
  screenIndex: number;
  elementIndex: number | null;
};

/**
 * The exact payload scope for a targeted edit. This is the ONLY component
 * data that may leave the client for an edit call — never the whole
 * result, never sibling screens ("surgical over broad").
 */
export type EditTarget =
  | { kind: "element"; screenName: string; element: WireframeElement }
  | { kind: "screen"; screen: Screen };

/**
 * Extracts the edit target for a selection. Centralised so context
 * scoping is enforced (and unit-tested) in one place rather than at
 * every call site. Returns null for out-of-range selections.
 */
export function selectTarget(
  result: GenerationResult,
  selection: Selection,
): EditTarget | null {
  const screen = result.screens[selection.screenIndex];
  if (!screen) {
    return null;
  }
  if (selection.elementIndex === null) {
    return { kind: "screen", screen };
  }
  const element = screen.elements[selection.elementIndex];
  if (!element) {
    return null;
  }
  return { kind: "element", screenName: screen.name, element };
}
