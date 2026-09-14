"use client";

import { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { Button } from "./button";
import { cn } from "@/lib/utils";
import { isTopmostOverlay, popOverlay, pushOverlay } from "./overlay-stack";
import { useDialogFocus } from "./use-dialog-focus";

// The generic modal shell — same backdrop/entrance/escape/click-outside
// conventions as ConfirmDialog, generalized for arbitrary content instead
// of a fixed confirm/cancel layout. Reserved for genuinely multi-step
// configuration tasks the operator steps out of the immediate view to do
// (Add/Edit Item, Event Settings, Share Link management) — a quick,
// single-field, in-context edit (session settings, bulk-edit) stays inline
// on purpose; see senior-ux-layout-standards's inline-vs-modal reasoning
// for why the line is drawn there, not "everything becomes a modal."
//
// Phase 7a correction: title and shell radius were `text-subtitle`/
// `rounded-card` — Stage-tier tokens (5-15ft viewing distance) — despite
// this being the Operational Product's most-used overlay (18-24in). Now
// `text-console-lg`/`rounded-panel`, the same tier every other Console
// surface uses. Public-display/Stage surfaces never rendered Modal at all
// (Stage has its own overlays — BroadcastOverlay, HoldScreen, etc. — see
// components/display-engine/), so this correction has zero Stage impact.
export function Modal({
  open,
  onClose,
  title,
  size = "md",
  scrollBody = true,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  size?: "sm" | "md" | "lg" | "xl";
  // false when `children` manages its own scroll region and footer (see
  // ProgramForm) — a footer that's `position: sticky` *inside* this div
  // still overlaps whatever field is at the current scroll position,
  // because sticky content doesn't reserve space, it just always stays
  // visible on top of whatever's behind it. That's fine for a footer that
  // truly is the last thing on the page, but wrong for a Save/Cancel bar
  // that must never sit on top of a field the operator can still see and
  // is trying to edit. The real fix is structural, not a bigger spacer:
  // the footer has to live outside the scrolling region entirely, as an
  // actual shrink-0 flex sibling below it — which only the child can do
  // correctly, since only it knows where its own footer boundary is.
  scrollBody?: boolean;
  children: React.ReactNode;
}) {
  const [overlayId] = useState(() => Symbol("modal"));
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(open, dialogRef);

  useEffect(() => {
    if (!open) return;
    pushOverlay(overlayId);
    return () => popOverlay(overlayId);
  }, [open, overlayId]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isTopmostOverlay(overlayId)) onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose, overlayId]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          role="presentation"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm px-4 sm:px-6 py-8"
          onClick={onClose}
        >
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className={cn(
              "w-full rounded-panel bg-card flex flex-col max-h-full overflow-hidden focus:outline-none",
              size === "sm" && "max-w-sm",
              size === "md" && "max-w-lg",
              size === "lg" && "max-w-2xl",
              size === "xl" && "max-w-3xl"
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-4 px-6 pt-6 pb-4 shrink-0">
              <h2 id={titleId} className="text-console-lg text-primary">
                {title}
              </h2>
              <Button variant="ghost" size="sm" square onClick={onClose} aria-label="Close">
                <X className="h-4 w-4" strokeWidth={2} />
              </Button>
            </div>
            <div className={cn("min-h-0", scrollBody ? "px-6 pb-6 overflow-y-auto" : "flex-1 flex flex-col overflow-hidden")}>
              {children}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
