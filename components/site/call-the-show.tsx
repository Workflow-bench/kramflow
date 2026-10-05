"use client";

import { useState } from "react";
import { ArrowRight, RotateCcw } from "lucide-react";
import { RecordedView } from "./recorded-view";
import { SegmentedSelector, type SegmentedItem } from "./segmented-selector";
import type { ShotKey } from "./product-shot";

/**
 * Call the show — the page's signature interaction.
 *
 * One piece of state, `cue`, owns everything: which recorded Operator Console capture
 * is shown and which recorded output capture is shown beside it. Advancing the example
 * moves both, because in the product they move together; that is the whole argument of
 * the page, and it is made with two genuine captures of the same seeded show one cue
 * apart rather than with a hand-built miniature that drifts from the app.
 *
 * Deliberately absent: any countdown that ticks, any artificial delay before the output
 * updates, any auto-advance, any "live" wording. This is a recorded pair, the label says
 * so on screen, and the transition is presentation only — it makes no claim about how
 * quickly the product propagates a cue.
 *
 * Choosing a view never resets the cue: `cue` and `view` are independent, so a visitor
 * who advances the example and then looks at the AV screen sees the AV screen *at the
 * advanced cue*. Scrolling cannot change either one.
 *
 * View names come from the product's own `DISPLAY_TYPES` (lib/display-engine/types.ts):
 * Presenter, AV, Green Room, General. The Green Room capture's file is still named
 * `display-speaker-ready` from an older label; it was captured from `/green-room` and is
 * labelled with the current canonical name. These are the four built-in views; the
 * product also supports Custom profiles, so this is not a claim that four is the limit.
 */

const VIEWS: readonly SegmentedItem[] = [
  { value: "presenter", label: "Presenter" },
  { value: "av", label: "AV" },
  { value: "green-room", label: "Green Room" },
  { value: "general", label: "General" },
];

// Each view's recorded pair: [before the cue, after the cue].
const OUTPUT: Record<string, { shots: [ShotKey, ShotKey]; role: string }> = {
  presenter: { shots: ["presenterPrev", "presenter"], role: "Confidence monitor on stage" },
  av: { shots: ["avPrev", "av"], role: "Technical requirements in the booth" },
  "green-room": { shots: ["speakerReadyPrev", "speakerReady"], role: "Performer display backstage" },
  general: { shots: ["generalPrev", "general"], role: "Public display in the lobby" },
};

const CUES = [
  { item: "3", title: "Opening Keynote" },
  { item: "4", title: "Product Launch Demo" },
] as const;

export function CallTheShow() {
  const [cue, setCue] = useState(0);
  const [view, setView] = useState("presenter");

  const output = OUTPUT[view];
  const atEnd = cue >= CUES.length - 1;

  return (
    <section id="call" data-cue="Call the show" className="relative border-b border-line-soft">
      <div className="mx-auto w-full max-w-[1440px] px-6 py-20 sm:px-10 lg:py-28">
        <p className="text-[12px] uppercase tracking-[0.18em] text-muted-2">02 / Call the show</p>
        <div className="mt-5 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between lg:gap-16">
          <h2 className="max-w-[18ch] font-display text-[clamp(2rem,3.8vw,3.75rem)] leading-[1.02] tracking-[-0.02em] text-primary">
            Call the cue. The room follows.
          </h2>
          <p className="max-w-[44ch] text-[17px] leading-relaxed text-muted">
            Explore a recorded show. Advance the example and choose the view you want to see.
          </p>
        </div>

        {/* Controls and provenance sit outside every screenshot. */}
        <div className="mt-10 flex flex-wrap items-center gap-x-3 gap-y-4">
          <button
            type="button"
            onClick={() => setCue((c) => Math.min(c + 1, CUES.length - 1))}
            disabled={atEnd}
            className="inline-flex h-11 items-center gap-2 rounded-control bg-primary px-4 text-[14px] font-medium text-background transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-40"
          >
            Advance example
            <ArrowRight className="h-4 w-4" strokeWidth={2} />
          </button>
          <button
            type="button"
            onClick={() => setCue(0)}
            disabled={cue === 0}
            className="inline-flex h-11 items-center gap-2 rounded-control border border-line px-4 text-[14px] text-primary transition-colors hover:border-white/25 hover:bg-overlay-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-40"
          >
            <RotateCcw className="h-4 w-4" strokeWidth={2} />
            Reset example
          </button>
          <p className="text-[13px] leading-snug text-muted-2">
            Recorded product preview. No live event is changed.
          </p>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,62fr)_minmax(0,38fr)] lg:gap-8">
          <figure className="min-w-0">
            <div className="overflow-hidden rounded-panel border border-line bg-card shadow-[0_40px_120px_-48px_rgba(0,0,0,0.9)]">
              <RecordedView
                shot={cue === 0 ? "consolePrev" : "console"}
                ratio={3360 / 2100}
                sizes="(min-width: 1024px) 62vw, 92vw"
              />
            </div>
            <figcaption className="mt-3 flex flex-wrap items-baseline gap-x-3 text-[13px] text-muted-2">
              <span>Operator Console · Recorded product view</span>
              <span aria-live="polite" className="text-muted">
                Cue {CUES[cue].item} · {CUES[cue].title}
              </span>
            </figcaption>
          </figure>

          <div className="min-w-0">
            <SegmentedSelector
              items={VIEWS}
              value={view}
              onChange={setView}
              label="Choose a venue display view"
              idBase="call-view"
              panelId="call-output-panel"
            />
            <figure id="call-output-panel" role="tabpanel" aria-labelledby={`call-view-${view}`} className="mt-5">
              <div className="overflow-hidden rounded-panel border border-line bg-black">
                <RecordedView
                  shot={output.shots[cue]}
                  ratio={3840 / 2160}
                  sizes="(min-width: 1024px) 38vw, 92vw"
                />
              </div>
              <figcaption className="mt-3 text-[13px] text-muted-2">
                {VIEWS.find((v) => v.value === view)?.label} · {output.role}
              </figcaption>
            </figure>
          </div>
        </div>
      </div>
    </section>
  );
}
