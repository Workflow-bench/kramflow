"use client";

import { useEffect, useRef } from "react";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Shared by Modal and ConfirmDialog — the one place both dialog primitives
// get initial focus, a real Tab trap, and focus restoration from, instead
// of drifting into two different levels of rigor the way they had before
// (2026-09-01 UI/UX audit finding #8: "share visual styling but not
// reliable autofocus, trapping, or restoration" — ConfirmDialog had partial
// initial-focus handling of its own, Modal had none, and neither trapped
// Tab or restored focus on close).
//
// The Tab trap is a listener on the dialog's own container, not
// `document` — that's what makes two stacked dialogs (see overlay-stack.ts)
// just work without each needing to know whether it's the topmost one: a
// Tab keydown only ever bubbles up through whichever dialog's subtree
// currently has focus, so the inner (topmost) dialog's own listener is the
// only one that ever sees it.
//
// No `inert` on the rest of the page — deliberately out of scope here.
// Every caller already renders a full-viewport backdrop with
// `onClick={onClose}` in front of the rest of the page, so a pointer click
// "through" the dialog was never actually reachable; the real gap this
// closes is keyboard-only (Tab escaping the dialog, focus lost on open,
// focus stranded on close), which is what a focus trap + restoration
// actually fixes.
export function useDialogFocus(open: boolean, containerRef: React.RefObject<HTMLElement | null>) {
  const triggerRef = useRef<Element | null>(null);

  useEffect(() => {
    if (!open) return;
    triggerRef.current = document.activeElement;

    const container = containerRef.current;
    if (!container) return;

    const focusable = () =>
      Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter((el) => el.offsetParent !== null);

    // Deferred one frame: content driven by props (e.g. a typed-confirmation
    // Input that only renders once `requireTypedConfirmation` is true) may
    // not be in the DOM yet on the same tick this effect runs.
    const raf = requestAnimationFrame(() => {
      const first = focusable()[0];
      (first ?? container).focus();
    });

    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Tab") return;
      const items = focusable();
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    container.addEventListener("keydown", onKeyDown);

    return () => {
      cancelAnimationFrame(raf);
      container.removeEventListener("keydown", onKeyDown);
      if (triggerRef.current instanceof HTMLElement) triggerRef.current.focus();
    };
  }, [open, containerRef]);
}
