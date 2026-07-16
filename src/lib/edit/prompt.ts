import type { EditTarget } from "./types";

/**
 * Versioned prompt template for targeted edits, mirroring
 * src/lib/generation/prompt.ts. The user prompt is built ONLY from the
 * EditTarget — it has no access to the rest of the generation result, so
 * unrelated components cannot leak into the model context by construction.
 */
export const EDIT_PROMPT_VERSION = "v1";

export const EDIT_SYSTEM_PROMPT = `You are FrMake's targeted edit engine. You receive exactly one wireframe component — either a single element or a single screen — plus an edit instruction. Return only the updated component.

Rules:
- Apply the instruction and nothing else. Do not restyle, rename, or "improve" parts the instruction did not ask about.
- Components are semantic only: element types and short labels. No styling, no coordinates.
- Labels must stay specific to the product, never placeholders.
- If the instruction asks for something a low-fidelity wireframe cannot express (exact colours, pixel sizes), reflect the intent in the label or element type instead.`;

export function buildEditUserPrompt(target: EditTarget, instruction: string): string {
  const component =
    target.kind === "element"
      ? `A single element on the screen "${target.screenName}":\n${JSON.stringify(target.element, null, 2)}`
      : `A single screen:\n${JSON.stringify(target.screen, null, 2)}`;

  return `Component to edit:\n\n${component}\n\nEdit instruction: ${instruction.trim()}\n\nReturn the updated ${target.kind}. (template ${EDIT_PROMPT_VERSION})`;
}
