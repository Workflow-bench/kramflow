"use client";

import { useLayoutEffect, useRef } from "react";
import { gsap } from "gsap";
import { useReduced } from "./motion";
import { arrivalEligible, readArrivalFlag, writeArrivalFlag } from "./arrival-eligibility";
import { LoadingScreen, LOADING_WORDS } from "./loading-screen";

/**
 * The entrance: a full-viewport loading screen, once, on a first visit.
 *
 * Boot and running are two separate classes on purpose:
 * - `arrival-boot` is added synchronously, before first paint, by the inline script in
 *   app/page.tsx (a cheap, approximate copy of arrivalEligible's rule — no React, no
 *   storage write, just enough to decide "cover or don't" before the browser paints a
 *   single pixel). Its only job is to stop the real hero flashing into view before this
 *   component has even hydrated, which is what an effect-driven-only class produces:
 *   the server HTML paints the settled hero, then, a beat later, this effect covers it,
 *   then uncovers it again — a visible double-reveal, not an entrance.
 * - `arrival-running` is added here, by the real eligibility check (the full one, with
 *   session storage and navigation type), and is what actually drives the GSAP
 *   timeline. Both classes show the same solid cover in CSS, so the handoff between
 *   them is invisible.
 * - If the boot script's optimistic guess turns out wrong — reduced motion, a deep
 *   link, a restored scroll position, a session that already saw it — this runs in
 *   `useLayoutEffect`, before the browser paints, and removes `arrival-boot` at once.
 *   The visible cost of a wrong guess is nothing: no frame is ever painted with it.
 *
 * Everything else keeps the rules from the previous version:
 * - It never hides real content. The loading screen covers it visually for one short
 *   beat and then slides away; nothing underneath is ever removed or made inert.
 * - It runs once per browser session and only for a top-of-page normal navigation
 *   (see arrival-eligibility.ts). Storage is written only when the sequence completes
 *   or is interrupted by the visitor, never in effect cleanup, so React Strict Mode's
 *   immediate mount/unmount cannot consume the visit.
 * - Any scroll, key, pointer or touch input ends it at once, with a quick fade rather
 *   than a hard cut. The listeners observe the event and never call preventDefault, so
 *   the interaction still happens underneath.
 * - Changing reduced motion mid-sequence settles the page immediately.
 * - If GSAP throws building the timeline for any reason, the page falls back to a
 *   plain timed settle — an error can never leave the screen stuck.
 *
 * Source (word sequence and its timing): Osmo's "Welcoming Words Loader" — see
 * loading-screen.tsx for the full reference note.
 */

const FALLBACK_MS = 1300;
const SCROLL_TOLERANCE = 4;
const WORD_HOLD_MS = 280;

export function Arrival() {
  const reduced = useReduced();
  const finishRef = useRef<((mark: boolean) => void) | null>(null);

  useLayoutEffect(() => {
    const root = document.documentElement;

    if (reduced) {
      root.classList.remove("arrival-boot");
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
    if (!eligible) {
      root.classList.remove("arrival-boot");
      return;
    }

    const startY = window.scrollY;
    root.classList.add("arrival-running");

    const overlay = document.querySelector<HTMLElement>(".loading-screen");
    const wordEl = overlay?.querySelector<HTMLElement>("[data-loading-word]") ?? null;
    let ctx: ReturnType<typeof gsap.context> | null = null;
    let timer: number | null = null;

    const build = (): gsap.core.Timeline | null => {
      if (!overlay || !wordEl) return null;
      let tl: gsap.core.Timeline | null = null;
      ctx = gsap.context(() => {
        gsap.set(overlay, { opacity: 1 });
        gsap.set(wordEl, { yPercent: 50, opacity: 1 });
        tl = gsap.timeline();
        // The entrance: one confident slide into place, Osmo's own curve for it.
        tl.to(wordEl, { yPercent: 0, duration: 1, ease: "expo.inOut" });
        // The remaining words swap in place while the track holds still — a plain
        // text-content update at a fixed cadence, not a tween per word. The slide
        // already delivered the motion; cutting the text under a still element reads
        // as a confident cycle, not a stutter, exactly as the reference does it.
        for (const word of LOADING_WORDS.slice(1)) {
          tl.call(() => {
            if (wordEl) wordEl.textContent = word;
          }, undefined, `+=${WORD_HOLD_MS / 1000}`);
        }
        tl.to({}, { duration: WORD_HOLD_MS / 1000 }); // hold on the last word before exit
        // The exit: slides further up and fades, Osmo's own curve again.
        tl.to(wordEl, { yPercent: -75, opacity: 0, duration: 0.8, ease: "expo.in" });
        // The curtain: the whole screen rises away, revealing the real, already
        // rendered hero beneath it — not a second page, the same one.
        tl.to(overlay, { scaleY: 0, duration: 0.45, ease: "power4.inOut", transformOrigin: "top" }, "-=0.25");
      }, overlay);
      return tl;
    };

    let tl: gsap.core.Timeline | null = null;
    try {
      tl = build();
    } catch {
      tl = null;
    }

    let done = false;
    const cleanup = () => {
      if (timer !== null) window.clearTimeout(timer);
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
      root.classList.remove("arrival-running", "arrival-boot");
      if (mark) writeArrivalFlag(storage);
      if (tl && overlay && tl.progress() < 1) {
        // Interrupted mid-sequence: a quick, legible fade instead of a hard cut or a
        // frozen giant word.
        tl.kill();
        gsap.to(overlay, {
          opacity: 0,
          duration: 0.2,
          overwrite: true,
          onComplete: () => ctx?.revert(),
        });
      } else {
        tl?.kill();
        ctx?.revert();
      }
    };
    finishRef.current = finish;

    if (tl) {
      tl.eventCallback("onComplete", () => finish(true));
    } else {
      // No GSAP timeline (build failed, or the markup wasn't found): keep the page's
      // other arrival beats and settle on the same timed budget as before.
      root.classList.remove("arrival-boot");
      timer = window.setTimeout(() => finish(true), FALLBACK_MS);
    }

    const onScroll = () => {
      if (Math.abs(window.scrollY - startY) > SCROLL_TOLERANCE) finish(true);
    };
    const interrupt = () => finish(true);
    const onVisibility = () => {
      // A hidden tab stops GSAP's ticker; end the class so the page is settled on return.
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
        root.classList.remove("arrival-running", "arrival-boot");
        tl?.kill();
        ctx?.revert();
      }
      finishRef.current = null;
    };
  }, [reduced]);

  return <LoadingScreen />;
}
