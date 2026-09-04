"use client";

import { Columns3, PanelLeftDashed, RotateCcw, SlidersHorizontal } from "lucide-react";
import { OverflowMenu } from "@/components/ui/overflow-menu";
import type { useOperatorColumnLayout } from "@/lib/use-operator-column-layout";

// Desktop-only, low-priority by design (spec: "somewhere low-priority and
// logical, such as an Operator layout/settings overflow action") — the
// primary way to change column widths is dragging the dividers themselves,
// not this menu. Lives in EventShellHeader's actions row, next to
// Rehearsal Mode, only while the resizable three-column grid is actually
// on screen (isDesktopLayout in OperatorPage below).
export function OperatorLayoutMenu({ layout }: { layout: ReturnType<typeof useOperatorColumnLayout> }) {
  return (
    <OverflowMenu
      label="Layout"
      iconOnly
      triggerIcon={Columns3}
      items={[
        {
          label: "Balanced",
          icon: Columns3,
          onClick: () => layout.applyPreset("balanced"),
        },
        {
          label: "Rundown focus",
          icon: PanelLeftDashed,
          onClick: () => layout.applyPreset("rundown"),
        },
        {
          label: "Control focus",
          icon: SlidersHorizontal,
          onClick: () => layout.applyPreset("controls"),
        },
        {
          label: "Reset layout",
          icon: RotateCcw,
          onClick: layout.reset,
        },
      ]}
    />
  );
}
