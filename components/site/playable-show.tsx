"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useInView } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Reveal, useReduced } from "./motion";
import { SplitFlap } from "./split-flap";

/**
 * "Now you call it." A working miniature of the product's core loop, built on
 * the same seeded rundown as every capture on the page.
 *
 * Next advances the cue and the four venue screens follow in order, a beat
 * apart, each flashing a cue-light ring as it lands. "+1 min" lengthens the
 * live item, and every downstream start time cascades (the split-flap digits
 * roll). The stage clock counts down in real time while the block is on
 * screen. Nothing is fetched and nothing is stored.
 *
 * Every row and screen has a fixed size, so no press changes the layout.
 * Under reduced motion the screens update at once, the digits jump, and the
 * clock holds still.
 */

const ITEMS = [
  { title: "Doors and Walk-in Music", owner: "AV", min: 30 },
  { title: "Welcome and Housekeeping", owner: "Stage Manager", min: 5 },
  { title: "Opening Keynote", owner: "Amara Osei", min: 25 },
  { title: "Product Launch Demo", owner: "Rafael Costa", min: 20 },
  { title: "Coffee Break", owner: "", min: 15 },
  { title: "Panel: Scaling Live Events", owner: "Moderator", min: 40 },
  { title: "Closing Remarks", owner: "", min: 10 },
];
const FIRST_START = 8 * 60 + 55;
const START_CUE = 2;
const SCREENS = ["Stage monitor", "Lobby", "AV booth", "Green room"] as const;

function clock(mins: number) {
  return `${Math.floor(mins / 60)}:${String(mins % 60).padStart(2, "0")}`;
}
function mmss(sec: number) {
  return `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;
}

export function PlayableShow() {
  const reduce = useReduced();
  const root = useRef<HTMLElement>(null);
  const onScreen = useInView(root, { margin: "-10% 0px" });

  const [cue, setCue] = useState(START_CUE);
  const [extra, setExtra] = useState<number[]>(() => ITEMS.map(() => 0));
  const [left, setLeft] = useState(ITEMS[START_CUE].min * 60);
  // Which cue each screen is currently showing; they trail `cue` by a beat.
  const [shown, setShown] = useState<number[]>([START_CUE, START_CUE, START_CUE, START_CUE]);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    if (reduce || !onScreen) return;
    const id = window.setInterval(() => setLeft((l) => Math.max(0, l - 1)), 1000);
    return () => window.clearInterval(id);
  }, [reduce, onScreen]);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((t) => window.clearTimeout(t));
  }, []);

  const totalExtra = extra.reduce((a, b) => a + b, 0);
  const starts = ITEMS.map((_, i) => FIRST_START + ITEMS.slice(0, i).reduce((a, it, j) => a + it.min + extra[j], 0));

  function propagate(next: number) {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
    SCREENS.forEach((_, k) => {
      if (reduce) return setShown((s) => s.map(() => next));
      timers.current.push(
        window.setTimeout(() => setShown((s) => s.map((v, i) => (i === k ? next : v))), k * 170)
      );
    });
  }

  function next() {
    if (cue >= ITEMS.length - 1) return;
    const n = cue + 1;
    setCue(n);
    setLeft((ITEMS[n].min + extra[n]) * 60);
    propagate(n);
  }
  function addMinute() {
    setExtra((e) => e.map((v, i) => (i === cue ? v + 1 : v)));
    setLeft((l) => l + 60);
  }
  function reset() {
    setCue(START_CUE);
    setExtra(ITEMS.map(() => 0));
    setLeft(ITEMS[START_CUE].min * 60);
    propagate(START_CUE);
  }

  const done = cue >= ITEMS.length - 1;

  return (
    <section ref={root} id="product" data-cue="Your turn" className="border-b border-line-soft">
      <div className="mx-auto max-w-[1600px] px-6 py-16 sm:px-10 lg:py-28">
        <Reveal>
          <h2 className="max-w-[14ch] font-display text-[clamp(2.25rem,5.5vw,4.75rem)] text-primary">
            Now you call the cue.
          </h2>
          <p className="mt-5 max-w-[40ch] text-base leading-relaxed text-muted">Press Next. Four screens follow.</p>
        </Reveal>

        <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-14">
          {/* ---------------------------------------------- the rundown */}
          <div>
            <ul className="overflow-hidden rounded-panel border border-line-soft bg-card/60">
              {ITEMS.map((it, i) => {
                const live = i === cue;
                const past = i < cue;
                return (
                  <li
                    key={it.title}
                    className={`grid h-12 grid-cols-[1.75rem_minmax(0,1fr)_auto_2.75rem] items-center gap-2 border-b border-line-soft px-3 text-[13px] last:border-b-0 sm:gap-3 sm:px-4 sm:text-[14px] ${
                      live ? "bg-status-green/10 text-primary" : past ? "text-muted-2/60" : "text-muted"
                    }`}
                  >
                    <span className="tnum text-[11px] text-muted-2">{i + 1}</span>
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="truncate">{it.title}</span>
                      {live && (
                        <span className="tnum shrink-0 rounded-chip bg-status-green/20 px-1.5 py-0.5 text-[9px] uppercase tracking-[0.14em] text-status-green">
                          Live
                        </span>
                      )}
                      {i === cue + 1 && (
                        <span className="tnum shrink-0 text-[9px] uppercase tracking-[0.14em] text-status-blue">Next</span>
                      )}
                    </span>
                    <SplitFlap value={clock(starts[i])} className="text-[13px] sm:text-[14px]" />
                    <span className="tnum text-right text-[11px] text-muted-2">{it.min + extra[i]}m</span>
                  </li>
                );
              })}
            </ul>

            <div className="mt-5 flex flex-wrap items-center gap-2.5">
              <Button variant="primary" size="md" onClick={next} disabled={done}>
                Next
              </Button>
              <Button variant="secondary" size="md" onClick={addMinute} disabled={done}>
                + 1 min
              </Button>
              <Button variant="ghost" size="md" onClick={reset}>
                Reset
              </Button>
              <span
                className={`tnum ml-1 text-[11px] uppercase tracking-[0.14em] ${totalExtra > 0 ? "text-status-orange" : "text-muted-2"}`}
                aria-live="polite"
              >
                {totalExtra > 0 ? `${totalExtra} min behind` : done ? "Show complete" : "On time"}
              </span>
            </div>
          </div>

          {/* ------------------------------------------ the four screens */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            {SCREENS.map((name, k) => {
              const idx = shown[k];
              const it = ITEMS[idx];
              const nxt = ITEMS[idx + 1];
              return (
                <figure key={name} className="relative">
                  <div className="relative aspect-[16/11] overflow-hidden rounded-[0.35rem] bg-black p-3 ring-1 ring-line-soft sm:p-4">
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0.15 }}
                      animate={{ opacity: 1 }}
                      transition={reduce ? { duration: 0 } : { duration: 0.35 }}
                      className="flex h-full flex-col justify-between"
                    >
                      {k === 0 && (
                        <>
                          <p className="tnum text-[clamp(1.5rem,3.6vw,2.75rem)] leading-none text-status-green">{mmss(left)}</p>
                          <p className="text-[11px] leading-tight text-primary sm:text-[13px]">{it.title}</p>
                        </>
                      )}
                      {k === 1 && (
                        <>
                          <p className="text-[12px] leading-tight text-primary sm:text-[15px]">{it.title}</p>
                          <p className="tnum text-[9px] uppercase tracking-[0.14em] text-muted-2 sm:text-[10px]">
                            Next · <span className="text-muted">{nxt ? nxt.title : "End of session"}</span>
                          </p>
                        </>
                      )}
                      {k === 2 && (
                        <>
                          <p className="tnum text-[10px] uppercase tracking-[0.16em] text-status-green sm:text-[11px]">
                            ● Cue {idx + 1} live
                          </p>
                          <p className="tnum text-[10px] uppercase leading-snug tracking-[0.12em] text-status-orange sm:text-[11px]">
                            ● Standby
                            <span className="block normal-case tracking-normal text-muted">{nxt ? nxt.title : "None"}</span>
                          </p>
                        </>
                      )}
                      {k === 3 && (
                        <>
                          <p className="tnum text-[9px] uppercase tracking-[0.16em] text-status-orange sm:text-[10px]">Prepare now</p>
                          <p className="text-[12px] leading-tight text-primary sm:text-[15px]">
                            {nxt ? (nxt.owner || "Crew") : "Thank you"}
                            <span className="block text-[10px] text-muted sm:text-[12px]">{nxt ? nxt.title : ""}</span>
                          </p>
                        </>
                      )}
                    </motion.div>
                    {/* Cue-light ring: lands on each screen as the update reaches it. */}
                    <motion.span
                      key={`ring-${idx}`}
                      aria-hidden="true"
                      initial={{ opacity: idx === START_CUE && cue === START_CUE ? 0 : 1 }}
                      animate={{ opacity: 0 }}
                      transition={reduce ? { duration: 0 } : { duration: 1 }}
                      className="pointer-events-none absolute inset-0 rounded-[0.35rem] ring-2 ring-inset ring-status-green"
                    />
                  </div>
                  <figcaption className="tnum mt-2 text-[10px] uppercase tracking-[0.16em] text-muted-2">{name}</figcaption>
                </figure>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
