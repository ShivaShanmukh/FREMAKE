import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { NextResponse } from "next/server";
import { z } from "zod";
import { editCost } from "@/lib/credits/costs";
import { requireCredits } from "@/lib/credits/guard";
import { buildEditUserPrompt, EDIT_PROMPT_VERSION, EDIT_SYSTEM_PROMPT } from "@/lib/edit/prompt";
import { screenSchema, wireframeElementSchema } from "@/lib/generation/schema";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Targeted edit endpoint. The request carries ONLY the selected component
 * (one element or one screen) — the server never sees, and therefore can
 * never leak to the model, any unrelated component.
 */
const requestSchema = z.object({
  instruction: z
    .string()
    .min(4, "Describe the edit in at least a few words.")
    .max(500, "Keep the edit instruction under 500 characters."),
  target: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("element"), screenName: z.string().min(1), element: wireframeElementSchema }),
    z.object({ kind: z.literal("screen"), screen: screenSchema }),
  ]),
});

export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be JSON." }, { status: 400 });
  }

  const parsedBody = requestSchema.safeParse(body);
  if (!parsedBody.success) {
    return NextResponse.json(
      { error: parsedBody.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 },
    );
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "Editing is not configured: set ANTHROPIC_API_KEY in .env.local." },
      { status: 503 },
    );
  }

  const { instruction, target } = parsedBody.data;

  // Server-side gate BEFORE the model call: the proposal itself is free,
  // but a user whose balance cannot cover the eventual approval may not
  // spend tokens at all ("diff before debit" still means no freeloading).
  // The charge row is written by /api/approve, never here.
  const guard = await requireCredits(request, editCost(target.kind));
  if (guard instanceof NextResponse) {
    return guard;
  }

  const outputSchema = target.kind === "element" ? wireframeElementSchema : screenSchema;
  const client = new Anthropic();

  try {
    const response = await client.messages.parse({
      model: "claude-opus-4-8",
      max_tokens: 8000,
      thinking: { type: "adaptive" },
      system: EDIT_SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildEditUserPrompt(target, instruction) }],
      output_config: { format: zodOutputFormat(outputSchema) },
    });

    if (response.stop_reason === "refusal") {
      return NextResponse.json(
        { error: "The model declined this edit. Try rephrasing the instruction." },
        { status: 422 },
      );
    }
    if (response.stop_reason === "max_tokens") {
      return NextResponse.json(
        { error: "The edit ran too long and was cut off. Try a simpler instruction." },
        { status: 502 },
      );
    }

    // Re-validate even though parse() already checked — never trust raw model output blindly.
    const validated = outputSchema.safeParse(response.parsed_output);
    if (!validated.success) {
      return NextResponse.json(
        { error: "The model returned an unusable edit. Try rephrasing the instruction." },
        { status: 502 },
      );
    }

    return NextResponse.json({
      result:
        target.kind === "element"
          ? { element: validated.data }
          : { screen: validated.data },
      promptVersion: EDIT_PROMPT_VERSION,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
    });
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) {
      return NextResponse.json(
        { error: "Rate limited by the model provider. Wait a minute and retry." },
        { status: 429 },
      );
    }
    if (error instanceof Anthropic.AuthenticationError) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY is invalid or revoked." },
        { status: 503 },
      );
    }
    if (error instanceof Anthropic.APIConnectionError) {
      return NextResponse.json(
        { error: "Could not reach the model provider. Check your connection and retry." },
        { status: 502 },
      );
    }
    if (error instanceof Anthropic.APIError) {
      return NextResponse.json(
        { error: `Model provider error (${error.status ?? "unknown"}). Retry shortly.` },
        { status: 502 },
      );
    }
    // Structured-output parse failures throw the SDK base error. No
    // charge row exists for a failed proposal — proposals are never
    // charged at all; only /api/approve debits.
    if (error instanceof Anthropic.AnthropicError) {
      return NextResponse.json(
        { error: "The model returned an unusable edit. Try rephrasing the instruction." },
        { status: 502 },
      );
    }
    throw error;
  }
}
