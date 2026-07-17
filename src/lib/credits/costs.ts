import type { EditTarget } from "@/lib/edit/types";

/**
 * Credit pricing, from the FrMake concept doc's pricing table:
 * an element-level edit is 1 credit, a whole-screen edit is 5 (shown
 * upfront), a full generation is 10. Failed, rejected, or empty results
 * are never charged — the debit happens only at diff approval.
 */
export const ELEMENT_EDIT_COST = 1;
export const SCREEN_EDIT_COST = 5;
export const GENERATION_COST = 10;

/** Starter-plan allowance (concept doc: 2,000 credits/month). */
export const STARTING_BALANCE = 2000;

export function editCost(kind: EditTarget["kind"]): number {
  return kind === "element" ? ELEMENT_EDIT_COST : SCREEN_EDIT_COST;
}
