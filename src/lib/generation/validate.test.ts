import { describe, expect, it } from "vitest";
import { validateGenerationResult } from "./validate";
import type { GenerationResult } from "./schema";

function makeScreen(name: string): GenerationResult["screens"][number] {
  return {
    name,
    purpose: `Purpose of ${name}`,
    elements: [
      { type: "header", label: name },
      { type: "list", label: "Recent items" },
      { type: "button", label: "Primary action" },
    ],
  };
}

const validResult: GenerationResult = {
  personas: [
    { name: "Asha", role: "Team captain", goal: "Run matches smoothly", painPoint: "Paper scoring is error-prone" },
    { name: "Dev", role: "Club scorer", goal: "Record every ball fast", painPoint: "Existing apps are cluttered" },
  ],
  informationArchitecture: [
    { section: "Matches", items: ["Live scoring", "Match history"] },
    { section: "Players", items: ["Stats", "Trends"] },
  ],
  screens: [
    makeScreen("Home"),
    makeScreen("Live Scoring"),
    makeScreen("Match Detail"),
    makeScreen("Player Stats"),
    makeScreen("Settings"),
  ],
};

describe("validateGenerationResult", () => {
  it("accepts a fully valid result", () => {
    const outcome = validateGenerationResult(validResult);
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.data.screens).toHaveLength(5);
    }
  });

  it("rejects complete garbage without throwing", () => {
    for (const garbage of [null, undefined, 42, "not json at all", [], { hello: "world" }]) {
      const outcome = validateGenerationResult(garbage);
      expect(outcome.ok).toBe(false);
    }
  });

  it("rejects the wrong number of screens", () => {
    const fourScreens = { ...validResult, screens: validResult.screens.slice(0, 4) };
    const outcome = validateGenerationResult(fourScreens);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.error).toContain("screens");
    }
  });

  it("rejects a partial result with a missing field", () => {
    const partial = {
      personas: validResult.personas,
      screens: validResult.screens,
      // informationArchitecture missing — simulates truncated model output
    };
    const outcome = validateGenerationResult(partial);
    expect(outcome.ok).toBe(false);
  });

  it("rejects unknown element types", () => {
    const badElement = structuredClone(validResult);
    badElement.screens[0].elements[0] = {
      // deliberately invalid type smuggled past the compiler
      type: "carousel" as unknown as "header",
      label: "Hero",
    };
    const outcome = validateGenerationResult(badElement);
    expect(outcome.ok).toBe(false);
  });

  it("rejects screens with too few elements", () => {
    const sparse = structuredClone(validResult);
    sparse.screens[2].elements = sparse.screens[2].elements.slice(0, 2);
    const outcome = validateGenerationResult(sparse);
    expect(outcome.ok).toBe(false);
  });
});
