"use client";

import { Layer, Stage } from "react-konva";
import type { Screen } from "@/lib/generation/schema";
import { diffScreens, highlightedAfterIndices, removedBeforeIndices } from "@/lib/edit/diff";
import { FRAME_HEIGHT, FRAME_WIDTH } from "@/lib/wireframe/layout";
import { ScreenFrame, TITLE_HEIGHT } from "./ScreenFrame";

/**
 * Side-by-side diff of one screen: current state on the left, proposed
 * state on the right. Changed/added elements are outlined in amber on the
 * proposed side; removed elements are outlined dashed-red on the current
 * side. Both sides render through the exact same layout + frame code as
 * the main canvas, so what the diff shows is what approval applies.
 */
export function DiffView({ before, after }: { before: Screen; after: Screen }) {
  const diff = diffScreens(before, after);
  const highlights = highlightedAfterIndices(diff);
  const removed = removedBeforeIndices(diff);
  const stageHeight = FRAME_HEIGHT + TITLE_HEIGHT;

  return (
    <div className="flex flex-wrap gap-8" data-testid="diff-view">
      <figure data-testid="diff-before">
        <figcaption className="mb-1 text-xs font-medium uppercase tracking-wide text-neutral-500">
          Current
        </figcaption>
        <Stage width={FRAME_WIDTH} height={stageHeight}>
          <Layer>
            <ScreenFrame screen={before} removedIndices={removed} />
          </Layer>
        </Stage>
      </figure>
      <figure data-testid="diff-after">
        <figcaption className="mb-1 text-xs font-medium uppercase tracking-wide text-amber-600">
          Proposed
        </figcaption>
        <Stage width={FRAME_WIDTH} height={stageHeight}>
          <Layer>
            <ScreenFrame screen={after} highlightIndices={highlights} />
          </Layer>
        </Stage>
      </figure>
    </div>
  );
}
