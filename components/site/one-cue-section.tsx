"use client";

import { useRef } from "react";
import { ProductShot, VenueScreen, type ShotKey } from "./product-shot";
import { AppWindow } from "./app-window";
import { useGsap } from "./use-gsap";

/**
 * "One cue. The room responds." — the signature moment of the page.
 *
 * The product's whole claim is that a single operator action lands
 * everywhere at once. Earlier versions of this page *asserted* that in a
 * sentence and drew a diagram of boxes and arrows next to it, which is an
 * illustration of a claim rather than the claim itself.
 *
 * This demonstrates it with real evidence: two complete capture passes of
 * the same seeded show, one cue apart. Set A has the Opening Keynote
 * live; set B has the Product Launch Demo live. Both were captured
 * against a genuinely running show carrying the same ~90-second variance,
 * so neither is a doctored "after" frame — they are two photographs of
 * one system in two real states.
 *
 * **Why this is a scrubbed GSAP timeline and not a crossfade.** The thing
 * being communicated is *propagation*: an order in which places in a
 * building find out. A simultaneous crossfade of four screens says
 * "these four images changed"; a timeline says "the console fired, then
 * the stage monitor, then the booth, then the speaker ready room, then
 * the lobby." The hairline connectors draw ahead of each screen so the
 * eye is led from cause to effect. The layout is spatial rather than a
 * 2×2 grid for the same reason — these are positions in a venue.
 *
 * The connectors are drawn with `scaleX`/`scaleY` on hairline divs
 * (compositor-friendly) rather than SVG stroke-dashoffset, and every
 * screen transition is opacity over a stacked pair. Nothing animates
 * layout.
 *
 * Scroll behaviour: the stage pins for the length of the timeline and
 * scrubs with native scroll. No scroll-jacking — no scroll hijack, no
 * custom scroller, no forced positions; the page scrolls at exactly the
 * speed the browser says it does, and the pin releases normally.
 *
 * Reduced motion: no pin, no scrub, no timeline. The section renders the
 * resolved state — console and all four screens showing the new cue —
 * with the propagation order carried by the numbered captions instead,
 * so the story survives intact rather than collapsing to a blank stage.
 */

interface Screen {
  before: ShotKey;
  after: ShotKey;
  label: string;
  note: string;
  /** Desktop placement inside the stage grid. */
  area: string;
  /** Which edge the connector enters from. */
  connector: "h" | "v";
}

const SCREENS: Screen[] = [
  {
    before: "presenterPrev",
    after: "presenter",
    label: "Stage confidence monitor",
    note: "The presenter's own clock resets.",
    area: "[grid-area:a]",
    connector: "h",
  },
  {
    before: "avPrev",
    after: "av",
    label: "AV booth",
    note: "The booth gets the new cue's mic, video and lighting.",
    area: "[grid-area:b]",
    connector: "h",
  },
  {
    before: "speakerReadyPrev",
    after: "speakerReady",
    label: "Speaker ready room",
    note: "The next speaker sees they are on deck.",
    area: "[grid-area:c]",
    connector: "h",
  },
  {
    before: "generalPrev",
    after: "general",
    label: "Lobby display",
    note: "The audience outside the room sees what is on stage.",
    area: "[grid-area:d]",
    connector: "h",
  },
];

export function OneCueSection() {
  const root = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);

  useGsap(root, ({ gsap, reduced }) => {
    if (reduced) {
      gsap.set(["[data-after]", "[data-console-after]"], { opacity: 1 });
      gsap.set("[data-wire]", { scaleX: 1, opacity: 0.9 });
      gsap.set("[data-fired]", { opacity: 1 });
      return;
    }

    // `[data-console-after]` was missing from this reset — the console's
    // "after" image was never hidden, so it sat at its default opacity 1
    // from the very top of the scroll, before the timeline had run at
    // all. The `.to(…, { opacity: 1 })` below then animated 1 → 1, a
    // no-op: the console read as already-cut on load and never visibly
    // changed. Confirmed by measuring computed opacity at seven scroll
    // positions through the pin — it was "1" at every one, including the
    // first.
    gsap.set(["[data-after]", "[data-console-after]"], { opacity: 0 });
    gsap.set("[data-wire]", { scaleX: 0, transformOrigin: "left center", opacity: 0.9 });
    gsap.set("[data-fired]", { opacity: 0 });

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: root.current,
        start: "top top",
        end: "+=220%",
        pin: stage.current,
        scrub: 0.6,
        anticipatePin: 1,
      },
    });

    // Screens CUT, they do not dissolve — but a short *tweened* opacity
    // change is not actually a cut under `scrub`. ScrollTrigger's scrub
    // smooths the timeline's own progress toward wherever the scroll
    // position currently is, over up to 0.6s; that smoothing sweeps
    // through a tween's interior continuously no matter how short its
    // duration is, so any tween here — even one as short as 0.06 — still
    // has a real chance of being sampled mid-ramp. Confirmed directly:
    // scanning the pin in 15px steps found a dozen frames with opacity
    // strictly between 0 and 1 (0.49, 0.84, 0.96…) on individual screens —
    // exactly the double-exposure ghost this comment used to claim was
    // fixed by shortening the duration. A `set()` has no duration to be
    // caught inside: at whatever instant the (still scrub-smoothed)
    // timeline progress crosses its position, the property snaps in one
    // frame. Re-scanned the same 15px sweep after this change: zero
    // fractional frames.
    tl.to("[data-fired]", { opacity: 1, duration: 0.2 })
      .set("[data-console-after]", { opacity: 1 })
      // The signal leaves the console before anything downstream moves.
      .to("[data-wire]", { scaleX: 1, duration: 0.55, ease: "power2.inOut" }, ">");

    // 2..5 — it reaches each position in the building, in order.
    SCREENS.forEach((_, i) => {
      tl.set(`[data-after="${i}"]`, { opacity: 1 }, i === 0 ? ">-0.15" : ">+0.28");
    });

    // 6 — everything settles; hold on the resolved room.
    tl.to({}, { duration: 0.8 });
  });

  return (
    <section ref={root} id="one-cue" className="relative border-b border-line-soft">
      {/* ---------------------------------------------------------- desktop */}
      <div ref={stage} className="hidden h-screen flex-col justify-center overflow-hidden lg:flex">
        <div className="mx-auto w-full max-w-[1680px] px-10">
          <div className="flex items-baseline justify-between gap-8">
            <h2 className="font-display text-[clamp(2rem,3.4vw,3.25rem)] text-primary">One cue. The room responds.</h2>
            <p
              data-fired
              className="tnum shrink-0 text-[11px] uppercase tracking-[0.2em] text-status-green"
            >
              ● Next pressed · 4 screens synced
            </p>
          </div>

          <div
            className="mt-8 grid items-center gap-x-8 gap-y-5"
            style={{
              gridTemplateColumns: "minmax(0,1.35fr) 5rem minmax(0,1fr) minmax(0,1fr)",
              gridTemplateAreas: `"console wire a b" "console wire c d"`,
            }}
          >
            {/* The cause. One window, drawn once — the chrome is static
                furniture that does not change between cues, so it sits
                outside the before/after cut. Only the content area (the
                `relative` slot AppWindow wraps children in) stacks the two
                captures and cross-cuts between them; wrapping each capture
                in its own window would have doubled the chrome bar and
                broken the "one screen, one state change" reading. */}
            <div className="[grid-area:console]">
              <AppWindow label="/e/northwind-summit-2026/operator" className="shadow-[0_50px_140px_-40px_rgba(0,0,0,0.9)]">
                <ProductShot shot="consolePrev" sizes="46vw" />
                <div data-console-after className="absolute inset-0">
                  <ProductShot shot="console" sizes="46vw" />
                </div>
              </AppWindow>
              <p className="mt-3 text-console-label uppercase text-muted-2">Operator console</p>
            </div>

            {/* The bus: one trunk out of the console, four taps into the room. */}
            <div className="[grid-area:wire] relative -mx-4 h-full" aria-hidden="true">
              {[25, 75].map((top) => (
                <div key={top} className="absolute inset-x-0" style={{ top: `${top}%` }}>
                  <div data-wire className="h-px w-full origin-left bg-status-green/45" />
                  <div className="absolute left-0 top-0 h-[7px] w-[7px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-status-green" />
                  <div className="absolute right-0 top-0 h-[5px] w-[5px] translate-x-1/2 -translate-y-1/2 rounded-full bg-status-green/70" />
                </div>
              ))}
            </div>

            {/* The effects. */}
            {SCREENS.map((screen, i) => (
              <div key={screen.label} className={screen.area}>
                <div className="relative overflow-hidden rounded-[0.4rem] bg-black ring-1 ring-line-soft">
                  <ProductShot shot={screen.before} sizes="22vw" />
                  <div data-after={i} className="absolute inset-0">
                    <ProductShot shot={screen.after} sizes="22vw" />
                  </div>
                </div>
                <p className="mt-2 text-console-label uppercase text-muted-2">
                  <span className="tnum mr-2 text-muted-2/60">{String(i + 2).padStart(2, "0")}</span>
                  {screen.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ----------------------------------------------------------- mobile */}
      <div className="px-6 py-20 lg:hidden">
        <h2 className="font-display text-[clamp(1.875rem,7vw,2.5rem)] text-primary">One cue. The room responds.</h2>
        <p className="mt-5 max-w-[46ch] leading-relaxed text-muted">
          The operator presses Next once. Every screen in the building changes together.
        </p>
        <div className="mt-10 space-y-9">
          <div>
            <p className="tnum mb-3 text-[11px] uppercase tracking-[0.18em] text-status-green">01 · Operator presses Next</p>
            {/* A full 1680px-wide 3-column console squeezed to ~350px is an
                unreadable grey ghost — same crop technique the hero uses
                on mobile: a hard crop of the live column at a scale where
                item names, the countdown and NEXT/ON DECK are legible,
                rather than the whole console illegibly. */}
            <div className="relative h-[70vw] max-h-[300px] overflow-hidden rounded-[0.35rem] border border-line-soft bg-black">
              <div style={{ width: "320%", marginLeft: "-160%", marginTop: "-18%" }}>
                <ProductShot shot="console" sizes="320vw" />
              </div>
            </div>
          </div>
          {SCREENS.map((screen, i) => (
            <div key={screen.label}>
              <p className="tnum mb-3 text-[11px] uppercase tracking-[0.18em] text-muted-2">
                {String(i + 2).padStart(2, "0")} · {screen.label}
              </p>
              <VenueScreen shot={screen.after} label="" sizes="100vw" />
              <p className="mt-1 max-w-[44ch] text-console-meta text-muted-2">{screen.note}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
