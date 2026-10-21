"use client";

import { useRef } from "react";
import { AmbientLight } from "./ambient-light";
import { SiteAction } from "./site-action";
import { useGsap } from "./use-gsap";
import { revealSection } from "./reveal";

/**
 * The next show — the close.
 *
 * One statement, one action, one way back into the recorded example. Neutral static
 * depth echoes the opening; an offset action column gives the close its own rhythm.
 *
 * No invented proof: no pricing, logos, customer names, uptime figures, counts or
 * "no credit card" reassurance. None of those are confirmed, so none are published.
 */
export function ClosingSection() {
  const root = useRef<HTMLElement>(null);

  useGsap(root, ({ gsap, ScrollTrigger, reduced }) => revealSection(root.current!, { gsap, ScrollTrigger, reduced }));

  return (
    <section ref={root} data-cue="The next show" className="relative isolate overflow-hidden">
      <AmbientLight variant="echo" />
      <div className="relative z-10 mx-auto w-full max-w-[1440px] px-6 py-28 sm:px-10 lg:py-40">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,60fr)_minmax(0,40fr)] lg:items-end lg:gap-16">
          <h2 data-reveal="heading" className="mt-5 max-w-[14ch] font-display text-[clamp(2.25rem,5vw,4.5rem)] leading-[1.02] tracking-[-0.025em] text-primary">
            Your next show. One console.
          </h2>
          <div className="lg:pb-1">
            <p data-reveal="copy" className="mt-0 max-w-[40ch] text-[17px] leading-relaxed text-muted">
              Prepare the cues. Rehearse the handoffs. Run the room.
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-3">
              <SiteAction href="/signup" role="primary" size="hero">
                Start free
              </SiteAction>
              <SiteAction href="#call" role="quiet" size="hero">
                Explore the show again
              </SiteAction>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
