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
// The page behind an open dialog is made `inert` (see inertOutside below), so
// pointer, keyboard and assistive-technology access are all excluded, not only
// the Tab sequence. The backdrop (`onClick={onClose}`) remains the pointer dismiss.
// Full modal exclusion (WCAG 2.4.3 / 4.1.2 for AT users): while a dialog is open,
// everything outside its ancestor chain is made `inert`. The backdrop stops pointer
// input and the focus trap stops Tab, but without `inert` the page behind stays in the
// accessibility tree and can be reached by screen-reader navigation. Walks from the
// dialog up to <body>, marking each ancestor's siblings. Returns a restore function
// that puts back exactly what it changed (a sibling that was already inert stays so).
// Reference-counted. Each open dialog marks the siblings of its ancestor chain. An
// element is made inert once and stays inert until EVERY dialog that marked it has
// closed, in any order. So closing an upper dialog never reactivates background that
// a lower dialog still excludes, and closing a lower dialog while an upper one is open
// keeps the content beneath the upper one excluded. `wasInert` is the state before the
// first dialog touched the element; it is restored only when the count reaches zero.
const inertMarks = new Map<HTMLElement, { count: number; wasInert: boolean }>();

export function inertOutside(target: HTMLElement): () => void {
  const marked: HTMLElement[] = [];
  let node: HTMLElement | null = target;
  while (node && node !== document.body && node.parentElement) {
    for (const sib of Array.from(node.parentElement.children) as HTMLElement[]) {
      if (sib === node || sib.tagName === "SCRIPT" || sib.tagName === "STYLE") continue;
      const mark = inertMarks.get(sib);
      if (mark) {
        mark.count += 1;
      } else {
        inertMarks.set(sib, { count: 1, wasInert: sib.hasAttribute("inert") });
        sib.setAttribute("inert", "");
      }
      marked.push(sib);
    }
    node = node.parentElement;
  }
  // One release per dialog. A second call (effect re-run, double close) must not
  // decrement counts that another open dialog still holds.
  let released = false;
  return () => {
    if (released) return;
    released = true;
    for (const el of marked) {
      const mark = inertMarks.get(el);
      if (!mark) continue;
      mark.count -= 1;
      if (mark.count === 0) {
        inertMarks.delete(el);
        if (!mark.wasInert) el.removeAttribute("inert");
      }
    }
  };
}

// Test seam: the number of elements currently held inert by open dialogs.
export function __inertMarkCount(): number {
  return inertMarks.size;
}

export function useDialogFocus(open: boolean, containerRef: React.RefObject<HTMLElement | null>) {
  const triggerRef = useRef<Element | null>(null);

  useEffect(() => {
    if (!open) return;
    triggerRef.current = document.activeElement;

    const container = containerRef.current;
    if (!container) return;
    const restoreBackground = inertOutside(container);

    const focusable = () =>
      Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter((el) => el.offsetParent !== null);

    // Deferred one frame: content driven by props (e.g. a typed-confirmation
    // Input that only renders once `requireTypedConfirmation` is true) may
    // not be in the DOM yet on the same tick this effect runs.
    const raf = requestAnimationFrame(() => {
      // A caller may mark the safe action (e.g. Cancel on a destructive dialog)
      // with data-initial-focus; it wins over DOM order. Otherwise the first control.
      const marked = container.querySelector<HTMLElement>("[data-initial-focus]");
      const first = marked ?? focusable()[0];
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
      restoreBackground();
      if (triggerRef.current instanceof HTMLElement) triggerRef.current.focus();
    };
  }, [open, containerRef]);
}
