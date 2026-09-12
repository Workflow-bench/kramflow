"use client";

import { useRef } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ProductShot } from "./product-shot";
import { AppWindow } from "./app-window";
import { useGsap } from "./use-gsap";

/**
 * The hero, rebuilt.
 *
 * The previous version set the headline *on top of* a full-bleed console
 * and dimmed the console with a scrim so the type would read. Two things
 * were wrong with that, and both were visible rather than theoretical:
 *
 * 1. **The product was being upscaled, badly.** The capture is 1680×1050
 *    CSS. The container was `w-[122%]`, which scales with the viewport
 *    and has no ceiling, so the console rendered at 1.05× at 1440, 1.39×
 *    at 1920 and 1.45× at 2000 — while the headline stayed clamped at
 *    116px. The wider the screen, the more the product dwarfed the type,
 *    and an upscaled screenshot always reads as "zoomed", never as real.
 * 2. **A dimmed screenshot under type reads as an artifact, not a
 *    background.** Suppressing the rundown to make room for the headline
 *    turned the single most valuable evidence on the page into grey
 *    ghost-text that looked like a rendering fault.
 *
 * The rebuild inverts the relationship instead of tuning the compromise:
 *
 * - **Type and product never overlap.** The statement owns a clean band
 *   at the top; the console owns everything below it. Nothing is dimmed,
 *   so nothing ghosts, and the product is at full strength — which was
 *   the point of leading with it.
 * - **The product is never magnified past a sane bound.** Its width is
 *   `clamp(1500px, 118vw, 1900px)`, so it always bleeds past the right
 *   edge (never a centred card) but tops out at ~1.13× native instead of
 *   1.45×. A wider viewport now reveals *more console*, rather than a
 *   bigger one — which is how a window onto a real screen behaves.
 * - **The entrance is one plain fade, not a sequence of effects.** A
 *   staggered-line mask reveal on the headline plus a separate clip-path
 *   wipe on the console read as five different things happening in a
 *   row rather than a page arriving. Everything currently in the hero
 *   now fades to full opacity together, with a bare 60ms stagger so it
 *   isn't a single flat cut.
 *
 * What stays visible in the first viewport at 1440×900, checked rather
 * than assumed: the rundown with real item names, owners, start times and
 * durations; the green live row; LIVE NOW; Product Launch Demo; "1m behind
 * schedule"; the 13:51 countdown; NEXT and ON DECK.
 */

// The desktop band and the mobile crop are two <img> elements pointing at
// the same capture, and a CSS-hidden image still downloads. With separate
// `sizes` strings they resolved to different srcset candidates, so the
// page fetched the console five times at 1440 (w=1920, w=3840, w=750 ×2)
// and three times at 390. One shared breakpoint-aware string makes both
// elements pick the identical candidate, so the second is a cache hit.
const CONSOLE_SIZES = "(min-width: 1024px) 96vw, 320vw";

const TELEMETRY = ["LIVE", "DAY 1 MORNING", "4 / 7", "1M BEHIND", "4 SCREENS SYNCED"];

export function HeroSection() {
  const root = useRef<HTMLElement>(null);

  useGsap(root, ({ gsap, reduced }) => {
    if (reduced) {
      gsap.set("[data-hero-line]", { opacity: 1, yPercent: 0 });
      gsap.set(["[data-hero-meta]", "[data-hero-sub]", "[data-hero-cta]"], { opacity: 1, y: 0 });
      gsap.set("[data-hero-console]", { clipPath: "inset(0% 0% 0% 0%)", y: 0, opacity: 1 });
      return;
    }

    // Plain fade-in. The previous choreography staggered five separate
    // moves — metadata slide, five headline lines wiping up out of a
    // mask one by one, sub fading, CTA fading, then the console wiping
    // up via clip-path — which read as a sequence of effects rather than
    // a page arriving. This is one move: everything currently in the
    // hero fades to full opacity together, with only a hair of stagger
    // (60ms) so it doesn't look like a single flat cut.
    gsap.set(
      ["[data-hero-meta]", "[data-hero-line]", "[data-hero-sub]", "[data-hero-cta]", "[data-hero-console]"],
      { opacity: 0 }
    );
    gsap.to(["[data-hero-meta]", "[data-hero-line]", "[data-hero-sub]", "[data-hero-cta]", "[data-hero-console]"], {
      opacity: 1,
      duration: 0.9,
      ease: "power1.out",
      stagger: 0.06,
    });

    // Scroll: small enough to be felt rather than noticed.
    gsap.to("[data-hero-console]", {
      y: -46,
      ease: "none",
      scrollTrigger: { trigger: root.current, start: "top top", end: "bottom top", scrub: 0.6 },
    });
    gsap.to("[data-hero-copy]", {
      opacity: 0,
      y: -40,
      ease: "none",
      scrollTrigger: { trigger: root.current, start: "top top", end: "58% top", scrub: 0.6 },
    });
  });

  return (
    <section ref={root} className="relative overflow-hidden border-b border-line-soft lg:h-[100svh]">
      {/* ------------------------------------------------ the statement */}
      <div
        data-hero-copy
        className="relative z-10 mx-auto w-full max-w-[1600px] px-6 pt-[104px] will-change-transform sm:px-10 sm:pt-[124px]"
      >
        {/* Live telemetry, not a subtitle — the green rule ties it to the
            state it is reporting. Every value is true of the capture
            below it. This is the one Kramflow-specific flourish; the
            hero is not a HUD. */}
        <p
          data-hero-meta
          className="tnum flex flex-wrap items-center gap-x-2.5 gap-y-1 border-l border-status-green/50 pl-3 text-[10px] leading-none tracking-[0.2em] text-muted-2 sm:text-[11px]"
        >
          {TELEMETRY.map((value, i) => (
            <span key={value} className={i === 0 ? "text-status-green" : undefined}>
              {i === 0 ? "● " : null}
              {value}
              {i < TELEMETRY.length - 1 ? <span className="ml-2.5 text-muted-2/35">·</span> : null}
            </span>
          ))}
        </p>

        <div className="mt-6 flex flex-col gap-x-16 gap-y-7 sm:mt-7 lg:flex-row lg:items-end lg:justify-between">
          <h1 className="font-display text-[clamp(2.75rem,7vw,6rem)] text-primary">
            <span className="block overflow-hidden">
              <span data-hero-line className="block">
                Run the show
              </span>
            </span>
            <span className="block overflow-hidden">
              <span data-hero-line className="block">
                from one screen.
              </span>
            </span>
          </h1>

          {/* Supporting line and action sit on the headline's baseline at
              desktop, which keeps the whole statement to one band and
              leaves the rest of the viewport to the product. */}
          <div className="shrink-0 lg:pb-3">
            <p data-hero-sub className="max-w-[34ch] text-base leading-relaxed text-muted sm:text-lg">
              The live operations system for stage managers, AV operators and presenters.
            </p>
            <div data-hero-cta className="mt-6">
              <Link
                href="/signup"
                className="group inline-flex items-center gap-2 rounded-control bg-primary px-6 py-3 text-[15px] font-medium text-background transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                Start free
                <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" strokeWidth={2} />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* ------------------------------------------- the control surface */}
      {/* Desktop: the console inside a window frame, sized to the text
          grid and cropped by the bottom of the viewport.

          Framing it also fixed the scale bug for good. The console was
          previously a bleed sized in `vw`, which has no ceiling — it
          rendered at 1.05x native at 1440 but 1.45x at 2000, so the wider
          the screen the more the product dwarfed the type, and an
          upscaled screenshot always reads as "zoomed" rather than real.
          Inside the window it is bounded by the container, so it is
          always *down*-scaled (about 0.90x at 1440, 0.95x at 1920) and
          never magnified. */}
      <div className="relative mt-12 hidden overflow-hidden lg:block lg:h-full">
        <div data-hero-console className="mx-auto w-full max-w-[1600px] px-6 will-change-transform sm:px-10">
          <AppWindow label="/e/northwind-summit-2026/operator">
            <ProductShot shot="console" sizes={CONSOLE_SIZES} priority />
          </AppWindow>
        </div>
      </div>

      {/* Mobile: a hard crop of the live column at a scale it can actually
          be read at. A shrunk full console is an unreadable grey ghost —
          the offsets are percentages of this container's width so the crop
          holds from 320px up to the lg breakpoint. */}
      <figure className="mt-10 lg:hidden">
        <div className="relative h-[70vw] max-h-[300px] overflow-hidden border-y border-line-soft bg-black">
          <div style={{ width: "320%", marginLeft: "-160%", marginTop: "-18%" }}>
            <ProductShot shot="console" sizes={CONSOLE_SIZES} priority />
          </div>
        </div>
        <figcaption className="mt-3 px-6 text-console-label uppercase text-muted-2">Operator Console · live</figcaption>
      </figure>

      {/* Carries the hero's bottom edge into the next section. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 hidden h-[14%] lg:block"
        style={{ background: "linear-gradient(to top, #0c0b09 18%, transparent 100%)" }}
      />
    </section>
  );
}
