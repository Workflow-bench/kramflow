"use client";

import { useState } from "react";
import { ArrowRight, RotateCcw } from "lucide-react";
import { RecordedView, type CropBox } from "./recorded-view";
import { FullViewDialog } from "./full-view-dialog";
import { SegmentedSelector, type SegmentedItem } from "./segmented-selector";
import type { ShotKey } from "./product-shot";

/**
 * Call the show — the page's one dominant stage.
 *
 * One piece of state, `cue`, owns everything: which recorded Operator Console capture
 * is shown and which recorded venue display is shown beside it. Advancing the example
 * moves both, because in the product they move together.
 *
 * **Readable, not miniature (HOME-R02).** The console is shown as a crop of the real
 * capture — the live cue, its countdown, the timer adjustments and the Next / Previous
 * / Hold cluster — at a size where those values can actually be read. The crop is
 * uniform scale plus clipping; no pixel inside it is altered. "View the whole console"
 * opens the complete, unmodified capture for inspection.
 *
 * **Labels live outside the images.** "Opening Keynote → Product Launch Demo" and the
 * cause/consequence pair are homepage annotations in the page's own type. Nothing is
 * drawn on top of, or into, the product pixels.
 *
 * Deliberately absent: any ticking countdown, artificial delay, auto-advance or "live"
 * wording. The two captures were recorded minutes apart, so their clocks do not match
 * each other — that is a property of two separate recordings, not a synchronisation
 * claim, and the numbers are left exactly as captured rather than repainted to agree.
 *
 * Choosing a view never resets the cue, and scrolling cannot change either one.
 */

// The cue/timer/control region of the 3360x2100 console capture, in its own pixels.
// Verified against both recorded states: it contains LIVE NOW, the cue title and owner,
// schedule variance, the countdown, the timer-adjust row, control ownership and the
// Next / Previous / Hold cluster.
const CONSOLE_CROP: CropBox = {
  left: 1700,
  top: 150,
  width: 1660,
  height: 670,
  imageWidth: 3360,
  imageHeight: 2100,
};

const VIEWS: readonly SegmentedItem[] = [
  { value: "presenter", label: "Presenter" },
  { value: "av", label: "AV" },
  { value: "green-room", label: "Green Room" },
  { value: "general", label: "General" },
];

// Each view's recorded pair: [before the cue, after the cue], plus who is looking at it.
const OUTPUT: Record<string, { shots: [ShotKey, ShotKey]; audience: string }> = {
  presenter: { shots: ["presenterPrev", "presenter"], audience: "The speaker on stage sees their own countdown." },
  av: { shots: ["avPrev", "av"], audience: "The booth sees the requirements for the item that is running." },
  "green-room": { shots: ["speakerReadyPrev", "speakerReady"], audience: "Backstage sees who is on now and who is next." },
  general: { shots: ["generalPrev", "general"], audience: "The lobby sees what is on in the room." },
};

const CUES = [
  { item: "3", title: "Opening Keynote", owner: "Amara Osei" },
  { item: "4", title: "Product Launch Demo", owner: "Rafael Costa" },
] as const;

export function CallTheShow() {
  const [cue, setCue] = useState(0);
  const [view, setView] = useState("presenter");
  const [expanded, setExpanded] = useState(false);

  const output = OUTPUT[view];
  const atEnd = cue >= CUES.length - 1;
  const consoleShot: ShotKey = cue === 0 ? "consolePrev" : "console";
  const viewLabel = VIEWS.find((v) => v.value === view)?.label ?? "";

  return (
    <section id="call" data-cue="Call the show" className="relative border-b border-line-soft">
      <div className="mx-auto w-full max-w-[1440px] px-6 py-20 sm:px-10 lg:py-28">
        <p className="text-[12px] uppercase tracking-[0.18em] text-muted-2">02 / Call the show</p>
        <div className="mt-5 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between lg:gap-16">
          <h2 className="max-w-[18ch] font-display text-[clamp(2.25rem,4.2vw,4rem)] leading-[1.02] tracking-[-0.02em] text-primary">
            Call the cue. The room follows.
          </h2>
          <p className="max-w-[44ch] text-[17px] leading-relaxed text-muted">
            One operator presses Next. Every venue display moves to the new item at the same time.
          </p>
        </div>

        {/* Editorial annotation of the recorded change — page type, outside the images. */}
        <div className="mt-10 flex flex-wrap items-center gap-x-3 gap-y-2 text-[15px]">
          <span className={cue === 0 ? "text-primary" : "text-muted-2 line-through decoration-line"}>
            {CUES[0].title}
          </span>
          <ArrowRight aria-hidden="true" className="h-4 w-4 text-muted-2" strokeWidth={2} />
          <span className={cue === 1 ? "text-primary" : "text-muted-2"}>{CUES[1].title}</span>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-4">
          {!atEnd ? (
            <button
              type="button"
              onClick={() => setCue(1)}
              className="inline-flex h-11 items-center gap-2 rounded-control bg-primary px-4 text-[14px] font-medium text-background transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Advance example
              <ArrowRight className="h-4 w-4" strokeWidth={2} />
            </button>
          ) : (
            // The primary action is never left disabled: once the example has run, the
            // same position offers the way to watch it again (HOME-R06).
            <button
              type="button"
              onClick={() => setCue(0)}
              className="inline-flex h-11 items-center gap-2 rounded-control bg-primary px-4 text-[14px] font-medium text-background transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <RotateCcw className="h-4 w-4" strokeWidth={2} />
              Replay cue change
            </button>
          )}
          <p className="text-[13px] leading-snug text-muted-2">
            Recorded product preview. No live event is changed.
          </p>
          {/* The displayed cue is announced, so the change is not visual-only. */}
          <p aria-live="polite" className="sr-only">
            Showing cue {CUES[cue].item}, {CUES[cue].title}, on the {viewLabel} display.
          </p>
        </div>

        {/* ---- the stage: the console, large enough to read -------------------- */}
        <figure className="mt-8">
          <div className="overflow-hidden rounded-panel border border-line bg-card shadow-[0_40px_120px_-48px_rgba(0,0,0,0.9)]">
            <RecordedView
              shot={consoleShot}
              crop={CONSOLE_CROP}
              ratio={CONSOLE_CROP.width / CONSOLE_CROP.height}
              /* Rendered width is container x (3360/1660), so the variant must be
                 chosen for that, not for the container. */
              sizes="(min-width: 1024px) 2800px, 1400px"
            />
          </div>
          <figcaption className="mt-3 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
            <span className="text-[13px] text-muted-2">
              Operator Console · Recorded product view · cue {CUES[cue].item}, {CUES[cue].title}
            </span>
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="inline-flex h-11 items-center rounded-control px-1 text-[13px] text-muted transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              View the whole console
            </button>
          </figcaption>
        </figure>

        {/* ---- the consequence ------------------------------------------------- */}
        <div className="mt-12 grid gap-6 lg:grid-cols-[minmax(0,34fr)_minmax(0,66fr)] lg:gap-10">
          <div>
            <p className="text-[12px] uppercase tracking-[0.16em] text-muted-2">What the room sees</p>
            <p className="mt-3 max-w-[34ch] text-[15px] leading-relaxed text-muted">
              Each screen in the venue shows the same cue in the form its audience needs.
            </p>
            <SegmentedSelector
              className="mt-6"
              items={VIEWS}
              value={view}
              onChange={setView}
              label="Choose a venue display view"
              idBase="call-view"
              panelId="call-output-panel"
            />
          </div>

          {/* The panel covers the whole changing region: image and caption together. */}
          <figure id="call-output-panel" role="tabpanel" aria-labelledby={`call-view-${view}`} className="min-w-0">
            <div className="overflow-hidden rounded-panel border border-line bg-black">
              <RecordedView
                shot={output.shots[cue]}
                ratio={3720 / 2160}
                sizes="(min-width: 1024px) 62vw, 92vw"
              />
            </div>
            <figcaption className="mt-3 text-[13px] text-muted-2">
              {viewLabel} display · {output.audience}
            </figcaption>
          </figure>
        </div>
      </div>

      {expanded && (
        <FullViewDialog shot={consoleShot} label="Operator Console" onClose={() => setExpanded(false)} />
      )}
    </section>
  );
}
