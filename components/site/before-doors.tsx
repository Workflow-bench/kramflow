"use client";

import { useState } from "react";
import { RecordedView } from "./recorded-view";
import { SegmentedSelector, type SegmentedItem } from "./segmented-selector";
import type { ShotKey } from "./product-shot";

/**
 * Before doors — what the operator does before anyone is in the room.
 *
 * Asymmetric on purpose: a narrow editorial column against a large product surface,
 * so this section does not read as another centred heading-over-screenshot slab.
 *
 * Prepare/Rehearse are **homepage controls**, not a reproduction of the product's own
 * navigation. They sit outside the capture, in the page's own control language, and
 * all they do is choose which recorded screen is shown. Nothing here imitates an app
 * tab bar, and nothing claims to be live.
 *
 * Claims: both sentences describe what the captured screens show — organising a
 * session's items, timings and people, and running the cue sequence in Rehearsal
 * Mode without touching live displays. There is deliberately no import claim; the
 * applicable behaviour for spreadsheet import was not verified in this pass, so it is
 * not published.
 */

const VIEWS: readonly SegmentedItem[] = [
  { value: "prepare", label: "Prepare" },
  { value: "rehearse", label: "Rehearse" },
];

const DETAIL: Record<string, { shot: ShotKey; copy: string; caption: string }> = {
  prepare: {
    shot: "cueSheet",
    copy: "Organise the session, its items, timings, and people in the cue sheet.",
    caption: "Cue Sheet · Recorded product view",
  },
  rehearse: {
    shot: "rehearsal",
    copy: "Practice the cue sequence without changing the live displays.",
    caption: "Rehearsal Mode · Recorded product view",
  },
};

export function BeforeDoors() {
  const [view, setView] = useState("prepare");
  const detail = DETAIL[view];

  return (
    <section id="prepare" data-cue="Before doors" className="relative border-b border-line-soft">
      <div className="mx-auto w-full max-w-[1440px] px-6 py-20 sm:px-10 lg:py-28">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,34fr)_minmax(0,66fr)] lg:gap-16">
          <div className="flex flex-col">
            <p className="text-[12px] uppercase tracking-[0.18em] text-muted-2">01 / Before doors</p>
            <h2 className="mt-5 font-display text-[clamp(2rem,3.4vw,3.25rem)] leading-[1.04] tracking-[-0.02em] text-primary">
              Get the rundown ready.
            </h2>
            <p className="mt-5 max-w-[42ch] text-[17px] leading-relaxed text-muted">
              Prepare the cue sheet. Rehearse the handoffs. See what happens before the audience arrives.
            </p>

            <SegmentedSelector
              className="mt-8 self-start"
              items={VIEWS}
              value={view}
              onChange={setView}
              label="Choose a recorded view"
              idBase="before-doors"
              panelId="before-doors-panel"
            />

            <p
              id="before-doors-panel"
              role="tabpanel"
              aria-labelledby={`before-doors-${view}`}
              className="mt-5 max-w-[40ch] text-[15px] leading-relaxed text-muted-2"
            >
              {detail.copy}
            </p>
          </div>

          <figure className="min-w-0">
            <div className="overflow-hidden rounded-panel border border-line bg-card shadow-[0_40px_120px_-48px_rgba(0,0,0,0.9)]">
              <RecordedView
                shot={detail.shot}
                /* One fixed box for both states, so selecting a view never reflows the
                   page. The taller capture is cropped at the bottom by ~4%; both are
                   scaled uniformly and neither is stretched. */
                ratio={2560 / 1880}
                sizes="(min-width: 1024px) 62vw, 92vw"
              />
            </div>
            <figcaption className="mt-3 text-[13px] text-muted-2">{detail.caption}</figcaption>
          </figure>
        </div>
      </div>
    </section>
  );
}
