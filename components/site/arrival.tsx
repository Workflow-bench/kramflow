"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { SplitText } from "gsap/SplitText";
import { useReduced } from "./motion";
import { arrivalEligible, readArrivalFlag, writeArrivalFlag } from "./arrival-eligibility";
import { LoadingScreen, LOADING_WORDS } from "./loading-screen";

/**
 * The entrance: a full-viewport loading screen, once, on a first visit.
 *
 * It is still a class, not a blocking script. `html.arrival-running` switches on the
 * CSS keyframes that already exist in the page (the warm band through the hero, the
 * wordmark settle) and makes `.loading-screen` visible; without JavaScript the class
 * is never added, so the server-rendered page — hero fully present underneath — is the
 * page a no-JS visitor sees. The loading screen is `pointer-events-none` throughout:
 * it is never a gate a visitor has to get past, only a decoration in front of a page
 * that was already there and already interactive.
 *
 * Rules this component keeps:
 * - It never hides real content. The loading screen covers it visually for one short
 *   beat and then wipes away; nothing underneath is ever removed or made inert.
 * - It runs once per browser session and only for a top-of-page normal navigation
 *   (see arrival-eligibility.ts). Storage is written only when the sequence completes
 *   or is interrupted by the visitor, never in effect cleanup, so React Strict Mode's
 *   immediate mount/unmount cannot consume the visit.
 * - Any scroll, key, pointer or touch input ends it at once, with a quick fade rather
 *   than a hard cut. The listeners observe the event and never call preventDefault, so
 *   the interaction still happens underneath.
 * - Changing reduced motion mid-sequence settles the page immediately.
 * - If SplitText or the timeline construction throws for any reason, the page falls
 *   back to a plain timed settle — a GSAP error can never leave the screen stuck.
 */

let registered = false;
const FALLBACK_MS = 1300;
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

    const overlay = document.querySelector<HTMLElement>(".loading-screen");
    let ctx: ReturnType<typeof gsap.context> | null = null;
    let splits: SplitText[] = [];
    let timer: number | null = null;

    // The GSAP-driven curtain. Falls back to a plain class-timed settle (no loading
    // screen motion, same CSS entrance as before) if anything here throws — a broken
    // SplitText split must never leave an opaque, stuck cover over the page.
    const build = (): gsap.core.Timeline | null => {
      if (!overlay) return null;
      if (!registered) {
        gsap.registerPlugin(SplitText);
        registered = true;
      }
      let tl: gsap.core.Timeline | null = null;
      ctx = gsap.context(() => {
        const wordEls = LOADING_WORDS.map(
          (w) => overlay.querySelector<HTMLElement>(`[data-word="${w}"]`)!
        ).filter(Boolean);
        splits = wordEls.map((el) => new SplitText(el, { type: "chars" }));
        gsap.set(overlay, { opacity: 1 });
        gsap.set(wordEls, { opacity: 0 });

        tl = gsap.timeline();
        wordEls.forEach((el, i) => {
          const chars = splits[i].chars;
          const isLast = i === wordEls.length - 1;
          tl!
            .set(el, { opacity: 1 })
            .fromTo(
              chars,
              { yPercent: 120, opacity: 0 },
              { yPercent: 0, opacity: 1, duration: 0.2, stagger: 0.006, ease: "power3.out" },
              "<"
            )
            .to({}, { duration: 0.05 }); // a short hold, so the word is actually read
          if (!isLast) {
            tl!
              .to(chars, { yPercent: -120, opacity: 0, duration: 0.1, stagger: 0.005, ease: "power2.in" })
              .set(el, { opacity: 0 });
          }
        });
        // The curtain: the whole screen rises away from the top, revealing the real,
        // already-rendered hero beneath it — not a second page, the same one.
        tl!.to(overlay, { scaleY: 0, duration: 0.32, ease: "power4.inOut", transformOrigin: "top" }, "+=0.03");
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
    const teardownMotion = () => {
      splits.forEach((s) => s.revert());
      ctx?.revert();
    };
    // `mark` is true only when the sequence ended on its own or the visitor overrode it.
    // Cleanup from unmount, Strict Mode or a reduced-motion change passes false.
    const finish = (mark: boolean) => {
      if (done) return;
      done = true;
      cleanup();
      root.classList.remove("arrival-running");
      if (mark) writeArrivalFlag(storage);
      if (tl && overlay && tl.progress() < 1) {
        // Interrupted mid-sequence: a quick, legible fade instead of a hard cut or a
        // frozen giant word.
        tl.kill();
        gsap.to(overlay, {
          opacity: 0,
          duration: 0.2,
          overwrite: true,
          onComplete: teardownMotion,
        });
      } else {
        tl?.kill();
        teardownMotion();
      }
    };
    finishRef.current = finish;

    if (tl) {
      tl.eventCallback("onComplete", () => finish(true));
    } else {
      // No GSAP timeline (build failed, or `.loading-screen` wasn't found): keep the
      // page's other arrival beats and settle on the same timed budget as before.
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
        root.classList.remove("arrival-running");
        tl?.kill();
        teardownMotion();
      }
      finishRef.current = null;
    };
  }, [reduced]);

  return <LoadingScreen />;
}
