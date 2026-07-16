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
  /** Index into the source screen.elements — lets canvas clicks resolve back to the semantic element. */
  elementIndex: number;
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
  const indexed = screen.elements.map((el, elementIndex) => ({ el, elementIndex }));
  const navElements = indexed.filter(({ el }) => el.type === "nav");
  const flowElements = indexed.filter(({ el }) => el.type !== "nav");

  const boxes: LayoutBox[] = [];
  let y = PADDING;
  const maxY = FRAME_HEIGHT - PADDING - (navElements.length > 0 ? NAV_HEIGHT + GAP : 0);

  for (const { el, elementIndex } of flowElements) {
    const height = ELEMENT_HEIGHTS[el.type];
    if (y + height > maxY) {
      break; // frame is full — drop overflow rather than overlap
    }
    boxes.push({
      kind: el.type,
      label: el.label,
      elementIndex,
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
      label: navElements[0].el.label,
      elementIndex: navElements[0].elementIndex,
      x: 0,
      y: FRAME_HEIGHT - NAV_HEIGHT,
      width: FRAME_WIDTH,
      height: NAV_HEIGHT,
    });
  }

  return { name: screen.name, boxes };
}
