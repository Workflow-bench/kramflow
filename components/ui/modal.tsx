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
export function Modal({
  open,
  onClose,
  title,
  size = "md",
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  size?: "sm" | "md" | "lg";
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
              "w-full rounded-card bg-card flex flex-col max-h-full overflow-hidden focus:outline-none",
              size === "sm" && "max-w-sm",
              size === "md" && "max-w-lg",
              size === "lg" && "max-w-2xl"
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-4 px-6 pt-6 pb-4 shrink-0">
              <h2 id={titleId} className="text-subtitle text-primary">
                {title}
              </h2>
              <Button variant="ghost" size="sm" square onClick={onClose} aria-label="Close">
                <X className="h-4 w-4" strokeWidth={2} />
              </Button>
            </div>
            <div className="px-6 pb-6 overflow-y-auto">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
