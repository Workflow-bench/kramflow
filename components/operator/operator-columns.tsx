"use client";

import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useOperatorColumnLayout,
  CONTROLS_MAX,
  CONTROLS_MIN,
  PROGRAM_MIN,
  LIVE_NOW_MIN,
} from "@/lib/use-operator-column-layout";

// Desktop-only (xl+, 1280px+) resizable three-column workspace — Program,
// Live Now, Controls, each user-adjustable via the two dividers between
// them, replacing the old fixed grid-cols-[1fr_340px_280px] split. Tablet
// and mobile keep their own distinct compositions in
// app/e/[eventId]/operator/page.tsx (a 2-column master-detail and a
// single reordered stack respectively) — this never renders there, so it
// doesn't need to reason about either.
//
// `layout` comes from the parent (OperatorPage), not a local
// useOperatorColumnLayout() call — the header's Layout menu (Reset/
// presets) needs to drive the exact same state these columns render, and
// two independent hook instances would each keep their own in-memory
// fractions. See the hook's own comment for why sharing one instance
// across a component that mounts/unmounts with the breakpoint (this one)
// and one that doesn't (the header) is still safe.
export function OperatorColumns({
  program,
  liveNow,
  controls,
  layout,
}: {
  program: React.ReactNode;
  liveNow: React.ReactNode;
  controls: React.ReactNode;
  layout: ReturnType<typeof useOperatorColumnLayout>;
}) {
  // Destructured once into plain locals rather than read as layout.xxx
  // throughout the JSX below — the hook internally uses refs (drag
  // anchor, ResizeObserver instance) for state that must survive across
  // renders without itself being reactive, and eslint-plugin-react-hooks'
  // ref-safety check taints property access on a hook's whole returned
  // object rather than tracking which individual fields are ref-derived.
  // Plain local bindings (and, below, concrete primitive/function props
  // instead of forwarding the object itself into ColumnDivider) read
  // exactly the same values without tripping that check.
  const {
    containerRef,
    programPx,
    liveNowPx,
    controlsPx,
    dividerPx,
    draggingDivider,
    beginDrag,
    onPointerMove,
    endDrag,
    onDividerKeyDown,
  } = layout;

  return (
    <div
      ref={containerRef}
      className="flex-1 min-h-0 flex items-stretch"
      style={{
        // Zero once, before the first ResizeObserver callback lands
        // (typically the same frame) — a 0px flash reads as "collapsed,"
        // not "measuring," so hide the columns for that one instant
        // rather than paint them at the wrong width.
        visibility: programPx > 0 ? "visible" : "hidden",
      }}
    >
      <div id="operator-column-program" className="min-w-0 min-h-0 flex flex-col" style={{ width: programPx }}>
        {program}
      </div>

      <ColumnDivider
        active={draggingDivider === 1}
        width={dividerPx}
        onPointerDown={beginDrag(1)}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onKeyDown={onDividerKeyDown(1)}
        valueNow={Math.round(programPx)}
        valueMin={PROGRAM_MIN}
        valueMax={Math.round(programPx + liveNowPx - LIVE_NOW_MIN)}
        label="Resize Program and Live Now columns"
        controls="operator-column-program operator-column-live-now"
      />

      <div
        id="operator-column-live-now"
        className="min-w-0 min-h-0 flex flex-col border-l border-line-soft"
        style={{ width: liveNowPx }}
      >
        {liveNow}
      </div>

      <ColumnDivider
        active={draggingDivider === 2}
        width={dividerPx}
        onPointerDown={beginDrag(2)}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onKeyDown={onDividerKeyDown(2)}
        valueNow={Math.round(controlsPx)}
        valueMin={CONTROLS_MIN}
        valueMax={CONTROLS_MAX}
        label="Resize Live Now and Controls columns"
        controls="operator-column-live-now operator-column-controls"
      />

      <div
        id="operator-column-controls"
        className="min-w-0 min-h-0 flex flex-col border-l border-line-soft"
        style={{ width: controlsPx }}
      >
        {controls}
      </div>
    </div>
  );
}

function ColumnDivider({
  active,
  width,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onKeyDown,
  valueNow,
  valueMin,
  valueMax,
  label,
  controls,
}: {
  active: boolean;
  width: number;
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  valueNow: number;
  valueMin: number;
  valueMax: number;
  label: string;
  controls: string;
}) {
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-controls={controls}
      aria-valuenow={valueNow}
      aria-valuemin={valueMin}
      aria-valuemax={valueMax}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onKeyDown={onKeyDown}
      className={cn("group relative shrink-0 cursor-col-resize select-none touch-none", "focus-visible:outline-none")}
      style={{ width }}
    >
      {/* The visible line stays a hairline until interaction — hover/focus/
          active widen and brighten it so the affordance reads as
          intentional without permanently thickening the seam between
          every column (spec: "subtle by default, visible on hover/focus"). */}
      <span
        aria-hidden="true"
        className={cn(
          "absolute inset-y-0 left-1/2 -translate-x-1/2 w-px bg-line-soft transition-colors duration-100",
          "group-hover:w-0.5 group-hover:bg-line group-focus-visible:w-0.5 group-focus-visible:bg-accent",
          active && "w-0.5 bg-accent"
        )}
      />
      {/* Grip glyph only on hover/focus/drag — a permanently-visible one at
          every divider would read as three more icons to parse on a
          screen already asking the eye to track a live show; earning its
          place only when it's actually actionable keeps it out of the
          way otherwise. */}
      <span
        aria-hidden="true"
        className={cn(
          "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 grid place-items-center",
          "h-8 w-4 rounded-control bg-raised border border-line text-muted-2 opacity-0 transition-opacity duration-100",
          "group-hover:opacity-100 group-focus-visible:opacity-100",
          active && "opacity-100 text-accent border-accent/40"
        )}
      >
        <GripVertical className="h-3 w-3" strokeWidth={2} />
      </span>
    </div>
  );
}
