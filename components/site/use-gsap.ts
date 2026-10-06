"use client";

import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useAmbientMotion } from "./motion-state";

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
 * - **One effective motion setting, live.** `reduced` is the OS preference OR the
 *   page's own Pause control (HF-03). It used to watch only the OS query, so Pause
 *   stopped the shader while GSAP-driven navigation and scenes kept moving. Both
 *   inputs are subscribed to, and a change to either reverts the context and re-runs
 *   setup on the other branch — so turning motion off mid-scene rebuilds the static
 *   branch instead of leaving a half-played timeline or an orphaned pin spacer.
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

  // `useAmbientMotion` already folds the OS preference and the Pause control together
  // and re-renders on either changing.
  const motionAllowed = useAmbientMotion();
  const reduced = !motionAllowed;

  useIsomorphicLayoutEffect(() => {
    if (!registered) {
      gsap.registerPlugin(ScrollTrigger);
      registered = true;
    }
    const ctx = gsap.context(() => setupRef.current({ gsap, ScrollTrigger, reduced }), scope);
    return () => ctx.revert();
  }, [reduced, ...deps]);
}
