"use client";

import { useRef } from "react";
import { LinkButton } from "@/components/ui/button";
import { HeroScene } from "./hero-scene";

/**
 * The hero, composed as approved (landing-auth design D04, D06, D07): copy, support and
 * actions on the left at roughly 45%, one labelled product scene on the right at roughly 55%.
 * Everything is in the server HTML and visible immediately. Motion is one short settle of the
 * headline lines. Nothing fades or moves with scroll, and nothing shows a wall clock (CD-F6).
 *
 * The copy has no framer-motion wrapper. Its entrance is CSS (`hero-rise`, transform only, off
 * under reduced motion), so the LCP text paints from the server HTML without waiting for hydration.
 */

export function HeroSection() {
  const root = useRef<HTMLElement>(null);

  return (
    <section data-cue="Standby" ref={root} className="relative overflow-hidden border-b border-line-soft">
      <div className="mx-auto grid w-full max-w-[1600px] items-center gap-12 px-6 pb-16 pt-[104px] sm:px-10 sm:pt-[124px] lg:min-h-[100svh] lg:grid-cols-[minmax(0,45fr)_minmax(0,55fr)] lg:gap-14 lg:pb-20">
        <div className="flex flex-col">
          <h1 className="font-display text-[clamp(2.75rem,6vw,5.5rem)] text-primary">
            <span className="block">Run the show</span>
            <span className="block">from one screen.</span>
          </h1>

          <p className="mt-6 max-w-[38ch] text-base leading-relaxed text-muted sm:text-lg">
            Plan the rundown, rehearse the cues, and run the room from one console.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <LinkButton href="/signup" variant="primary" size="hero">
              Start free
            </LinkButton>
            <LinkButton href="#demo" variant="secondary" size="hero">
              Try a cue
            </LinkButton>
          </div>
        </div>

        <div className="hero-rise">
          <HeroScene />
        </div>
      </div>
    </section>
  );
}
