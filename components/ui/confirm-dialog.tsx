"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "./button";

// The one confirmation dialog used everywhere a single click would
// otherwise mutate shared/live state with no review step. See
// docs/DESIGN_SYSTEM.md's motion convention (250ms, ease-out) and
// docs/COMPONENT_GUIDE.md — this is the first components/ui/ addition
// since that guide was written.

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
  // Optional: callers whose onConfirm does async work can show this instead
  // of leaving the dialog's own confirm button with no in-progress feedback
  // at all (previously true for every caller — Jump, Display Manager,
  // Broadcast Center's emergency/destructive confirms all shared this gap).
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "default",
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    confirmRef.current?.focus();
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !loading) onCancel();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, loading, onCancel]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          role="presentation"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm px-6"
          onClick={loading ? undefined : onCancel}
        >
          <motion.div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-dialog-title"
            aria-describedby={description ? "confirm-dialog-description" : undefined}
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="w-full max-w-sm rounded-card bg-card p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="confirm-dialog-title" className="text-subtitle text-primary">
              {title}
            </h2>
            {description && (
              <p id="confirm-dialog-description" className="text-body text-muted mt-2">
                {description}
              </p>
            )}
            <div className="flex items-center gap-3 mt-6">
              <Button
                ref={confirmRef}
                variant={tone === "danger" ? "danger" : "primary"}
                size="md"
                className="flex-1"
                loading={loading}
                onClick={onConfirm}
              >
                {confirmLabel}
              </Button>
              <Button variant="ghost" size="md" className="flex-1" disabled={loading} onClick={onCancel}>
                {cancelLabel}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Small state-management helper so call sites don't each hand-roll
// { open, payload } juggling — mirrors the pattern broadcast/page.tsx's
// pendingEmergency already used locally, generalized and reused instead
// of duplicated. `T` is whatever the confirm action needs to know when it
// fires (e.g. which item to jump to).
export function useConfirmDialog<T = void>() {
  const [pending, setPending] = useState<T | null>(null);

  const request = useCallback((value: T) => setPending(value), []);
  const cancel = useCallback(() => setPending(null), []);

  return {
    isOpen: pending !== null,
    pending,
    request,
    cancel,
  };
}
