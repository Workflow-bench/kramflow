"use client";

import { useEffect, useRef } from "react";
import { useReduced } from "./motion";
import { arrivalEligible, readArrivalFlag, writeArrivalFlag } from "./arrival-eligibility";

/**
 * The house-lights arrival: one short, choreographed entrance on a first visit.
 *
 * It is a class, not a script. `html.arrival-running` switches on CSS keyframes that
 * already exist in the page (the warm band through the hero, the wordmark settle, the
 * heading's light sweep, the aperture's top rule). Without JavaScript the class is never
 * added, so the server-rendered page is the settled page.
 *
 * Rules this component keeps:
 * - It never hides content. Every beat animates from a visible state, and the band is
 *   decorative with pointer events off.
 * - It runs once per browser session and only for a top-of-page normal navigation
 *   (see arrival-eligibility.ts). Storage is written only when the sequence completes or
 *   is interrupted by the visitor, never in effect cleanup, so React Strict Mode's
 *   immediate mount/unmount cannot consume the visit.
 * - Any scroll, key, pointer or touch input ends it at once. The listeners observe the
 *   event and never call preventDefault, so the interaction still happens.
 * - Changing reduced motion mid-sequence settles the page immediately.
 */

const TOTAL_MS = 1300;
const SCROLL_TOLERANCE = 4;

export function Arrival() {
  const reduced = useReduced();
  const finishRef = useRef<((mark: boolean) => void) | null>(null);

  useEffect(() => {
    if (reduced) {
      finishRef.current?.(false);
      return;
    }

    const nav = performance.getEntriesByType?.("navigation")[0] as PerformanceNavigationTiming | undefined;
    const storage = (() => {
      try {
        return window.sessionStorage;
      } catch {
        return null;
      }
    })();
    const eligible = arrivalEligible({
      stored: readArrivalFlag(storage),
      navigationType: nav?.type,
      scrollY: window.scrollY,
      hash: location.hash,
      reducedMotion: false,
    });
    if (!eligible) return;

    const root = document.documentElement;
    const startY = window.scrollY;
    root.classList.add("arrival-running");

    let done = false;
    const cleanup = () => {
      window.clearTimeout(timer);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("wheel", interrupt);
      window.removeEventListener("keydown", interrupt, true);
      window.removeEventListener("pointerdown", interrupt, true);
      window.removeEventListener("touchstart", interrupt, true);
      document.removeEventListener("visibilitychange", onVisibility);
    };
    // `mark` is true only when the sequence ended on its own or the visitor overrode it.
    // Cleanup from unmount, Strict Mode or a reduced-motion change passes false.
    const finish = (mark: boolean) => {
      if (done) return;
      done = true;
      cleanup();
      root.classList.remove("arrival-running");
      if (mark) writeArrivalFlag(storage);
    };
    finishRef.current = finish;

    const timer = window.setTimeout(() => finish(true), TOTAL_MS);
    const onScroll = () => {
      if (Math.abs(window.scrollY - startY) > SCROLL_TOLERANCE) finish(true);
    };
    const interrupt = () => finish(true);
    const onVisibility = () => {
      // A hidden tab stops CSS timelines; end the class so the page is settled on return.
      if (document.visibilityState === "hidden") finish(false);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("wheel", interrupt, { passive: true });
    window.addEventListener("keydown", interrupt, true);
    window.addEventListener("pointerdown", interrupt, true);
    window.addEventListener("touchstart", interrupt, { passive: true, capture: true });
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      // Unmount or Strict Mode teardown: stop the decoration, but leave storage untouched
      // so the visit is still available to the real mount.
      if (!done) {
        done = true;
        cleanup();
        root.classList.remove("arrival-running");
      }
      finishRef.current = null;
    };
  }, [reduced]);

  return null;
}
