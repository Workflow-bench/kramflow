"use client";

import { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { Button } from "./button";
import { cn } from "@/lib/utils";
import { isTopmostOverlay, popOverlay, pushOverlay } from "./overlay-stack";
import { useDialogFocus } from "./use-dialog-focus";

// The canonical Sheet — DESIGN.md's Components table flagged this as a real
// gap (no generic Sheet existed; Modal was used everywhere a sheet pattern
// might otherwise apply) rather than inventing new work. Reserved for a
// task that's genuinely contextual to what's already behind it (create/edit
// a session while the cue sheet itself stays in place) — Modal remains
// right for a task the operator steps fully out of the current view to do
// (Add/Edit Item, Event Settings, Import). Shares Modal's exact backdrop/
// escape/focus-trap/overlay-stack conventions (useDialogFocus, pushOverlay/
// popOverlay/isTopmostOverlay) rather than a second overlay paradigm — only
// the entrance geometry differs (slides from the trailing edge instead of
// scaling in centered).
export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const [overlayId] = useState(() => Symbol("sheet"));
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
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="fixed inset-0 z-50 flex justify-end bg-background/80 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            // Same duration/easing family as Modal (0.25s easeOut) — an
            // operator opening a session sheet right after closing an item
            // modal shouldn't feel two different motion languages.
            transition={{ duration: 0.25, ease: [0.2, 0, 0, 1] }}
            className={cn(
              "h-full w-full sm:max-w-md bg-card border-l border-line shadow-float",
              "flex flex-col focus:outline-none"
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-4 px-6 pt-6 pb-4 shrink-0 border-b border-line-soft">
              <h2 id={titleId} className="text-subtitle text-primary">
                {title}
              </h2>
              <Button variant="ghost" size="sm" square onClick={onClose} aria-label="Close">
                <X className="h-4 w-4" strokeWidth={2} />
              </Button>
            </div>
            <div className="px-6 py-6 overflow-y-auto flex-1">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
