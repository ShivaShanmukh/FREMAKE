import { generationResultSchema, type GenerationResult } from "./schema";

export type ValidationResult =
  | { ok: true; data: GenerationResult }
  | { ok: false; error: string };

/**
 * Validates untrusted model output against the generation schema. Never
 * throws — the API route turns a failure into a clear error response
 * instead of a crash (Phase 1 "model returns garbage" guard).
 */
export function validateGenerationResult(data: unknown): ValidationResult {
  const parsed = generationResultSchema.safeParse(data);

  if (!parsed.success) {
    const issues = parsed.error.issues
      .slice(0, 3)
      .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("; ");
    return { ok: false, error: `Model output failed validation — ${issues}` };
  }

  return { ok: true, data: parsed.data };
}
