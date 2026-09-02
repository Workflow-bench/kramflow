"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { MoreHorizontal } from "lucide-react";
import { Button } from "./button";
import { cn } from "@/lib/utils";

export interface OverflowMenuItem {
  label: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  /** Navigation item — provide exactly one of href or onClick. */
  href?: string;
  target?: string;
  /** Callback item — provide exactly one of href or onClick. Originally
   *  this menu was link-only (see components/dashboard/help-menu.tsx and
   *  Dashboard's own deferred note on that gap); Cue Sheet's session
   *  actions — Edit/Delete/New session — are the first real callback-item
   *  need, so this closes that gap rather than adding a fourth hand-rolled
   *  popover-menu shell alongside HelpMenu's. */
  onClick?: () => void;
  /** Renders in the danger hue — e.g. a destructive "Delete" entry. */
  tone?: "default" | "danger";
}

// A generic low-frequency-actions menu — same shell/interaction pattern as
// components/dashboard/help-menu.tsx, generalized so any nav row can demote
// its rarely-used links into one "More" trigger instead of keeping them at
// permanent equal weight with whatever's actually used constantly. Hick's
// Law: every extra always-visible choice taxes the time to find the one
// you actually want, every time you glance at the row — reserved for
// genuinely low-frequency destinations, not a place to hide things that
// are just inconvenient to lay out.
export function OverflowMenu({
  items,
  label = "More",
  iconOnly = false,
}: {
  items: OverflowMenuItem[];
  label?: string;
  /** Icon-only trigger (no visible "More" text) for tight command rows —
   *  the accessible name still carries `label`. */
  iconOnly?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      // Scoped + stopped here for the same reason as components/ui/select.tsx
      // — a window-level Escape listener would also close any ancestor
      // Modal on the same keypress.
      e.stopPropagation();
      setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    const root = rootRef.current;
    root?.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      root?.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <Button variant="ghost" size="sm" square={iconOnly} aria-label={iconOnly ? label : undefined} onClick={() => setOpen((v) => !v)}>
        <MoreHorizontal className="h-4 w-4" strokeWidth={2} />
        {!iconOnly && label}
      </Button>
      {open && (
        <div
          role="menu"
          className={cn(
            "absolute right-0 z-30 mt-1.5 min-w-[11rem] rounded-panel bg-card border border-line shadow-float py-1",
            "motion-safe:animate-rise"
          )}
        >
          {items.map((item) =>
            item.href ? (
              <Link
                key={item.label}
                href={item.href}
                target={item.target}
                rel={item.target === "_blank" ? "noopener noreferrer" : undefined}
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 px-3 py-2 text-console-sm text-primary hover:bg-card-hover transition-colors"
              >
                <item.icon className="h-4 w-4 shrink-0 text-muted-2" strokeWidth={2} />
                {item.label}
              </Link>
            ) : (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  item.onClick?.();
                }}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2 text-console-sm text-left cursor-pointer hover:bg-card-hover transition-colors",
                  item.tone === "danger" ? "text-status-red" : "text-primary"
                )}
              >
                <item.icon className={cn("h-4 w-4 shrink-0", item.tone === "danger" ? "text-status-red" : "text-muted-2")} strokeWidth={2} />
                {item.label}
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}
