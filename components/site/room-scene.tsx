"use client";

import { useEffect, useRef, useState } from "react";
import type { ShotKey } from "./product-shot";
import { ConsoleReplica } from "./replica/console-replica";
import { PresenterReplica, AVReplica, GreenRoomReplica, GeneralReplica } from "./replica/display-replicas";
import { AppWindow } from "./app-window";
import { SegmentedSelector, type SegmentedItem } from "./segmented-selector";
import { useGsap } from "./use-gsap";

/**
 * "One cue. The room responds." — the page's signature composition.
 *
 * Adapted from the stored `one-cue-section.tsx` (ui-revamp `6d69834`), which already had
 * the right premise: the real console on the left, the four real receiving views on the
 * right, and scroll — not a button — moving the recorded sequence. The replaced version
 * had turned that into a giant console crop with a manual Advance control and its
 * consequence pushed below the fold.
 *
 * **What the scroll does.** One bounded, pinned desktop stage plays six beats: the
 * before scene settles, the console cuts to its after capture, a thin connection path
 * draws outward, the four display frames cut in order, and the resolved room holds
 * briefly before native scrolling releases into the next chapter. Scrubbing backwards
 * reverses it, because every state is a discrete `set()` on a scrubbed timeline rather
 * than an entrance that only plays forwards.
 *
 * **Frames cut; framing moves.** Product pixels never crossfade — two recorded clocks
 * dissolving through each other would read as a double exposure of times that never
 * existed. `set()` has no interior for the scrub to land inside, so a frame is either
 * the before capture or the after capture. The motion belongs to the external framing,
 * the connection path and the caption.
 *
 * **Staging is editorial, not latency.** The displays are staged in order because that
 * is how the eye reads a room, not because anything measured that order. Nothing here
 * claims simultaneous delivery, and the scene never announces a resolved room while it
 * is still between phases (HF-06).
 *
 * **Gating.** The pin and scrub are built only on a desktop-width viewport with motion
 * allowed; `useGsap` folds the OS preference and the page's Pause control into one
 * setting and rebuilds this effect when either changes, so switching mid-scene swaps to
 * the readable resolved composition instead of stranding a pin spacer. Mobile never
 * builds a pin at all and gets a proportionate image with an accessible view selector,
 * not four unreadable stamps.
 */

interface Screen {
  before: ShotKey;
  after: ShotKey;
  /** The product's own canonical role name (lib/display-engine/types.ts). */
  label: string;
  note: string;
  area: string;
}

const SCREENS: Screen[] = [
  {
    before: "presenterPrev",
    after: "presenter",
    label: "Presenter",
    note: "The speaker's own countdown restarts.",
    area: "[grid-area:a]",
  },
  {
    before: "avPrev",
    after: "av",
    label: "AV",
    note: "The booth picks up the new item's requirements.",
    area: "[grid-area:b]",
  },
  {
    before: "speakerReadyPrev",
    after: "speakerReady",
    label: "Green Room",
    note: "Backstage sees who is on now and who is next.",
    area: "[grid-area:c]",
  },
  {
    before: "generalPrev",
    after: "general",
    label: "General",
    note: "The lobby shows what is running in the room.",
    area: "[grid-area:d]",
  },
];

// Beats of the recorded sequence. The label changes only where a frame actually cuts, so
// it never describes a state the stage has not painted.
const PHASES = [
  "Before the cue · Opening Keynote",
  "Console cut · Product Launch Demo",
  "Reaching the room",
  "Display views updated",
] as const;

// The four display replicas, keyed by the product's canonical role name.
function renderScreen(role: string, cue: 3 | 4) {
  const label = `${role} display, cue ${cue}`;
  if (role === "Presenter") return <PresenterReplica cue={cue} label={label} />;
  if (role === "AV") return <AVReplica cue={cue} label={label} />;
  if (role === "Green Room") return <GreenRoomReplica cue={cue} label={label} />;
  return <GeneralReplica cue={cue} label={label} />;
}

const MOBILE_VIEWS: readonly SegmentedItem[] = SCREENS.map((s) => ({ value: s.label, label: s.label }));


export function RoomScene() {
  const root = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const [isDesktop, setIsDesktop] = useState<boolean | null>(null);
  const [phase, setPhase] = useState(0);
  const [mobileView, setMobileView] = useState(SCREENS[0].label);

  // Breakpoint is state, so the GSAP setup can be rebuilt when it changes rather than
  // leaving a desktop pin spacer behind on a resize down to mobile.
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const sync = () => setIsDesktop(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useGsap(
    root,
    ({ gsap, reduced }) => {
      // Resolved, readable, static: motion off, or a viewport too narrow for the stage.
      if (reduced || !isDesktop) {
        gsap.set(["[data-after]", "[data-console-after]"], { opacity: 1 });
        gsap.set("[data-path]", { scaleX: 1, opacity: 0.9 });
        setPhase(PHASES.length - 1);
        return;
      }

      gsap.set(["[data-after]", "[data-console-after]"], { opacity: 0 });
      gsap.set("[data-path]", { scaleX: 0, transformOrigin: "left center", opacity: 0.9 });
      setPhase(0);

      // The caption is derived from what is actually painted, never from timeline
      // callbacks. `tl.call()` does not fire dependably while scrubbing backwards, so a
      // callback-driven label drifts out of agreement with the frames — measured here
      // saying "Display views updated" while the displays had already cut back to their
      // before captures. Reading the committed opacities instead means the label cannot
      // describe a state the stage has not painted, in either scroll direction.
      const sync = () => setPhase((prev) => {
        const next = readPhase();
        return next === prev ? prev : next;
      });

      const readPhase = () => {
        const root1 = root.current;
        if (!root1) return 0;
        const consoleOn = Number(getComputedStyle(root1.querySelector("[data-console-after]")!).opacity) > 0.5;
        const shown = [...root1.querySelectorAll("[data-after]")].filter(
          (el) => Number(getComputedStyle(el).opacity) > 0.5
        ).length;
        if (!consoleOn) return 0;
        if (shown === 0) return 1;
        if (shown < SCREENS.length) return 2;
        return 3;
      };

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: root.current,
          start: "top top",
          end: "+=220%",
          pin: stage.current,
          scrub: 0.6,
          anticipatePin: 1,
          // Re-measure after a resize so the pin spacer never keeps a stale height.
          invalidateOnRefresh: true,
          onRefresh: () => sync(),
        },
        // The *timeline's* own update, not the ScrollTrigger's. Under `scrub` the
        // trigger reports a new scroll position up to 0.6s before the scrubbed playhead
        // applies the values, so reading the DOM there returns the previous frame and
        // then stops updating once scrolling ends. The timeline's update fires as the
        // playhead actually moves, which is when the frames exist.
        onUpdate: () => sync(),
      });

      // 1 — the console cuts to the new item.
      tl.set("[data-console-after]", { opacity: 1 }, 0.2)
        // 2 — the signal leaves the console before anything downstream moves.
        .to("[data-path]", { scaleX: 1, duration: 0.55, ease: "power2.inOut" }, 0.3);

      // 3 — it reaches each position in the building, in order.
      SCREENS.forEach((_, i) => {
        tl.set(`[data-after="${i}"]`, { opacity: 1 }, i === 0 ? ">-0.15" : ">+0.28");
      });

      // 4 — the resolved room holds, then scrolling releases.
      tl.to({}, { duration: 0.8 });
    },
    [isDesktop]
  );

  return (
    <section
      id="product"
      data-cue="One cue"
      ref={root}
      className="relative"
    >
      {/* ------------------------------------------------------------- desktop */}
      <div ref={stage} className="hidden min-h-svh flex-col justify-center overflow-hidden py-16 lg:flex">
        <div className="mx-auto w-full max-w-[1680px] px-10">
          <div className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2">
            <h2 className="font-display text-[clamp(2rem,3.4vw,3.25rem)] tracking-[-0.02em] text-primary">
              One cue. The room responds.
            </h2>
            <p className="shrink-0 text-[13px] text-muted-2">Recorded cue sequence.</p>
          </div>
          <p className="mt-3 max-w-[58ch] text-[15px] leading-relaxed text-muted">
            Advance the cue from the console. Connected display views follow the current item.
          </p>

          {/* The phase caption is decoration over a static narrative: it changes with the
              frames, and assistive technology reads the written sequence below instead of
              a live region firing on every scroll pixel. */}
          <p aria-hidden="true" className="tnum mt-5 text-[11px] uppercase tracking-[0.2em] text-muted-2">
            {PHASES[phase]}
          </p>

          <div
            className="mt-6 grid items-center gap-x-8 gap-y-5"
            style={{
              gridTemplateColumns: "minmax(0,1.35fr) 5rem minmax(0,1fr) minmax(0,1fr)",
              gridTemplateAreas: `"console path a b" "console path c d"`,
            }}
          >
            {/* The cause. One window, drawn once: the chrome is static furniture, so only
                the content area stacks the two captures and cuts between them. */}
            <div className="[grid-area:console]">
              <AppWindow label="/e/northwind-summit-2026/operator" className="shadow-[0_50px_140px_-40px_rgba(0,0,0,0.9)]">
                <ConsoleReplica cue={3} label="Operator console, cue 3 Opening Keynote" />
                <div data-console-after className="absolute inset-0">
                  <ConsoleReplica cue={4} label="Operator console, cue 4 Product Launch Demo" />
                </div>
              </AppWindow>
              <div className="mt-3 flex flex-wrap items-baseline justify-between gap-x-4">
                <p className="text-console-label uppercase text-muted-2">Operator console</p>
              </div>
            </div>

            {/* The editorial connection path: one trunk out of the console, four taps. */}
            <div className="[grid-area:path] relative -mx-4 h-full" aria-hidden="true">
              {[25, 75].map((top) => (
                <div key={top} className="absolute inset-x-0" style={{ top: `${top}%` }}>
                  <div data-path className="h-px w-full origin-left bg-muted-2/50" />
                  <div className="absolute left-0 top-0 h-[7px] w-[7px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-muted-2/80" />
                  <div className="absolute right-0 top-0 h-[5px] w-[5px] translate-x-1/2 -translate-y-1/2 rounded-full bg-muted-2/60" />
                </div>
              ))}
            </div>

            {/* The effects. Role names sit outside the captures. */}
            {SCREENS.map((screen, i) => (
              <div key={screen.label} className={screen.area}>
                <div className="relative overflow-hidden rounded-[0.4rem] bg-black ring-1 ring-line-soft">
                  {renderScreen(screen.label, 3)}
                  <div data-after={i} className="absolute inset-0">
                    {renderScreen(screen.label, 4)}
                  </div>
                </div>
                <p className="mt-2 text-console-label uppercase text-muted-2">{screen.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* The written sequence. This is what assistive technology and a motion-off visitor
          read; it describes the recorded order without claiming simultaneous delivery. */}
      <div className="sr-only">
        <h3>What this recorded sequence shows</h3>
        <p>
          The operator console starts on cue 3, Opening Keynote, and the four venue display views show
          that item. The console then changes to cue 4, Product Launch Demo, and each connected display
          view follows: Presenter, AV, Green Room and General. The order shown is an editorial reading
          order for the page, not a measurement of delivery time.
        </p>
      </div>

      {/* -------------------------------------------------------------- mobile */}
      <div className="px-6 py-16 lg:hidden">
        <h2 className="font-display text-[clamp(1.875rem,7vw,2.5rem)] tracking-[-0.02em] text-primary">
          One cue. The room responds.
        </h2>
        <p className="mt-3 text-[15px] leading-relaxed text-muted">
          Advance the cue from the console. Connected display views follow the current item.
        </p>
        <p className="mt-2 text-[13px] text-muted-2">Recorded cue sequence.</p>

        <div className="mt-6 overflow-hidden rounded-panel border border-line bg-card">
          <ConsoleReplica cue={4} label="Operator console, cue 4 Product Launch Demo" />
        </div>
        <p className="mt-2 text-console-label uppercase text-muted-2">
          Operator console · cue 4, Product Launch Demo
        </p>

        <SegmentedSelector
          className="mt-8 flex-wrap"
          items={MOBILE_VIEWS}
          value={mobileView}
          onChange={setMobileView}
          label="Choose a venue display view"
          idBase="room-view"
          panelId="room-view-panel"
        />
        <div id="room-view-panel" role="tabpanel" aria-labelledby={`room-view-${mobileView}`} tabIndex={0} className="mt-4 rounded-panel focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
          <div className="overflow-hidden rounded-panel border border-line bg-black">
            {renderScreen(mobileView, 4)}
          </div>
          <p className="mt-2 text-[13px] text-muted-2">
            {mobileView} · {(SCREENS.find((s) => s.label === mobileView) ?? SCREENS[0]).note}
          </p>
        </div>
      </div>
    </section>
  );
}
