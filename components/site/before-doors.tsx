"use client";

import { useState } from "react";
import { RecordedView } from "./recorded-view";
import { SegmentedSelector, type SegmentedItem } from "./segmented-selector";
import type { ShotKey } from "./product-shot";

/**
 * Before doors — what the operator does before anyone is in the room.
 *
 * Compact by design (HOME-R05): this chapter sets up the cue stage that follows, so it
 * states its job, offers the two preparation views and gets out of the way. The page's
 * weight belongs to the cue change, not to a second large screenshot panel here.
 *
 * Prepare/Rehearse are **homepage controls**, not a reproduction of the product's own
 * navigation. They sit outside the capture, in the page's own control language, and all
 * they do is choose which recorded screen is shown.
 *
 * The tab panel covers the whole changing region — the sentence, the capture and its
 * caption (HOME-R07). It previously wrapped only the sentence, so a screen-reader user
 * following the tabs was told about a panel that excluded the image the tabs actually
 * changed.
 *
 * Claims: both sentences describe what the captured screens show. There is deliberately
 * no import claim; the applicable behaviour for spreadsheet import was not verified, so
 * it is not published.
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
      <div className="mx-auto w-full max-w-[1440px] px-6 py-16 sm:px-10 lg:py-20">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,32fr)_minmax(0,68fr)] lg:gap-14">
          <div className="flex flex-col">
            <p className="text-[12px] uppercase tracking-[0.18em] text-muted-2">01 / Before doors</p>
            <h2 className="mt-4 font-display text-[clamp(1.875rem,3vw,2.875rem)] leading-[1.04] tracking-[-0.02em] text-primary">
              Get the rundown ready.
            </h2>
            <p className="mt-4 max-w-[40ch] text-[16px] leading-relaxed text-muted">
              Build the cue sheet, then run the sequence end to end before anyone is in the room.
            </p>
            <SegmentedSelector
              className="mt-6 self-start"
              items={VIEWS}
              value={view}
              onChange={setView}
              label="Choose a preparation view"
              idBase="before-doors"
              panelId="before-doors-panel"
            />
          </div>

          {/* One panel around everything the tabs change: sentence, capture and caption. */}
          {/* Focusable: Tab previously skipped straight past the panel these tabs
              control, so a keyboard user never reached the content they had just
              selected (HF-05). */}
          <div
            id="before-doors-panel"
            role="tabpanel"
            tabIndex={0}
            aria-labelledby={`before-doors-${view}`}
            className="min-w-0 rounded-panel focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <p className="max-w-[52ch] text-[15px] leading-relaxed text-muted">{detail.copy}</p>
            <figure className="mt-4">
              <div className="overflow-hidden rounded-panel border border-line bg-card shadow-[0_40px_120px_-48px_rgba(0,0,0,0.9)]">
                <RecordedView
                  shot={detail.shot}
                  /* One fixed box for both states, so selecting a view never reflows the
                     page. Both captures are scaled uniformly and clipped, never stretched. */
                  ratio={2560 / 1760}
                  sizes="(min-width: 1024px) 64vw, 92vw"
                />
              </div>
              <figcaption className="mt-3 text-[13px] text-muted-2">{detail.caption}</figcaption>
            </figure>
          </div>
        </div>
      </div>
    </section>
  );
}
