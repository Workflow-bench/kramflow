"use client";

import { useEffect, useRef, useState } from "react";
import { Reveal } from "./motion";

/**
 * The feature list, set as a cue sheet. As you scroll, the row under the
 * reading line goes live (green tint, LIVE tag), so reading the page is
 * itself the show advancing. Colour and opacity change only; no row moves.
 */

const ROWS = [
  ["Countdown that knows it is late", "Every start time recalculates when the show runs behind.", "Console"],
  ["Reorder mid-show", "Drag an item and every time after it follows.", "Cue Sheet"],
  ["One operator drives", "One person advances the cue. Everyone else just sees it.", "Console"],
  ["Say it to the room", "Push a notice to any screen, then clear it.", "Broadcast"],
  ["No login on the wall", "Screens join by link, QR or a 6-digit code.", "Displays"],
];

export function CallSheet() {
  const [live, setLive] = useState(0);
  const rows = useRef<(HTMLLIElement | null)[]>([]);

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setLive(rows.current.indexOf(e.target as HTMLLIElement));
        }
      },
      { rootMargin: "-42% 0px -50% 0px" }
    );
    rows.current.forEach((r) => r && obs.observe(r));
    return () => obs.disconnect();
  }, []);

  return (
    <section id="features" data-cue="Details" className="border-b border-line-soft">
      <div className="mx-auto max-w-[1600px] px-6 py-16 sm:px-10 lg:py-28">
        <Reveal>
          <h2 className=" max-w-[16ch] font-display text-[clamp(2rem,5vw,4.25rem)] text-primary">
            Built for the live room.
          </h2>
        </Reveal>

        <div className="tnum mt-10 hidden grid-cols-[4rem_minmax(0,1.1fr)_minmax(0,1.6fr)_6rem] gap-6 border-b border-line px-4 pb-3 text-[10px] uppercase tracking-[0.2em] text-muted-2 md:grid">
          <span>Cue</span>
          <span>Item</span>
          <span>Note</span>
          <span className="text-right">Surface</span>
        </div>
        <ol>
          {ROWS.map(([title, body, dur], i) => {
            const on = i === live;
            return (
              <li
                key={title}
                ref={(el) => {
                  rows.current[i] = el;
                }}
                className={`relative grid grid-cols-[2.5rem_minmax(0,1fr)] gap-x-4 gap-y-2 border-b border-line-soft px-4 py-5 transition-colors duration-500 md:grid-cols-[4rem_minmax(0,1.1fr)_minmax(0,1.6fr)_6rem] md:gap-6 md:py-7 ${
                  on ? "bg-status-green/[0.07]" : ""
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`absolute inset-y-0 left-0 w-[3px] origin-top bg-status-green transition-transform duration-500 ${on ? "scale-y-100" : "scale-y-0"}`}
                />
                <span className="tnum pt-1.5 text-[12px] text-muted-2">{String(i + 1).padStart(2, "0")}</span>
                <h3
                  className={`font-display text-[1.375rem] leading-tight tracking-[-0.02em] transition-colors duration-500 md:text-[1.75rem] ${
                    on ? "text-primary" : "text-muted-2"
                  }`}
                >
                  {title}
                  <span
                    className={`tnum ml-3 inline-block align-middle text-[9px] uppercase tracking-[0.16em] transition-opacity duration-500 ${
                      on ? "text-status-green opacity-100" : "opacity-0"
                    }`}
                  >
                    ● Live
                  </span>
                </h3>
                <p className={`col-start-2 text-[15px] leading-relaxed transition-colors duration-500 md:col-start-auto text-muted`}>
                  {body}
                </p>
                <span className="tnum hidden pt-1.5 text-right text-[10px] uppercase tracking-[0.12em] text-muted-2 md:block">{dur}</span>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
