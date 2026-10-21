"use client";

import { useLayoutEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { HeroGradientBackdrop } from "./hero-gradient-backdrop";
import { ConsoleAperture } from "./console-aperture";
import { SiteAction } from "./site-action";
import { useReduced } from "./motion";

/**
 * The promise, and the instrument it is made with.
 *
 * The opening viewport has to carry four things at once: the navigation, the claim,
 * both actions, and enough of the real Operator Console that a visitor can see the
 * cue, the countdown and the controls. The previous hero had no height budget at
 * all, so the product started below the fold and the first screen was an empty
 * graphite field with a headline on it.
 *
 * So the section targets one viewport (`100svh`, header included) and spends that
 * budget deliberately: `.hero-copy` shrinks its type and gaps as the viewport gets
 * shorter (see globals.css), and whatever remains belongs to the console aperture.
 * `min-h`, never `h` — at browser zoom or large text the content is allowed to grow
 * past the viewport and scroll rather than being clipped to protect the effect.
 *
 * The operator is named once, here, and nowhere else on the page (HOME-R10): the rest
 * of the chapters describe tasks rather than re-introducing the audience.
 *
 * No STANDBY/GO ornament. Its amber-to-green cue light read as a live status
 * indicator for a visitor who has no show running, which is exactly the kind of
 * invented operational state this page must not display.
 *
 * Two small, scoped additions, built from first principles (not copied from any
 * reference — see this batch's handoff for the source note):
 * - The headline reveals word by word (blur + rise, GSAP, mount-only), decoupled
 *   from the full-viewport loading screen's own entrance so it plays consistently
 *   whether or not that sequence ran. Hidden state is only ever set client-side, in
 *   a layout effect, before paint — the server-rendered heading is always the
 *   settled, readable text, so no-JS and JS-failure both land on it with nothing to
 *   undo.
 * - The console aperture gets a faint scroll-linked tilt (ScrollTrigger scrub,
 *   `rotateX`/`perspective`, never affecting layout). A pair of floating status
 *   chips was tried here and removed: against the real capture they read as a
 *   stray dark pill, not part of the console, so the aperture now carries no
 *   overlay of its own.
 */

const HEADLINE_LINES = [
  ["Run", "the", "show"],
  ["from", "one", "screen."],
];

export function HeroSection() {
  const reduced = useReduced();
  const headlineRef = useRef<HTMLHeadingElement>(null);
  const apertureWrapRef = useRef<HTMLDivElement>(null);
  const tiltRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (reduced) return;
    const ctx = gsap.context(() => {
      if (headlineRef.current) {
        const words = headlineRef.current.querySelectorAll<HTMLElement>("[data-hero-word]");
        gsap.set(words, { opacity: 0, y: 16, filter: "blur(10px)" });
        gsap.to(words, {
          opacity: 1,
          y: 0,
          filter: "blur(0px)",
          duration: 0.7,
          stagger: 0.055,
          ease: "power2.out",
          delay: 0.1,
        });
      }
      if (tiltRef.current && apertureWrapRef.current) {
        gsap.registerPlugin(ScrollTrigger);
        gsap.set(tiltRef.current, { rotateX: 6, transformPerspective: 1400, transformOrigin: "center top" });
        gsap.to(tiltRef.current, {
          rotateX: 0,
          ease: "none",
          scrollTrigger: {
            trigger: apertureWrapRef.current,
            start: "top bottom",
            end: "top 55%",
            scrub: true,
          },
        });
      }
    });
    return () => ctx.revert();
  }, [reduced]);

  return (
    <section
      id="top"
      data-cue="Promise"
      className="hero-section relative isolate flex flex-col overflow-hidden"
    >
      <HeroGradientBackdrop />

      <div className="hero-copy relative z-10 mx-auto w-full max-w-[1440px] px-6 sm:px-10">
        {/* The entrance now lives in the full-viewport loading screen
            (components/site/loading-screen.tsx), which runs the same word sequence at
            hero scale before the curtain wipes to reveal this exact, real, unhidden label. */}
        <p className="hero-eyebrow flex items-center gap-2 uppercase tracking-[0.18em] text-muted-2">
          <span aria-hidden="true" className="inline-block h-1.5 w-1.5 rounded-full bg-status-green motion-safe:animate-pulse" style={{ boxShadow: "0 0 0 3px rgba(48,209,88,0.16)" }} />
          Live event operations
        </p>

        <h1
          ref={headlineRef}
          aria-label="Run the show from one screen."
          className="hero-title font-display tracking-[-0.0325em] text-primary"
        >
          {HEADLINE_LINES.map((line, i) => (
            <span key={i} aria-hidden="true" className="block">
              {line.map((word, j) => (
                <span key={j} data-hero-word className="inline-block">
                  {word}
                  {j < line.length - 1 ? " " : ""}
                </span>
              ))}
            </span>
          ))}
        </h1>

        <p className="hero-body max-w-[46ch] leading-relaxed text-muted">
          Stage managers and AV teams run the cue sheet, timers, and venue displays from one console.
        </p>

        <div className="hero-actions flex flex-wrap items-center gap-3">
          <SiteAction href="/signup" role="primary" size="hero">
            Start free
          </SiteAction>
          <SiteAction href="#prepare" role="quiet" size="hero">
            See how it works
          </SiteAction>
        </div>
      </div>

      {/* The aperture takes the viewport budget the copy did not use. */}
      <div ref={apertureWrapRef} className="hero-aperture-wrap relative z-10 mx-auto w-full max-w-[1440px] px-6 sm:px-10">
        <div ref={tiltRef} className="hero-aperture-tilt">
          <ConsoleAperture />
        </div>
      </div>
    </section>
  );
}
