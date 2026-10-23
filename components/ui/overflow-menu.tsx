"use client";

import { useCallback, useId, useRef, useState } from "react";
import Link from "next/link";
import { MoreHorizontal } from "lucide-react";
import { Button } from "./button";
import { cn } from "@/lib/utils";
import { useDismissOnOutsideOrEscape } from "@/lib/use-dismiss-on-outside-or-escape";
import { useMenuKeyboard } from "@/lib/use-menu-keyboard";

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
  compactBelowSm = false,
  triggerIcon: TriggerIcon = MoreHorizontal,
}: {
  items: OverflowMenuItem[];
  label?: string;
  /** Icon-only trigger (no visible "More" text) for tight command rows —
   *  the accessible name still carries `label`. */
  iconOnly?: boolean;
  /** Show the text label from sm: up only; below that the trigger is
   *  icon-only (accessible name still `label`). */
  compactBelowSm?: boolean;
  /** Override the trigger's icon — the "more actions" `MoreHorizontal`
   *  glyph is right for an overflow-actions menu, wrong for a menu that's
   *  itself the primary entry point (e.g. Help). Defaults to
   *  `MoreHorizontal` so every other call site is unaffected. */
  triggerIcon?: React.ComponentType<{ className?: string; strokeWidth?: number }>;
}) {
  const [open, setOpen] = useState(false);
  const [initialFocus, setInitialFocus] = useState<"first" | "last">("first");
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const close = useCallback(() => setOpen(false), []);

  // F11: complete APG menu button — named trigger with expanded state and
  // relationship, focus into the menu on open, arrow/Home/End movement,
  // Escape back to the trigger (lib/use-menu-keyboard.ts).
  useDismissOnOutsideOrEscape(rootRef, open, (reason) => {
    setOpen(false);
    if (reason === "escape") triggerRef.current?.focus();
  });
  useMenuKeyboard({ open, menuRef, triggerRef, onClose: close, initialFocus });

  return (
    <div ref={rootRef} className="relative">
      <Button
        ref={triggerRef}
        variant="ghost"
        size="sm"
        square={iconOnly}
        aria-label={iconOnly || compactBelowSm ? label : undefined}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => {
          setInitialFocus("first");
          setOpen((v) => !v);
        }}
        onKeyDown={(e) => {
          if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
            e.preventDefault();
            setInitialFocus(e.key === "ArrowUp" ? "last" : "first");
            setOpen(true);
          }
        }}
      >
        <TriggerIcon className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
        {!iconOnly && (compactBelowSm ? <span className="hidden sm:inline">{label}</span> : label)}
      </Button>
      {open && (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label={label}
          className={cn(
            // Solid surface (AD03): menus float over operational content.
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
                tabIndex={-1}
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 px-3 py-2 text-console-sm text-primary hover:bg-card-hover focus-visible:bg-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent transition-colors"
              >
                <item.icon className="h-4 w-4 shrink-0 text-muted-2" strokeWidth={2} aria-hidden="true" />
                {item.label}
              </Link>
            ) : (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                tabIndex={-1}
                onClick={() => {
                  setOpen(false);
                  // Return focus to the trigger so keyboard users aren't
                  // dropped at the top of the page; an item that opens its
                  // own dialog moves focus again from there.
                  triggerRef.current?.focus();
                  item.onClick?.();
                }}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2 text-console-sm text-left cursor-pointer hover:bg-card-hover focus-visible:bg-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent transition-colors",
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
