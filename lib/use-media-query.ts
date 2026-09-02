"use client";

import { useSyncExternalStore } from "react";

// Real DOM reordering (see app/e/[eventId]/operator/page.tsx) needs to know
// the *current* breakpoint in JS, not just in CSS — a `useMediaQuery` hook
// is the one place that's unavoidable. Deliberately not built on CSS
// `order`/`grid-column` placement instead: those reorder the visual layout
// but never the DOM/tab order, so a screen-reader or keyboard user would
// still hit the cue list before Next/Hold on mobile even after a purely
// visual reorder — see the 2026-09-01 audit's P1 finding #3 for exactly
// that failure mode, which this hook exists to fix for real.
//
// Defaults to `false` (the compact/mobile arrangement) before hydration —
// the safer failure mode for a live-show control surface: worst case,
// desktop sees one harmless reflow right after mount; the alternative
// (defaulting to the desktop order) would briefly reproduce the exact
// "controls buried below the cue list" bug this hook exists to prevent,
// for the mobile users it matters most for.
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (callback) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", callback);
      return () => mql.removeEventListener("change", callback);
    },
    () => window.matchMedia(query).matches,
    () => false
  );
}
