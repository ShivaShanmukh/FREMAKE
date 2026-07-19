"use client";

import { useEffect, useState } from "react";

const STEPS = [
  {
    title: "Welcome to FrMake",
    body:
      "Describe a product in a few sentences and FrMake generates personas, " +
      "an information architecture, and five low-fidelity wireframe screens " +
      "you can edit and export.",
  },
  {
    title: "Credits: you pay for results, not process",
    body:
      "You start with 2,000 credits. A full generation costs 10, a whole-screen " +
      "edit 5, a single-element edit 1 — and edits are only charged when you " +
      "approve a diff that visibly changes something. Rejected edits, empty " +
      "diffs, and failures cost nothing. Exporting is free.",
  },
  {
    title: "Your first edit",
    body:
      "After generating, click any element on the canvas (or a screen frame), " +
      "type an instruction like “rename this button”, and review the " +
      "side-by-side diff. Approve to apply it — that's when the credit is spent.",
  },
];

/** Shown once per user; completion is stored server-side (Clerk metadata). */
export function OnboardingWalkthrough({ signedOut }: { signedOut: boolean }) {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (signedOut) return;
    let cancelled = false;
    void fetch("/api/onboarding")
      .then(async (res) => {
        if (res.ok) {
          const data: { onboarded?: boolean } = await res.json();
          if (!cancelled && data.onboarded === false) {
            setVisible(true);
          }
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [signedOut]);

  if (!visible) {
    return null;
  }

  const finish = (): void => {
    setVisible(false);
    void fetch("/api/onboarding", { method: "POST" }).catch(() => {});
  };
  const last = step === STEPS.length - 1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6"
      data-testid="onboarding"
    >
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-neutral-900">
        <p className="text-xs font-medium text-neutral-400">
          Step {step + 1} of {STEPS.length}
        </p>
        <h2 className="mt-1 text-lg font-semibold">{STEPS[step].title}</h2>
        <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">{STEPS[step].body}</p>
        <div className="mt-5 flex items-center justify-between">
          <button
            onClick={finish}
            className="text-sm text-neutral-500 underline"
            data-testid="onboarding-skip"
          >
            Skip
          </button>
          <button
            onClick={() => (last ? finish() : setStep(step + 1))}
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm text-white dark:bg-white dark:text-black"
            data-testid="onboarding-next"
          >
            {last ? "Start designing" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}
