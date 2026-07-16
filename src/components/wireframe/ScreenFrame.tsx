"use client";

import type Konva from "konva";
import { Group, Rect, Text } from "react-konva";
import type { Screen } from "@/lib/generation/schema";
import { FRAME_HEIGHT, FRAME_WIDTH, layoutScreen } from "@/lib/wireframe/layout";
import { BoxShape } from "./BoxShape";

export const TITLE_HEIGHT = 28;

export type ScreenFrameProps = {
  screen: Screen;
  /** True when the screen itself (not one element) is the current selection. */
  screenSelected?: boolean;
  /** elements-index of the selected element on this screen, if any. */
  selectedElementIndex?: number | null;
  /** elements-indices to outline as changed/added (diff "new" side). */
  highlightIndices?: number[];
  /** elements-indices to outline as removed (diff "old" side). */
  removedIndices?: number[];
  onSelectScreen?: () => void;
  onSelectElement?: (elementIndex: number) => void;
};

/** One phone frame with title, elements, and selection/diff outlines. */
export function ScreenFrame({
  screen,
  screenSelected = false,
  selectedElementIndex = null,
  highlightIndices = [],
  removedIndices = [],
  onSelectScreen,
  onSelectElement,
}: ScreenFrameProps) {
  const layout = layoutScreen(screen);

  // cancelBubble makes the innermost hit win: an element click never
  // also fires the screen click — one unambiguous selected target.
  function handleElementClick(e: Konva.KonvaEventObject<MouseEvent>, elementIndex: number) {
    e.cancelBubble = true;
    onSelectElement?.(elementIndex);
  }

  function outlineFor(elementIndex: number): string | null {
    if (elementIndex === selectedElementIndex) return "#2563eb"; // selected: blue
    if (highlightIndices.includes(elementIndex)) return "#d97706"; // changed/added: amber
    if (removedIndices.includes(elementIndex)) return "#dc2626"; // removed: red
    return null;
  }

  return (
    <Group>
      <Text
        x={0}
        y={0}
        width={FRAME_WIDTH}
        align="center"
        text={layout.name}
        fontSize={12}
        fontStyle="bold"
        fill="#0f172a"
      />
      <Group y={TITLE_HEIGHT} onClick={onSelectScreen ? () => onSelectScreen() : undefined}>
        <Rect
          x={0}
          y={0}
          width={FRAME_WIDTH}
          height={FRAME_HEIGHT}
          stroke={screenSelected ? "#2563eb" : "#0f172a"}
          strokeWidth={screenSelected ? 3 : 1.5}
          cornerRadius={16}
          fill="#fafafa"
        />
        {layout.boxes.map((box) => (
          <Group
            key={box.elementIndex}
            onClick={
              onSelectElement ? (e) => handleElementClick(e, box.elementIndex) : undefined
            }
          >
            <BoxShape box={box} />
            {outlineFor(box.elementIndex) !== null && (
              <Rect
                x={box.x - 3}
                y={box.y - 3}
                width={box.width + 6}
                height={box.height + 6}
                stroke={outlineFor(box.elementIndex) ?? undefined}
                strokeWidth={2}
                dash={removedIndices.includes(box.elementIndex) ? [6, 4] : undefined}
                cornerRadius={6}
                listening={false}
              />
            )}
          </Group>
        ))}
      </Group>
    </Group>
  );
}
