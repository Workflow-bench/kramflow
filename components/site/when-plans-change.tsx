"use client";

import { useState } from "react";
import { RecordedView, type CropBox } from "./recorded-view";
import type { ShotKey } from "./product-shot";

/**
 * When plans change — the four things an operator reaches for mid-show.
 *
 * A ruled list, not four feature cards: these are operations in one console, and a grid
 * of equal boxes would say they are four separate products.
 *
 * **Each row shows its own surface (HOME-R03).** Previously every row sat beside the
 * same Broadcast Center screenshot, so "Adjust the timer" and "Hold the room" were
 * illustrated by a notice composer. Now the timer row shows the console's actual timer
 * and adjustment controls, the hold row shows the actual Next / Previous / Hold cluster,
 * notices show Broadcast Center, and control ownership shows the console's own control
 * strip. Every one is a crop of a genuine capture: uniform scale and clipping only, no
 * pixel altered.
 *
 * **One honest gap.** There is no safe capture of a display actually *in* a hold state,
 * because producing one means driving a real event. The hold row therefore shows the
 * control that triggers it and says so in its caption, rather than implying a state that
 * was never recorded. This is recorded in the batch evidence as an open asset item.
 *
 * Each sentence is bounded by what the source supports: `app/api/display-engine/timer`
 * and `/time`, `/hold`, `/broadcasts`, and the control strip in
 * `components/operator/controls-panel.tsx` with `components/ui/control-lease-status.tsx`.
 */

const CONSOLE = { imageWidth: 3360, imageHeight: 2100 };

const ROWS: {
  id: string;
  title: string;
  copy: string;
  scenario: string;
  shot: ShotKey | null;
  crop?: CropBox;
  caption: string;
}[] = [
  {
    id: "timer",
    title: "Adjust the timer",
    copy: "Add or remove time while the current cue is running.",
    scenario: "The keynote overruns by four minutes, so you add the time and the projected finish moves with it.",
    shot: "console",
    crop: { left: 1700, top: 300, width: 1300, height: 560, ...CONSOLE },
    caption: "Operator Console · the running cue's timer and its adjustments",
  },
  {
    id: "hold",
    title: "Hold the room",
    copy: "Show a hold message on the selected displays.",
    scenario: "The next speaker is still in the corridor, so the room holds instead of moving on.",
    shot: "console",
    crop: { left: 2060, top: 330, width: 1300, height: 560, ...CONSOLE },
    caption: "Operator Console · the Hold control. No capture of a display already holding exists yet.",
  },
  {
    id: "notice",
    title: "Send a notice",
    copy: "Send the right message to the right screens.",
    scenario: "The booth needs to know about a microphone change that the lobby should never see.",
    shot: "broadcast",
    caption: "Broadcast Center · Recorded product view",
  },
  {
    id: "control",
    title: "Keep control clear",
    copy: "The console shows who has control.",
    scenario: "Two operators are signed in, and the console names the one calling cues right now.",
    shot: "console",
    crop: { left: 2060, top: 130, width: 1300, height: 560, ...CONSOLE },
    caption: "Operator Console · who is calling cues, and how many displays are targeted",
  },
];

export function WhenPlansChange() {
  const [open, setOpen] = useState("timer");
  const row = ROWS.find((r) => r.id === open) ?? ROWS[0];

  return (
    <section id="adapt" data-cue="When plans change" className="relative border-b border-line-soft">
      <div className="mx-auto w-full max-w-[1440px] px-6 py-20 sm:px-10 lg:py-24">
        <p className="text-[12px] uppercase tracking-[0.18em] text-muted-2">03 / When plans change</p>

        <div className="mt-5 grid gap-10 lg:grid-cols-[minmax(0,50fr)_minmax(0,50fr)] lg:gap-14">
          <div>
            <h2 className="max-w-[14ch] font-display text-[clamp(1.875rem,3vw,2.875rem)] leading-[1.04] tracking-[-0.02em] text-primary">
              Keep calling the show.
            </h2>

            {/* Tabs are direct children of the tablist: an intermediate wrapper (or a
                heading element around each tab) breaks `aria-required-children` /
                `aria-required-parent`, which Lighthouse flagged. The changing copy
                therefore lives in the panel with the image, which is also what
                HOME-R07 asks for. */}
            <div role="tablist" aria-label="Mid-show operations" aria-orientation="vertical" className="mt-8 border-t border-line-soft">
              {ROWS.map((r, i) => {
                const selected = r.id === open;
                return (
                  <button
                    key={r.id}
                    type="button"
                    role="tab"
                    id={`plans-tab-${r.id}`}
                    aria-selected={selected}
                    aria-controls="plans-panel"
                    tabIndex={selected ? 0 : -1}
                    onClick={() => setOpen(r.id)}
                    onKeyDown={(e) => {
                      const keys = ["ArrowDown", "ArrowUp", "Home", "End"];
                      if (!keys.includes(e.key)) return;
                      e.preventDefault();
                      const next =
                        e.key === "Home" ? 0
                        : e.key === "End" ? ROWS.length - 1
                        : (i + (e.key === "ArrowDown" ? 1 : -1) + ROWS.length) % ROWS.length;
                      setOpen(ROWS[next].id);
                      document.getElementById(`plans-tab-${ROWS[next].id}`)?.focus();
                    }}
                    className="flex w-full items-center justify-between gap-6 border-b border-line-soft py-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    <span className={`text-[18px] ${selected ? "font-medium text-primary" : "text-muted"}`}>
                      {r.title}
                    </span>
                    <span
                      aria-hidden="true"
                      className={`h-1.5 w-1.5 shrink-0 rounded-full ${selected ? "bg-status-green" : "bg-transparent"}`}
                    />
                  </button>
                );
              })}
            </div>

            <p className="mt-8 max-w-[52ch] text-[14px] leading-relaxed text-muted-2">
              One operator calls the cues at a time, and the console names who that is. What a
              collaborator is allowed to do on an event is set separately, by their permission on it.
            </p>
          </div>

          {/* The panel is the whole changing region: image and caption together (HOME-R07). */}
          <figure id="plans-panel" role="tabpanel" aria-labelledby={`plans-tab-${row.id}`} className="min-w-0 lg:pt-4">
            {/* Plain block, not a second <figcaption>: a figure may only have one. */}
            <div className="mb-4">
              <p className="max-w-[46ch] text-[15px] leading-relaxed text-primary">{row.copy}</p>
              <p className="mt-2 max-w-[48ch] text-[14px] leading-relaxed text-muted-2">{row.scenario}</p>
            </div>
            <div className="overflow-hidden rounded-panel border border-line bg-card shadow-[0_40px_120px_-48px_rgba(0,0,0,0.9)]">
              <RecordedView
                shot={row.shot as ShotKey}
                crop={row.crop}
                ratio={row.crop ? row.crop.width / row.crop.height : 2446 / 1880}
                /* A crop magnifies: the element renders the whole capture at
                   container x (3360/1300), so `sizes` states that rendered width
                   rather than the container's, or Next serves a variant that is
                   then upscaled and looks soft. */
                sizes="(min-width: 1024px) 1700px, 1100px"
              />
            </div>
            <figcaption className="mt-3 text-[13px] leading-relaxed text-muted-2">{row.caption}</figcaption>
          </figure>
        </div>
      </div>
    </section>
  );
}
