import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { NextResponse } from "next/server";
import { z } from "zod";
import { buildUserPrompt, PROMPT_VERSION, SYSTEM_PROMPT } from "@/lib/generation/prompt";
import { generationResultSchema } from "@/lib/generation/schema";
import { validateGenerationResult } from "@/lib/generation/validate";

export const dynamic = "force-dynamic";
// Generation takes a while; don't let the route be killed early.
export const maxDuration = 300;

const requestSchema = z.object({
  description: z
    .string()
    .min(20, "Describe your product in at least a few sentences (20+ characters).")
    .max(2000, "Keep the description under 2000 characters."),
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
      { error: "Generation is not configured: set ANTHROPIC_API_KEY in .env.local." },
      { status: 503 },
    );
  }

  const client = new Anthropic();

  try {
    const response = await client.messages.parse({
      model: "claude-opus-4-8",
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      system: SYSTEM_PROMPT,
      messages: [
        { role: "user", content: buildUserPrompt(parsedBody.data.description) },
      ],
      output_config: { format: zodOutputFormat(generationResultSchema) },
    });

    if (response.stop_reason === "refusal") {
      return NextResponse.json(
        { error: "The model declined to generate for this description. Try rephrasing it." },
        { status: 422 },
      );
    }

    if (response.stop_reason === "max_tokens") {
      return NextResponse.json(
        { error: "Generation ran too long and was cut off. Try a shorter description." },
        { status: 502 },
      );
    }

    // parsed_output is null when the model returned unparseable output.
    // Re-validate even when present — never trust raw model output blindly.
    const validated = validateGenerationResult(response.parsed_output);
    if (!validated.ok) {
      return NextResponse.json(
        { error: `The model returned an unusable result. ${validated.error}` },
        { status: 502 },
      );
    }

    return NextResponse.json({
      result: validated.data,
      promptVersion: PROMPT_VERSION,
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
    throw error;
  }
}
