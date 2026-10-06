"use client";

import { useRef, useState } from "react";
import { TimerOperation, HoldOperation, NoticeOperation, ControlOperation } from "./replica/operation-replicas";

/**
 * "When plans change" — four operations, each with the surface that performs it.
 *
 * Asymmetric by design: a narrow single-open accordion on the left, one large stable
 * proof aperture on the right. The previous version put four flat rows beside an
 * equal-width image and read as a conventional feature selector.
 *
 * **Selection is page language, not product status.** A cream rule, a heavier label and
 * the row's own expansion mark the open case. The old green dot borrowed the product's
 * live-status colour for a marketing control; real status colours stay where they
 * belong, inside the screenshots.
 *
 * **Each row has its own measured crop**, taken against the actual source pixels:
 * - timer — the countdown, the full ±0:30/±0:10 row and the current cue's context,
 *   ending cleanly at the column divider rather than clipping the next column's words;
 * - hold — the complete controls column, so Next, Previous and Hold are whole;
 * - notice — the Broadcast composer with its target selector. The capture's target reads
 *   **All Displays**, so the caption says that rather than implying an AV-only send;
 * - control — the ownership strip: who holds control, and the release affordance.
 *
 * Crops letterbox rather than fill (`fit="contain"`), because stretching a tall control
 * column into a landscape aperture would distort the product or cut the control being
 * explained. Image handoff keeps the committed capture until its replacement decodes
 * (see RecordedView), so fast switching never leaves an empty aperture.
 *
 * Captions name the surface shown. Implementation-gap commentary belongs in the handoff,
 * not on a public page — and no missing state is ever filled in with invented pixels.
 */


type OpKey = "timer" | "hold" | "notice" | "control";

interface Op {
  id: OpKey;
  situation: string;
  title: string;
  detail: string;
  caption: string;
}

const OPS: Op[] = [
  {
    id: "timer",
    situation: "A speaker needs more time.",
    title: "Adjust the timer",
    detail: "Add or remove time while the cue is running. The projected finish moves with it.",
    caption: "Operator Console · timer and adjustment controls",
  },
  {
    id: "hold",
    situation: "The next cue needs to wait.",
    title: "Hold the room",
    detail: "Hold the current item on the displays you choose instead of advancing the show.",
    caption: "Operator Console · transport controls, including Hold",
  },
  {
    id: "notice",
    situation: "The booth needs an update.",
    title: "Send a notice",
    detail: "Write a message and choose which screens receive it, without interrupting the cue.",
    caption: "Broadcast Center · composer and audience, set to All Displays",
  },
  {
    id: "control",
    situation: "Another operator takes over.",
    title: "Keep control clear",
    detail:
      "One operator calls the cues at a time and the console names who. What a collaborator may do on the event is a separate permission.",
    caption: "Operator Console · who holds control",
  },
];

const PROOF: Record<OpKey, () => React.ReactElement> = {
  timer: TimerOperation,
  hold: HoldOperation,
  notice: NoticeOperation,
  control: ControlOperation,
};

export function WhenPlansChange() {
  const [open, setOpen] = useState("timer");
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const op = OPS.find((o) => o.id === open) ?? OPS[0];

  function move(to: number) {
    const next = OPS[(to + OPS.length) % OPS.length];
    setOpen(next.id);
    refs.current[next.id]?.focus();
  }

  return (
    <section id="features" data-cue="When plans change" className="relative border-b border-line-soft">
      <div className="mx-auto w-full max-w-[1440px] px-6 py-20 sm:px-10 lg:py-24">
        <p className="text-[12px] uppercase tracking-[0.18em] text-muted-2">03 / When plans change</p>
        <h2 className="mt-4 max-w-[20ch] font-display text-[clamp(1.875rem,3vw,2.875rem)] leading-[1.04] tracking-[-0.02em] text-primary">
          The plan changes. The show keeps running.
        </h2>

        <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,36fr)_minmax(0,64fr)] lg:gap-14">
          {/* ---- the operations, one open at a time ---- */}
          <div className="border-t border-line-soft">
            {OPS.map((o, i) => {
              const isOpen = o.id === open;
              return (
                <div key={o.id} className="border-b border-line-soft">
                  <h3 className="m-0">
                    <button
                      ref={(el) => {
                        refs.current[o.id] = el;
                      }}
                      type="button"
                      id={`op-${o.id}`}
                      aria-expanded={isOpen}
                      aria-controls={`op-panel-${o.id}`}
                      onClick={() => setOpen(o.id)}
                      onKeyDown={(e) => {
                        if (e.key === "ArrowDown") { e.preventDefault(); move(i + 1); }
                        else if (e.key === "ArrowUp") { e.preventDefault(); move(i - 1); }
                        else if (e.key === "Home") { e.preventDefault(); move(0); }
                        else if (e.key === "End") { e.preventDefault(); move(OPS.length - 1); }
                      }}
                      className="group flex w-full items-baseline gap-3 py-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    >
                      {/* Cream rule, not a status colour. */}
                      <span
                        aria-hidden="true"
                        className={`mt-2 h-px shrink-0 transition-all duration-200 ${
                          isOpen ? "w-7 bg-primary" : "w-3 bg-line group-hover:bg-muted-2"
                        }`}
                      />
                      <span className="flex flex-col gap-1">
                        <span className={`text-[13px] ${isOpen ? "text-muted" : "text-muted-2"}`}>{o.situation}</span>
                        <span className={`text-[18px] ${isOpen ? "font-medium text-primary" : "text-muted"}`}>
                          {o.title}
                        </span>
                      </span>
                    </button>
                  </h3>
                  <div
                    id={`op-panel-${o.id}`}
                    role="region"
                    aria-labelledby={`op-${o.id}`}
                    hidden={!isOpen}
                    className="pb-5 pl-10"
                  >
                    <p className="max-w-[44ch] text-[15px] leading-relaxed text-muted">{o.detail}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ---- one stable proof aperture ----
              Focusable, so keyboard users reach the proof that the selection controls
              (HF-05); Tab previously skipped it entirely. */}
          <figure
            className="min-w-0 rounded-panel focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            tabIndex={0}
            aria-label={`Proof for ${op.title}: ${op.caption}`}
          >
            <div className="overflow-hidden rounded-panel border border-line bg-card shadow-[0_40px_120px_-48px_rgba(0,0,0,0.9)]">
              {(() => {
                const Proof = PROOF[op.id];
                return <Proof />;
              })()}
            </div>
            <figcaption className="mt-3 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
              <span className="text-[13px] leading-relaxed text-muted-2">{op.caption}</span>

            </figcaption>
          </figure>
        </div>
      </div>


    </section>
  );
}
