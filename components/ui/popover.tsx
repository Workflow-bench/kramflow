"use client";

import { useRef, useState, type ReactNode } from "react";
import { useDismissOnOutsideOrEscape } from "@/lib/use-dismiss-on-outside-or-escape";
import { cn } from "@/lib/utils";

// Canonical Popover — a real gap DESIGN.md flagged (Phase 3 audit): every
// floating-menu need up to now (EventIdentity's event switcher,
// OverflowMenu, HelpMenu) hand-rolled its own open state, outside-click,
// and Escape handling, all converging on the exact same
// rounded-panel/bg-card/border-line/shadow-float/animate-rise shape by
// copying it forward each time. Built on the same
// useDismissOnOutsideOrEscape hook those consumers already share (not
// Radix, despite @radix-ui/react-popover being available in
// package.json) — introducing a second overlay paradigm alongside the
// app's one existing, working, already-accessible dismiss pattern would
// itself be the "duplicate implementation" this component exists to stop.
// Kramflow UI Shell v1 (Phase 4) — first consumers: EventNav's mobile
// menu, SessionPopover.
export function Popover({
  trigger,
  children,
  align = "start",
  className,
}: {
  /** Render-prop so the trigger can reflect open state (chevron rotation, aria-expanded). */
  trigger: (state: { open: boolean; toggle: () => void }) => ReactNode;
  children: ReactNode;
  align?: "start" | "end";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  useDismissOnOutsideOrEscape(rootRef, open, () => setOpen(false));

  return (
    <div className="relative inline-block" ref={rootRef}>
      {trigger({ open, toggle: () => setOpen((v) => !v) })}
      {open && (
        <div
          role="dialog"
          className={cn(
            "absolute top-full z-30 mt-1.5 rounded-panel bg-card border border-line shadow-float py-1 motion-safe:animate-rise",
            align === "start" ? "left-0" : "right-0",
            className
          )}
        >
          {children}
        </div>
      )}
    </div>
  );
}
