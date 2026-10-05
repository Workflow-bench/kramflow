"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { ProductShot } from "./product-shot";

/**
 * When plans change — the four things an operator reaches for mid-show.
 *
 * A ruled list, not four feature cards: these are operations in one console, and a
 * grid of equal boxes would say they are four separate products. Each row discloses
 * one sentence. Only the row's own body opens, and the capture beside it never moves,
 * so opening a row cannot shift anything the reader was already looking at.
 *
 * Each sentence is bounded by what the source actually supports:
 * `app/api/display-engine/timer` and `/time` (timer adjustment), `/hold` (hold state
 * per display), `/broadcasts` (targeted notices), and the control lease in
 * `components/operator/controls-panel.tsx` + `components/ui/control-lease-status.tsx`.
 *
 * The control note is written carefully: holding control is a lease one operator has
 * at a time, which is a different thing from what an event's permissions allow a
 * collaborator to do at all. Nothing here says every collaborator can do every action.
 */

const ROWS = [
  {
    id: "timer",
    title: "Adjust the timer",
    copy: "Add or remove time while the current cue is running.",
  },
  {
    id: "hold",
    title: "Hold the room",
    copy: "Show a hold message on the selected displays.",
  },
  {
    id: "notice",
    title: "Send a notice",
    copy: "Send the right message to the right screens.",
  },
  {
    id: "control",
    title: "Keep control clear",
    copy: "The console shows who has control.",
  },
] as const;

export function WhenPlansChange() {
  const [open, setOpen] = useState<string>("timer");

  return (
    <section id="adapt" data-cue="When plans change" className="relative border-b border-line-soft">
      <div className="mx-auto w-full max-w-[1440px] px-6 py-20 sm:px-10 lg:py-28">
        <p className="text-[12px] uppercase tracking-[0.18em] text-muted-2">03 / When plans change</p>

        <div className="mt-5 grid gap-12 lg:grid-cols-[minmax(0,52fr)_minmax(0,48fr)] lg:gap-16">
          <div>
            <h2 className="max-w-[14ch] font-display text-[clamp(2rem,3.4vw,3.25rem)] leading-[1.04] tracking-[-0.02em] text-primary">
              Keep calling the show.
            </h2>

            <ul className="mt-10 border-t border-line-soft">
              {ROWS.map((row) => {
                const isOpen = open === row.id;
                return (
                  <li key={row.id} className="border-b border-line-soft">
                    <h3>
                      <button
                        type="button"
                        aria-expanded={isOpen}
                        aria-controls={`plans-${row.id}`}
                        onClick={() => setOpen(isOpen ? "" : row.id)}
                        className="flex w-full items-center justify-between gap-6 py-5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      >
                        <span className={`text-[19px] ${isOpen ? "text-primary" : "text-muted"}`}>{row.title}</span>
                        <Plus
                          aria-hidden="true"
                          className={`h-4 w-4 shrink-0 text-muted-2 transition-transform duration-200 ${isOpen ? "rotate-45" : ""}`}
                          strokeWidth={2}
                        />
                      </button>
                    </h3>
                    <div id={`plans-${row.id}`} hidden={!isOpen} className="pb-5">
                      <p className="max-w-[46ch] text-[15px] leading-relaxed text-muted-2">{row.copy}</p>
                    </div>
                  </li>
                );
              })}
            </ul>

            <p className="mt-8 max-w-[52ch] text-[14px] leading-relaxed text-muted-2">
              Control is a lease: one operator holds it at a time, and the console shows who. What a
              collaborator is allowed to do on an event is a separate permission.
            </p>
          </div>

          <figure className="min-w-0 lg:pt-6">
            <div className="overflow-hidden rounded-panel border border-line bg-card shadow-[0_40px_120px_-48px_rgba(0,0,0,0.9)]">
              <ProductShot shot="broadcast" sizes="(min-width: 1024px) 48vw, 92vw" />
            </div>
            <figcaption className="mt-3 text-[13px] text-muted-2">
              Broadcast Center · Recorded product view
            </figcaption>
          </figure>
        </div>
      </div>
    </section>
  );
}
