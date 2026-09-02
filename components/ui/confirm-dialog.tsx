"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "./button";
import { Input } from "./input";
import { isTopmostOverlay, popOverlay, pushOverlay } from "./overlay-stack";
import { useDialogFocus } from "./use-dialog-focus";

// The one confirmation dialog used everywhere a single click would
// otherwise mutate shared/live state with no review step. Guardrail weight
// is tier-aware (docs/DESIGN.md's guardrail-tier table, Phase 2 §5 of the
// UX rethink) rather than one fixed style for every destructive action —
// tier 1 (e.g. single queue-item delete) shouldn't reach this component at
// all, since an Undo toast is already the correct-weight guardrail there.
//
//   tone="default"      — non-destructive confirmation (e.g. "Switch session?")
//   tone="danger"        — tier 2/3: outlined danger button
//   tone="danger-solid"  — tier 4: solid danger button, reserved for
//                          requireTypedConfirmation (event delete only)

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "danger" | "danger-solid";
  // Optional: callers whose onConfirm does async work can show this instead
  // of leaving the dialog's own confirm button with no in-progress feedback
  // at all (previously true for every caller — Jump, Display Manager,
  // Broadcast Center's emergency/destructive confirms all shared this gap).
  loading?: boolean;
  // Tier 4 only: the confirm button stays disabled until the operator types
  // this exact value. Reserved for the single highest-consequence action in
  // the product (event delete) — nothing else in the app warrants it.
  requireTypedConfirmation?: { value: string; label: string };
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
  requireTypedConfirmation,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const [typedValue, setTypedValue] = useState("");
  const typedMismatch = requireTypedConfirmation !== undefined && typedValue !== requireTypedConfirmation.value;

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resetting for a fresh open, not deriving from a prop
    setTypedValue("");
  }, [open]);

  // Initial focus, Tab trap, and focus restoration all come from here now
  // (see its own comment) — it lands on Confirm when there's no typed-
  // confirmation field, and on the Input when there is, matching what this
  // component used to do by hand for the Confirm-button case only.
  useDialogFocus(open, dialogRef);

  const [overlayId] = useState(() => Symbol("confirm-dialog"));

  useEffect(() => {
    if (!open) return;
    pushOverlay(overlayId);
    return () => popOverlay(overlayId);
  }, [open, overlayId]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !loading && isTopmostOverlay(overlayId)) onCancel();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, loading, onCancel, overlayId]);

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
            ref={dialogRef}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={description ? descriptionId : undefined}
            tabIndex={-1}
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="w-full max-w-sm rounded-card bg-card p-6 focus:outline-none"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id={titleId} className="text-subtitle text-primary">
              {title}
            </h2>
            {description && (
              <p id={descriptionId} className="text-body text-muted mt-2">
                {description}
              </p>
            )}
            {requireTypedConfirmation && (
              <div className="mt-4">
                <label className="text-console-meta text-muted-2 block mb-1.5">{requireTypedConfirmation.label}</label>
                <Input
                  value={typedValue}
                  onChange={(e) => setTypedValue(e.target.value)}
                  placeholder={requireTypedConfirmation.value}
                  aria-label={requireTypedConfirmation.label}
                />
              </div>
            )}
            <div className="flex items-center gap-3 mt-6">
              <Button
                variant={tone === "danger-solid" ? "danger-solid" : tone === "danger" ? "danger" : "primary"}
                size="md"
                className="flex-1"
                loading={loading}
                disabled={typedMismatch}
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
