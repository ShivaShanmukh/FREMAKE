"use client";

import { useState } from "react";
import type { GenerationResult, Screen, WireframeElement } from "@/lib/generation/schema";
import { applyEdit } from "@/lib/edit/apply";
import { selectTarget, type Selection } from "@/lib/edit/types";
import { DiffView } from "./wireframe/DiffView";

type EditFlowProps = {
  result: GenerationResult;
  selection: Selection;
  /** Approval hands over the exact candidate the diff displayed. */
  onApply: (next: GenerationResult) => void;
};

type EditResponse = {
  result?: { element: WireframeElement } | { screen: Screen };
  error?: string;
};

export function EditFlow({ result, selection, onApply }: EditFlowProps) {
  const [instruction, setInstruction] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [candidate, setCandidate] = useState<GenerationResult | null>(null);

  const target = selectTarget(result, selection);
  if (!target) {
    return null;
  }

  const targetLabel =
    target.kind === "element"
      ? `${target.element.type} “${target.element.label}” on “${target.screenName}”`
      : `screen “${target.screen.name}”`;

  async function propose(): Promise<void> {
    setLoading(true);
    setError(null);
    setCandidate(null);
    try {
      // Only `target` leaves the client — the rest of `result` stays here.
      const res = await fetch("/api/edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instruction, target }),
      });
      const data: EditResponse = await res.json();
      if (!res.ok || !data.result) {
        setError(data.error ?? `Edit failed (HTTP ${res.status}).`);
        return;
      }
      const next = applyEdit(result, selection, data.result);
      if (!next) {
        setError("The edit response did not match the selected component.");
        return;
      }
      setCandidate(next);
    } catch {
      setError("Network error — is the dev server still running?");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
      <h2 className="text-lg font-semibold">Targeted edit</h2>
      <p className="mt-1 text-sm text-neutral-500">Editing {targetLabel}.</p>

      <div className="mt-3 flex items-start gap-3">
        <input
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          placeholder='e.g. "Rename this button to Start free trial"'
          className="w-full max-w-xl rounded-md border border-neutral-300 p-2 text-sm focus:border-neutral-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900"
          disabled={loading}
        />
        <button
          onClick={propose}
          disabled={loading || instruction.trim().length < 4}
          className="shrink-0 rounded-md bg-neutral-900 px-4 py-2 text-sm text-white disabled:opacity-40 dark:bg-white dark:text-black"
        >
          {loading ? "Proposing…" : "Propose edit"}
        </button>
      </div>

      {error && (
        <div className="mt-3 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          {error}
        </div>
      )}

      {candidate && (
        <div className="mt-4 flex flex-col gap-4">
          <DiffView
            before={result.screens[selection.screenIndex]}
            after={candidate.screens[selection.screenIndex]}
          />
          <div className="flex gap-3">
            <button
              onClick={() => onApply(candidate)}
              className="rounded-md bg-emerald-700 px-4 py-2 text-sm text-white"
            >
              Approve
            </button>
            <button
              onClick={() => setCandidate(null)}
              className="rounded-md border border-neutral-300 px-4 py-2 text-sm dark:border-neutral-700"
            >
              Reject
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
