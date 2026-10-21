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
 * - **`useLayoutEffect` on the client**, with scene setup deferred one frame
 *   until the parent smoother exists. Reveals leave already-visible content alone.
 * - **Setup failure restores recorded styles**, and returned cleanup functions
 *   release native listeners alongside GSAP's own animations and triggers.
 * - **One effective motion setting, live.** `reduced` follows the OS preference
 *   (`useAmbientMotion`, which subscribes to the media query). A change reverts the
 *   context and re-runs setup on the other branch, so turning reduced motion on mid-scene
 *   rebuilds the static branch instead of leaving a half-played timeline or an orphaned
 *   pin spacer. The visitor-facing Pause control was removed; nothing else feeds this.
 */

let registered = false;
// Keep this aligned with SmoothScroll's width/pointer eligibility. Motion preference
// changes already rebuild the scene through the `reduced` dependency below.
const DESKTOP_SCROLLER = "(min-width: 1024px) and (pointer: fine)";

const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

export function useGsap(
  scope: RefObject<HTMLElement | null>,
  setup: (ctx: { gsap: typeof gsap; ScrollTrigger: typeof ScrollTrigger; reduced: boolean }) => void | (() => void),
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
    let frame = 0;
    const build = () => {
      frame = 0;
      // Own the context before setup, so a partially built scene can still be reverted.
      ctx = gsap.context(() => {}, scope);
      let failed = false;
      let setupError: unknown;
      ctx.add(() => {
        // Catch inside the context callback: GSAP restores its active context only
        // after this callback returns. A thrown callback would skip that restoration.
        try {
          return setupRef.current({ gsap, ScrollTrigger, reduced });
        } catch (error) {
          failed = true;
          setupError = error;
        }
      });
      if (failed) {
        ctx.revert();
        console.error("Homepage motion setup failed; restored the static content.", setupError);
      }
    };
    const rebuild = () => {
      window.cancelAnimationFrame(frame);
      ctx?.revert();
      ctx = null;
      // SmoothScroll synchronously switches its wrapper proxy in the same media-query
      // event. Build after that switch; triggers otherwise retain the removed scroller.
      frame = window.requestAnimationFrame(build);
    };
    const scrollerQuery = window.matchMedia(DESKTOP_SCROLLER);
    scrollerQuery.addEventListener("change", rebuild);
    rebuild();
    return () => {
      scrollerQuery.removeEventListener("change", rebuild);
      window.cancelAnimationFrame(frame);
      ctx?.revert();
    };
  }, [reduced, ...deps]);
}
