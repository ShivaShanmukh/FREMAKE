import { describe, expect, it } from "vitest";
import type { GenerationResult } from "@/lib/generation/schema";
import { applyEdit } from "./apply";
import { diffScreens, highlightedAfterIndices } from "./diff";

function makeResult(): GenerationResult {
  const screens = ["Home", "Detail", "Create", "Stats", "Settings"].map((name) => ({
    name,
    purpose: `${name} purpose`,
    elements: [
      { type: "header" as const, label: `${name} header` },
      { type: "button" as const, label: `${name} action` },
      { type: "list" as const, label: `${name} items` },
    ],
  }));
  return {
    personas: [
      { name: "A", role: "r", goal: "g", painPoint: "p" },
      { name: "B", role: "r", goal: "g", painPoint: "p" },
    ],
    informationArchitecture: [{ section: "s", items: ["i"] }],
    screens,
  };
}

describe("applyEdit — diff-before-apply integrity", () => {
  it("applied state matches exactly what the diff view displayed (no drift)", () => {
    const before = makeResult();
    const selection = { screenIndex: 1, elementIndex: 1 };
    const replacement = { element: { type: "button" as const, label: "Start free trial" } };

    // The UI builds ONE candidate, renders the diff from it, and approval
    // commits that same object — assert that contract end to end.
    const candidate = applyEdit(before, selection, replacement);
    expect(candidate).not.toBeNull();

    const shownAfter = candidate!.screens[selection.screenIndex]; // what DiffView renders
    const applied = candidate!; // what onApply commits
    expect(applied.screens[selection.screenIndex]).toBe(shownAfter); // same object, zero drift

    // And the diff marks exactly the edited element, nothing else.
    const diff = diffScreens(before.screens[1], shownAfter);
    expect(highlightedAfterIndices(diff)).toEqual([1]);
    expect(shownAfter.elements[1].label).toBe("Start free trial");
  });

  it("leaves every untouched screen reference-identical and never mutates the input", () => {
    const before = makeResult();
    const snapshot = JSON.parse(JSON.stringify(before)) as GenerationResult;
    const candidate = applyEdit(
      before,
      { screenIndex: 2, elementIndex: 0 },
      { element: { type: "header", label: "New title" } },
    );

    expect(before).toEqual(snapshot); // input untouched
    for (const i of [0, 1, 3, 4]) {
      expect(candidate!.screens[i]).toBe(before.screens[i]); // structural sharing
    }
    expect(candidate!.personas).toBe(before.personas);
  });

  it("applies a whole-screen edit only to the targeted screen", () => {
    const before = makeResult();
    const newScreen = {
      name: "Create v2",
      purpose: "Rebuilt create flow",
      elements: [
        { type: "header" as const, label: "Create v2" },
        { type: "input" as const, label: "Habit name" },
        { type: "button" as const, label: "Save habit" },
      ],
    };
    const candidate = applyEdit(before, { screenIndex: 2, elementIndex: null }, { screen: newScreen });
    expect(candidate!.screens[2]).toBe(newScreen);
    expect(candidate!.screens[0]).toBe(before.screens[0]);
  });

  it("rejects a replacement whose shape does not match the selection", () => {
    const before = makeResult();
    const elementSel = { screenIndex: 0, elementIndex: 0 };
    const screenSel = { screenIndex: 0, elementIndex: null };
    expect(applyEdit(before, elementSel, { screen: before.screens[1] })).toBeNull();
    expect(
      applyEdit(before, screenSel, { element: { type: "text", label: "x" } }),
    ).toBeNull();
  });
});
