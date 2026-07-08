import type { Screen, WireframeElement } from "@/lib/generation/schema";

/**
 * Deterministic wireframe layout: semantic elements in, positioned boxes
 * out. Elements stack top-to-bottom inside a phone frame; "nav" is always
 * pinned to the bottom regardless of where the model listed it.
 */

export const FRAME_WIDTH = 260;
export const FRAME_HEIGHT = 540;

const PADDING = 12;
const GAP = 10;
const NAV_HEIGHT = 44;

const ELEMENT_HEIGHTS: Record<WireframeElement["type"], number> = {
  header: 44,
  text: 32,
  button: 40,
  input: 38,
  image: 110,
  list: 130,
  nav: NAV_HEIGHT,
};

export type LayoutBox = {
  kind: WireframeElement["type"];
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ScreenLayout = {
  name: string;
  boxes: LayoutBox[];
};

export function layoutScreen(screen: Screen): ScreenLayout {
  const contentWidth = FRAME_WIDTH - PADDING * 2;
  const navElements = screen.elements.filter((el) => el.type === "nav");
  const flowElements = screen.elements.filter((el) => el.type !== "nav");

  const boxes: LayoutBox[] = [];
  let y = PADDING;
  const maxY = FRAME_HEIGHT - PADDING - (navElements.length > 0 ? NAV_HEIGHT + GAP : 0);

  for (const el of flowElements) {
    const height = ELEMENT_HEIGHTS[el.type];
    if (y + height > maxY) {
      break; // frame is full — drop overflow rather than overlap
    }
    boxes.push({
      kind: el.type,
      label: el.label,
      x: PADDING,
      y,
      width: contentWidth,
      height,
    });
    y += height + GAP;
  }

  // Only one bottom nav makes sense; pin the first one.
  if (navElements.length > 0) {
    boxes.push({
      kind: "nav",
      label: navElements[0].label,
      x: 0,
      y: FRAME_HEIGHT - NAV_HEIGHT,
      width: FRAME_WIDTH,
      height: NAV_HEIGHT,
    });
  }

  return { name: screen.name, boxes };
}
