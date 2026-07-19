"use client";

import type { Screen } from "@/lib/generation/schema";
import { DiffView } from "./DiffView";

type DiffDecisionProps = {
  before: Screen;
  after: Screen;
  cost: number;
  /** An empty diff can only be dismissed — never approved, never charged. */
  emptyDiff: boolean;
  /** True while the server debit is in flight. */
  approving: boolean;
  onApprove: () => void;
  onDismiss: () => void;
};

/**
 * The debit gate: renders the side-by-side diff and the decision that
 * follows it. Approval is the only path that costs a credit; an empty
 * diff removes the approve option entirely.
 */
export function DiffDecision({ before, after, cost, emptyDiff, approving, onApprove, onDismiss }: DiffDecisionProps) {
  return (
    <div className="mt-4 flex flex-col gap-4">
      <DiffView before={before} after={after} />
      {emptyDiff ? (
        <div className="flex flex-col gap-3">
          <div
            className="rounded-md border border-neutral-300 bg-neutral-50 p-3 text-sm text-neutral-700 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300"
            data-testid="empty-diff-notice"
          >
            The proposed edit makes no visible change — no credit was charged.
            Try a more specific instruction.
          </div>
          <button
            onClick={onDismiss}
            className="self-start rounded-md border border-neutral-300 px-4 py-2 text-sm dark:border-neutral-700"
          >
            Dismiss
          </button>
        </div>
      ) : (
        <div className="flex gap-3">
          <button
            onClick={onApprove}
            disabled={approving}
            className="rounded-md bg-emerald-700 px-4 py-2 text-sm text-white disabled:opacity-40"
          >
            {approving ? "Approving…" : `Approve — ${cost} credit${cost === 1 ? "" : "s"}`}
          </button>
          <button
            onClick={onDismiss}
            disabled={approving}
            className="rounded-md border border-neutral-300 px-4 py-2 text-sm disabled:opacity-40 dark:border-neutral-700"
          >
            Reject
          </button>
        </div>
      )}
    </div>
  );
}
