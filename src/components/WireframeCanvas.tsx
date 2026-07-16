"use client";

import { Group, Layer, Stage } from "react-konva";
import type { Screen } from "@/lib/generation/schema";
import type { Selection } from "@/lib/edit/types";
import { FRAME_HEIGHT, FRAME_WIDTH } from "@/lib/wireframe/layout";
import { ScreenFrame, TITLE_HEIGHT } from "./wireframe/ScreenFrame";

const SCREEN_GAP = 24;

type WireframeCanvasProps = {
  screens: Screen[];
  selection?: Selection | null;
  onSelect?: (selection: Selection | null) => void;
};

export default function WireframeCanvas({
  screens,
  selection = null,
  onSelect,
}: WireframeCanvasProps) {
  const stageWidth = screens.length * (FRAME_WIDTH + SCREEN_GAP);
  const stageHeight = FRAME_HEIGHT + TITLE_HEIGHT;

  return (
    <div className="overflow-x-auto" data-testid="wireframe-canvas">
      <Stage
        width={stageWidth}
        height={stageHeight}
        onClick={(e) => {
          // A click that reached the stage hit no screen — clear selection.
          if (onSelect && e.target === e.target.getStage()) {
            onSelect(null);
          }
        }}
      >
        <Layer>
          {screens.map((screen, i) => (
            <Group key={screen.name + i} x={i * (FRAME_WIDTH + SCREEN_GAP)} y={0}>
              <ScreenFrame
                screen={screen}
                screenSelected={selection?.screenIndex === i && selection.elementIndex === null}
                selectedElementIndex={
                  selection?.screenIndex === i ? selection.elementIndex : null
                }
                onSelectScreen={
                  onSelect ? () => onSelect({ screenIndex: i, elementIndex: null }) : undefined
                }
                onSelectElement={
                  onSelect
                    ? (elementIndex) => onSelect({ screenIndex: i, elementIndex })
                    : undefined
                }
              />
            </Group>
          ))}
        </Layer>
      </Stage>
    </div>
  );
}
