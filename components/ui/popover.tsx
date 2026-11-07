"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
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
  open: controlledOpen,
  onOpenChange,
}: {
  /** Render-prop so the trigger can reflect open state (chevron rotation, aria-expanded). */
  trigger: (state: { open: boolean; toggle: () => void }) => ReactNode;
  children: ReactNode;
  align?: "start" | "end";
  className?: string;
  /** Optional controlled state, for a consumer that must close (or keep
   *  open) the popover in response to work it does itself — e.g. the
   *  session picker closing only once the server confirms a switch. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = (next: boolean) => {
    if (controlledOpen === undefined) setUncontrolledOpen(next);
    onOpenChange?.(next);
  };
  const rootRef = useRef<HTMLDivElement>(null);
  useDismissOnOutsideOrEscape(rootRef, open, () => setOpen(false));

  // Keeps the panel inside the viewport. A start-aligned panel opened from a
  // trigger in the middle of a phone-width header used to run past the right
  // edge (the session picker's last column was cut off). Shifts by exactly
  // the overflow, leaving a 12px gutter, and never past the left gutter.
  const panelRef = useRef<HTMLDivElement>(null);
  const [shift, setShift] = useState(0);
  useLayoutEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    if (!panel) return;
    const gutter = 12;
    const rect = panel.getBoundingClientRect();
    const base = rect.left - shift;
    const right = base + rect.width;
    let next = 0;
    if (right > window.innerWidth - gutter) next = window.innerWidth - gutter - right;
    if (base + next < gutter) next = gutter - base;
    if (next !== shift) setShift(next);
  }, [open, shift]);

  return (
    <div className="relative inline-block" ref={rootRef}>
      {trigger({ open, toggle: () => setOpen(!open) })}
      {open && (
        <div
          ref={panelRef}
          role="dialog"
          style={shift ? (align === "start" ? { left: shift } : { right: -shift }) : undefined}
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
