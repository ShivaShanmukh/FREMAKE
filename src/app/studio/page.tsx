"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import type { GenerationResult } from "@/lib/generation/schema";
import type { Selection } from "@/lib/edit/types";
import { GENERATION_COST } from "@/lib/credits/costs";
import { useCredits } from "@/lib/credits/useCredits";

// Konva touches `window` — must not be server-rendered.
const WireframeCanvas = dynamic(() => import("@/components/WireframeCanvas"), {
  ssr: false,
  loading: () => <p className="text-sm text-neutral-400">Loading canvas…</p>,
});
const EditFlow = dynamic(
  () => import("@/components/EditFlow").then((m) => m.EditFlow),
  { ssr: false },
);

const SAMPLE =
  "An app for amateur cricket teams to track match scores ball by ball, see player statistics over a season, and share match summaries with their club. Captains create matches, scorers record each ball, and players view their own performance trends.";

export default function StudioPage() {
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  const credits = useCredits();

  async function generate() {
    setLoading(true);
    setError(null);
    setResult(null);
    setSelection(null);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description }),
      });
      const data: { result?: GenerationResult; error?: string } = await res.json();
      if (!res.ok || !data.result) {
        // Failed generation — no result, no charge.
        setError(data.error ?? `Generation failed (HTTP ${res.status}).`);
        return;
      }
      credits.charge(GENERATION_COST);
      setResult(data.result);
    } catch {
      setError("Network error — is the dev server still running?");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">FrMake Studio</h1>
          <p className="text-sm text-neutral-500">
            Describe your product in 3–5 sentences. You get personas, an
            information architecture, and 5 low-fidelity wireframe screens.
          </p>
        </div>
        <span
          className="shrink-0 rounded-full border border-neutral-300 px-3 py-1 text-sm font-medium dark:border-neutral-700"
          data-testid="credit-balance"
        >
          Credits: {credits.balance}
        </span>
      </div>

      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={5}
        placeholder={SAMPLE}
        className="w-full rounded-md border border-neutral-300 p-3 text-sm focus:border-neutral-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900"
        disabled={loading}
      />

      <div className="flex items-center gap-4">
        <button
          onClick={generate}
          disabled={
            loading ||
            description.trim().length < 20 ||
            !credits.canAfford(GENERATION_COST)
          }
          className="rounded-md bg-neutral-900 px-5 py-2 text-sm text-white disabled:opacity-40 dark:bg-white dark:text-black"
        >
          {loading ? "Generating…" : `Generate wireframes — ${GENERATION_COST} credits`}
        </button>
        {!credits.canAfford(GENERATION_COST) && (
          <p className="text-sm text-red-700 dark:text-red-300" data-testid="insufficient-generation">
            Not enough credits to generate (needs {GENERATION_COST}).
          </p>
        )}
        {loading && (
          <p className="text-sm text-neutral-500">
            Thinking through personas, IA, and 5 screens — this can take a
            minute or two.
          </p>
        )}
      </div>

      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          {error}
        </div>
      )}

      {result && (
        <div className="flex flex-col gap-8">
          <section>
            <h2 className="mb-2 text-lg font-semibold">Personas</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {result.personas.map((p) => (
                <div
                  key={p.name}
                  className="rounded-md border border-neutral-200 p-4 text-sm dark:border-neutral-800"
                >
                  <p className="font-semibold">
                    {p.name} — {p.role}
                  </p>
                  <p className="mt-1 text-neutral-600 dark:text-neutral-400">
                    <span className="font-medium">Goal:</span> {p.goal}
                  </p>
                  <p className="text-neutral-600 dark:text-neutral-400">
                    <span className="font-medium">Pain:</span> {p.painPoint}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold">
              Information architecture
            </h2>
            <ul className="space-y-2 text-sm">
              {result.informationArchitecture.map((section) => (
                <li key={section.section}>
                  <span className="font-medium">{section.section}:</span>{" "}
                  <span className="text-neutral-600 dark:text-neutral-400">
                    {section.items.join(" · ")}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold">Wireframes</h2>
            <p className="mb-2 text-sm text-neutral-500">
              Click a screen frame or a single element to target an edit.
            </p>
            <WireframeCanvas
              screens={result.screens}
              selection={selection}
              onSelect={setSelection}
            />
          </section>

          {selection && (
            <EditFlow
              // Remount on selection change so a stale candidate/diff never
              // survives a retarget.
              key={`${selection.screenIndex}:${selection.elementIndex ?? "screen"}`}
              result={result}
              selection={selection}
              balance={credits.balance}
              onCharge={credits.charge}
              onApply={(next) => {
                setResult(next);
                setSelection(null);
              }}
            />
          )}
        </div>
      )}
    </main>
  );
}
