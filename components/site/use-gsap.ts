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
 * - **One effective motion setting, live.** `reduced` follows the OS preference
 *   (`useAmbientMotion`, which subscribes to the media query). A change reverts the
 *   context and re-runs setup on the other branch, so turning reduced motion on mid-scene
 *   rebuilds the static branch instead of leaving a half-played timeline or an orphaned
 *   pin spacer. The visitor-facing Pause control was removed; nothing else feeds this.
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

  // Subscribed to the OS preference; re-renders when it changes.
  const motionAllowed = useAmbientMotion();
  const reduced = !motionAllowed;

  useIsomorphicLayoutEffect(() => {
    if (!registered) {
      gsap.registerPlugin(ScrollTrigger);
      registered = true;
    }
    // Build the scene one frame after commit. Layout effects run children first, so a scene
    // created synchronously would be measured before the parent smoother (created in the same
    // commit by SmoothScroll) exists. The frame defers the build; it does not by itself prove
    // the order. The order was checked in a browser: smoother-create precedes every scene build
    // on load, Strict Mode remount, breakpoint rebuild and reload (evidence/order). The frame
    // is cancelled if the scene unmounts or its settings change first.
    let ctx: ReturnType<typeof gsap.context> | null = null;
    const frame = window.requestAnimationFrame(() => {
      ctx = gsap.context(() => setupRef.current({ gsap, ScrollTrigger, reduced }), scope);
    });
    return () => {
      window.cancelAnimationFrame(frame);
      ctx?.revert();
    };
  }, [reduced, ...deps]);
}
