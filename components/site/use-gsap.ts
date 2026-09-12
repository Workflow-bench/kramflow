"use client";

import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

/**
 * One place that owns GSAP setup, so every animated section on the page
 * gets the same lifecycle guarantees rather than each re-deriving them.
 *
 * What this enforces:
 *
 * - **Reduced motion is a first-class branch, not a disable switch.** The
 *   callback receives `reduced`; a section is expected to render its
 *   *resolved* state (the end of the story, not a blank stage) and skip
 *   the tweens. A page that hides its content behind an animation and
 *   then honours `prefers-reduced-motion` by not running the animation is
 *   simply broken for those users.
 * - **`gsap.context` scoping + revert on unmount**, which kills every
 *   tween and ScrollTrigger this section created. React Strict Mode
 *   double-invokes effects in development, so without this each section
 *   would silently accumulate a second set of ScrollTriggers.
 * - **`useLayoutEffect` on the client**, so the initial `gsap.set` lands
 *   before paint and nothing flashes in at full opacity first.
 */

let registered = false;

const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

export function useGsap(
  scope: RefObject<HTMLElement | null>,
  setup: (ctx: { gsap: typeof gsap; ScrollTrigger: typeof ScrollTrigger; reduced: boolean }) => void,
  deps: unknown[] = []
) {
  // Kept in a ref so the GSAP effect can stay on an explicit dependency
  // list without capturing a stale closure. Assigned in its own layout
  // effect rather than during render — mutating a ref while rendering is
  // a real correctness hazard under concurrent rendering, not a lint nit.
  const setupRef = useRef(setup);
  useIsomorphicLayoutEffect(() => {
    setupRef.current = setup;
  });

  useIsomorphicLayoutEffect(() => {
    if (!registered) {
      gsap.registerPlugin(ScrollTrigger);
      registered = true;
    }
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ctx = gsap.context(() => setupRef.current({ gsap, ScrollTrigger, reduced }), scope);
    return () => ctx.revert();
  }, deps);
}
