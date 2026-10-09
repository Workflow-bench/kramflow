"use client";

import { useLayoutEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useReduced } from "./motion";

let registered = false;

/**
 * A thin bar above the nav, its width tied to scroll progress through the page — a
 * quiet, always-correct "how far down this page am I" signal, not a decoration. Built
 * directly on ScrollTrigger's own progress callback (`gsap.com/docs/v3/Plugins/
 * ScrollTrigger`), scrubbed to the real scroller `SmoothScroll` already owns, not a
 * second scroll listener. `transform: scaleX`, never `width`, so this never triggers
 * layout on scroll. Reduced motion renders a plain, unanimated bar instead (still
 * useful as a static landmark, never a moving one).
 */
export function ScrollProgress() {
  const barRef = useRef<HTMLDivElement>(null);
  const reduced = useReduced();

  useLayoutEffect(() => {
    const bar = barRef.current;
    if (!bar || reduced) return;
    if (!registered) {
      gsap.registerPlugin(ScrollTrigger);
      registered = true;
    }
    const ctx = gsap.context(() => {
      gsap.set(bar, { scaleX: 0, transformOrigin: "left center" });
      ScrollTrigger.create({
        trigger: document.getElementById("main-content") ?? document.body,
        start: "top top",
        end: "bottom bottom",
        onUpdate: (self) => gsap.set(bar, { scaleX: self.progress }),
      });
    });
    return () => ctx.revert();
  }, [reduced]);

  return (
    <div aria-hidden="true" className="scroll-progress-track fixed inset-x-0 top-0 z-[55] h-[2px]">
      <div ref={barRef} className="scroll-progress-bar h-full w-full" />
    </div>
  );
}
