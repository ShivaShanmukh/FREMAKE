import { describe, expect, it } from "vitest";
import type { Screen } from "@/lib/generation/schema";
import { diffScreens, highlightedAfterIndices, removedBeforeIndices } from "./diff";

const base: Screen = {
  name: "Home",
  purpose: "Landing",
  elements: [
    { type: "header", label: "Home" },
    { type: "button", label: "Add habit" },
    { type: "list", label: "Today's habits" },
  ],
};

describe("diffScreens", () => {
  it("marks everything unchanged for an identical screen", () => {
    const diff = diffScreens(base, structuredClone(base));
    expect(diff.entries.map((e) => e.status)).toEqual(["unchanged", "unchanged", "unchanged"]);
    expect(diff.nameChanged).toBe(false);
    expect(highlightedAfterIndices(diff)).toEqual([]);
  });

  it("marks a label change and a type change as changed", () => {
    const after = structuredClone(base);
    after.elements[1] = { type: "input", label: "Add habit" }; // type change
    after.elements[2] = { type: "list", label: "This week" }; // label change
    const diff = diffScreens(base, after);
    expect(highlightedAfterIndices(diff)).toEqual([1, 2]);
    expect(diff.entries[0].status).toBe("unchanged");
  });

  it("marks trailing extra elements as added and missing ones as removed", () => {
    const grown = structuredClone(base);
    grown.elements.push({ type: "nav", label: "Home · Stats" });
    expect(diffScreens(base, grown).entries[3]).toMatchObject({ index: 3, status: "added" });

    const shrunk = structuredClone(base);
    shrunk.elements.pop();
    const diff = diffScreens(base, shrunk);
    expect(diff.entries[2]).toMatchObject({ index: 2, status: "removed" });
    expect(removedBeforeIndices(diff)).toEqual([2]);
  });

  it("flags name and purpose changes separately from elements", () => {
    const renamed = { ...structuredClone(base), name: "Dashboard", purpose: "Hub" };
    const diff = diffScreens(base, renamed);
    expect(diff.nameChanged).toBe(true);
    expect(diff.purposeChanged).toBe(true);
    expect(highlightedAfterIndices(diff)).toEqual([]);
  });
});
