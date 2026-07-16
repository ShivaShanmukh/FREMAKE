import { describe, expect, it } from "vitest";
import type { GenerationResult } from "@/lib/generation/schema";
import { buildEditUserPrompt } from "./prompt";
import { selectTarget } from "./types";

/**
 * Phase 2 context-leakage guard: the payload sent to the model for a
 * targeted edit must contain ONLY the selected component. Every label in
 * this fixture is unique, so any leak of an unrelated component is
 * detectable as a plain substring hit.
 */

function makeResult(): GenerationResult {
  const screens = ["Alpha", "Bravo", "Charlie", "Delta", "Echo"].map((name) => ({
    name: `Screen ${name}`,
    purpose: `Purpose ${name}`,
    elements: [
      { type: "header" as const, label: `Header ${name}` },
      { type: "button" as const, label: `Button ${name}` },
      { type: "list" as const, label: `List ${name}` },
    ],
  }));
  return {
    personas: [
      { name: "Persona One", role: "Role One", goal: "Goal One", painPoint: "Pain One" },
      { name: "Persona Two", role: "Role Two", goal: "Goal Two", painPoint: "Pain Two" },
    ],
    informationArchitecture: [{ section: "IA Section", items: ["IA Item"] }],
    screens,
  };
}

describe("targeted edit payload scoping", () => {
  it("element edit payload contains the target and nothing from any other component", () => {
    const result = makeResult();
    const target = selectTarget(result, { screenIndex: 1, elementIndex: 1 });
    expect(target).not.toBeNull();
    const payload = buildEditUserPrompt(target!, "Rename it");

    expect(payload).toContain("Button Bravo");
    expect(payload).toContain("Screen Bravo"); // identifying screen name only

    // Sibling elements on the SAME screen must not leak either.
    expect(payload).not.toContain("Header Bravo");
    expect(payload).not.toContain("List Bravo");
    // No other screen, persona, or IA content.
    for (const name of ["Alpha", "Charlie", "Delta", "Echo"]) {
      expect(payload).not.toContain(name);
    }
    expect(payload).not.toContain("Persona");
    expect(payload).not.toContain("IA ");
    expect(payload).not.toContain("Purpose");
  });

  it("screen edit payload contains only the target screen", () => {
    const result = makeResult();
    const target = selectTarget(result, { screenIndex: 2, elementIndex: null });
    const payload = buildEditUserPrompt(target!, "Add a search input");

    expect(payload).toContain("Screen Charlie");
    expect(payload).toContain("Button Charlie");
    for (const name of ["Alpha", "Bravo", "Delta", "Echo"]) {
      expect(payload).not.toContain(name);
    }
    expect(payload).not.toContain("Persona");
  });

  it("selectTarget returns null for out-of-range selections instead of guessing", () => {
    const result = makeResult();
    expect(selectTarget(result, { screenIndex: 9, elementIndex: null })).toBeNull();
    expect(selectTarget(result, { screenIndex: 0, elementIndex: 99 })).toBeNull();
  });
});
