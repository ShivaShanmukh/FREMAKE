import { describe, expect, it } from "vitest";
import type { Screen } from "@/lib/generation/schema";
import { FRAME_HEIGHT, FRAME_WIDTH, layoutScreen } from "./layout";

const screen: Screen = {
  name: "Home",
  purpose: "Landing screen",
  elements: [
    { type: "header", label: "Home" },
    { type: "image", label: "Hero" },
    { type: "list", label: "Recent matches" },
    { type: "button", label: "Start match" },
    { type: "nav", label: "Home · Stats · Profile" },
  ],
};

describe("layoutScreen", () => {
  it("stacks flow elements top-to-bottom without overlap", () => {
    const { boxes } = layoutScreen(screen);
    const flow = boxes.filter((b) => b.kind !== "nav");
    for (let i = 1; i < flow.length; i++) {
      expect(flow[i].y).toBeGreaterThanOrEqual(flow[i - 1].y + flow[i - 1].height);
    }
  });

  it("pins nav to the bottom of the frame", () => {
    const { boxes } = layoutScreen(screen);
    const nav = boxes.find((b) => b.kind === "nav");
    expect(nav).toBeDefined();
    expect(nav!.y + nav!.height).toBe(FRAME_HEIGHT);
  });

  it("keeps every box inside the frame", () => {
    const { boxes } = layoutScreen(screen);
    for (const box of boxes) {
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(FRAME_WIDTH);
      expect(box.y + box.height).toBeLessThanOrEqual(FRAME_HEIGHT);
    }
  });

  it("drops overflow instead of overlapping when a screen has too many elements", () => {
    const packed: Screen = {
      name: "Overloaded",
      purpose: "Stress test",
      elements: Array.from({ length: 12 }, (_, i) => ({
        type: "image" as const,
        label: `Image ${i}`,
      })),
    };
    const { boxes } = layoutScreen(packed);
    expect(boxes.length).toBeLessThan(12);
    for (const box of boxes) {
      expect(box.y + box.height).toBeLessThanOrEqual(FRAME_HEIGHT);
    }
  });
});
