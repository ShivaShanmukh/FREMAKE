"use client";

import { Group, Layer, Line, Rect, Stage, Text } from "react-konva";
import type { Screen } from "@/lib/generation/schema";
import {
  FRAME_HEIGHT,
  FRAME_WIDTH,
  layoutScreen,
  type LayoutBox,
} from "@/lib/wireframe/layout";

const SCREEN_GAP = 24;
const TITLE_HEIGHT = 28;

function BoxShape({ box }: { box: LayoutBox }) {
  switch (box.kind) {
    case "image":
      return (
        <Group>
          <Rect
            x={box.x}
            y={box.y}
            width={box.width}
            height={box.height}
            stroke="#94a3b8"
            strokeWidth={1}
            fill="#f1f5f9"
          />
          {/* Classic image placeholder cross */}
          <Line
            points={[box.x, box.y, box.x + box.width, box.y + box.height]}
            stroke="#cbd5e1"
            strokeWidth={1}
          />
          <Line
            points={[box.x + box.width, box.y, box.x, box.y + box.height]}
            stroke="#cbd5e1"
            strokeWidth={1}
          />
        </Group>
      );
    case "button":
      return (
        <Group>
          <Rect
            x={box.x}
            y={box.y}
            width={box.width}
            height={box.height}
            cornerRadius={8}
            fill="#334155"
          />
          <Text
            x={box.x}
            y={box.y + box.height / 2 - 6}
            width={box.width}
            align="center"
            text={box.label}
            fontSize={11}
            fill="#ffffff"
          />
        </Group>
      );
    case "list":
      return (
        <Group>
          {[0, 1, 2].map((row) => (
            <Rect
              key={row}
              x={box.x}
              y={box.y + row * (box.height / 3)}
              width={box.width}
              height={box.height / 3 - 6}
              stroke="#94a3b8"
              strokeWidth={1}
              cornerRadius={4}
              fill="#ffffff"
            />
          ))}
          <Text
            x={box.x + 8}
            y={box.y + 8}
            width={box.width - 16}
            text={box.label}
            fontSize={10}
            fill="#64748b"
          />
        </Group>
      );
    default: {
      const isHeader = box.kind === "header" || box.kind === "nav";
      return (
        <Group>
          <Rect
            x={box.x}
            y={box.y}
            width={box.width}
            height={box.height}
            stroke="#94a3b8"
            strokeWidth={1}
            cornerRadius={box.kind === "input" ? 6 : 0}
            fill={isHeader ? "#e2e8f0" : "#ffffff"}
          />
          <Text
            x={box.x + 8}
            y={box.y + box.height / 2 - 6}
            width={box.width - 16}
            align={isHeader ? "center" : "left"}
            text={box.label}
            fontSize={11}
            fill="#334155"
          />
        </Group>
      );
    }
  }
}

export default function WireframeCanvas({ screens }: { screens: Screen[] }) {
  const stageWidth = screens.length * (FRAME_WIDTH + SCREEN_GAP);
  const stageHeight = FRAME_HEIGHT + TITLE_HEIGHT;

  return (
    <div className="overflow-x-auto">
      <Stage width={stageWidth} height={stageHeight}>
        <Layer>
          {screens.map((screen, i) => {
            const offsetX = i * (FRAME_WIDTH + SCREEN_GAP);
            const layout = layoutScreen(screen);
            return (
              <Group key={screen.name + i} x={offsetX} y={0}>
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
                <Group y={TITLE_HEIGHT}>
                  <Rect
                    x={0}
                    y={0}
                    width={FRAME_WIDTH}
                    height={FRAME_HEIGHT}
                    stroke="#0f172a"
                    strokeWidth={1.5}
                    cornerRadius={16}
                    fill="#fafafa"
                  />
                  {layout.boxes.map((box, j) => (
                    <BoxShape key={j} box={box} />
                  ))}
                </Group>
              </Group>
            );
          })}
        </Layer>
      </Stage>
    </div>
  );
}
