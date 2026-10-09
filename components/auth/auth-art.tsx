"use client";

import Link from "next/link";
import { useLayoutEffect, useRef } from "react";
import { gsap } from "gsap";
import { Wordmark } from "@/components/site/wordmark";
import { useReduced } from "@/components/site/motion";
import { InteractiveDotsGrid } from "./interactive-dots-grid";

/**
 * Static product preview for the auth split. The same anatomy as the landing demo's
 * Operator Console replica (components/site/replica/console-replica.tsx): a program
 * rail, the live item, a countdown. No timers and no motion on the data itself — it is
 * a composition, not a live status, labelled as a preview so it cannot read as a real
 * show. Built with the exact token language that replica uses (the uppercase
 * `text-[10px] tracking-[0.16em] text-muted-2` section label, `tnum` on every number,
 * the `status-green/10` live row), not an approximation of it, so this panel reads as
 * the same product, not a different mockup style.
 */
const PROGRAM = [
  { n: 1, title: "Opening remarks", owner: "Amara Osei", state: "done" },
  { n: 2, title: "Keynote", owner: "Rafael Costa", state: "live" },
  { n: 3, title: "Sponsor reel", owner: "AV", state: "next" },
] as const;

const OUTPUTS = [
  { label: "Stage", status: "Live", tone: "text-status-green" },
  { label: "Speaker", status: "Next cue", tone: "text-status-blue" },
  { label: "Lobby", status: "Standby", tone: "text-status-orange" },
] as const;

export function AuthArt({ className = "" }: { className?: string }) {
  const reduced = useReduced();
  const rootRef = useRef<HTMLDivElement>(null);

  // A one-shot mount reveal, not a scroll reveal (this panel is never scrolled past —
  // AuthShell's layout centers it in the viewport), so it is its own small gsap.context
  // rather than the project's scroll-triggered reveal.ts. Same discipline: reduced
  // motion skips straight to the resolved state, and the context is reverted on
  // unmount so Strict Mode's double-invoke never doubles the tweens.
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root || reduced) return;
    const ctx = gsap.context(() => {
      const targets = gsap.utils.toArray<HTMLElement>("[data-art-reveal]");
      gsap.set(targets, { opacity: 0, y: 12 });
      gsap.to(targets, {
        opacity: 1,
        y: 0,
        duration: 0.5,
        stagger: 0.08,
        ease: "power2.out",
        delay: 0.1,
      });
    }, root);
    return () => ctx.revert();
  }, [reduced]);

  return (
    <div
      ref={rootRef}
      aria-hidden="true"
      className={`auth-art-panel relative isolate overflow-hidden border-r border-line-soft p-12 ${className}`}
    >
      {/* This page's own gradient mesh palette (app/globals.css), a dedicated
          unmasked layer — reusing `.ambient-light-hero` directly pulled in its
          bottom-fade mask (added to fix the hero/section seam, see that commit),
          which cut this panel off well short of its own, much taller box. */}
      <div className="auth-art-glow absolute inset-0 -z-10" />
      {/* The interactive dot field — see interactive-dots-grid.tsx for the full
          source note (Osmo's "Interactive Dots Grid Background", fetched and
          ported: canvas, no GSAP, grows and darkens toward the pointer). */}
      <InteractiveDotsGrid className="-z-10" />

      <div className="relative flex h-full flex-col">
        {/* The one logo for the whole auth split (auth-shell.tsx hides its own copy
            once this panel is shown) — top-left, a real link back to the homepage. */}
        <Link
          data-art-reveal
          href="/"
          className="-m-2 inline-flex w-fit rounded-chip p-2 transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <Wordmark />
        </Link>

        {/* The proof sits in the panel's vertical center, between the logo and the
            closing line — not pinned to the top with the rest of the height left
            empty below it. */}
        <div className="flex flex-1 flex-col justify-center">
          <div data-art-reveal className="rounded-panel border border-line bg-card/95 p-5 shadow-[0_40px_120px_-48px_rgba(0,0,0,0.9)]">
            <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.16em] text-muted-2">
              <span>Program</span>
              <span className="tnum">2 / 3</span>
            </div>
            <ul className="mt-3 flex flex-col">
              {PROGRAM.map((item) => (
                <li
                  key={item.n}
                  className={`flex items-center gap-3 border-b border-line-soft px-1 py-2.5 last:border-b-0 ${
                    item.state === "live" ? "bg-status-green/10" : ""
                  }`}
                >
                  <span className="tnum w-4 text-[12px] text-muted-2">{item.n}</span>
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-[13px] ${item.state === "live" ? "text-primary" : "text-muted"}`}>
                      {item.title}
                    </span>
                    <span className="block text-[11px] text-muted-2">{item.owner}</span>
                  </span>
                  <span
                    className={`tnum text-[10px] uppercase tracking-[0.16em] ${
                      item.state === "live" ? "text-status-green" : "text-muted-2"
                    }`}
                  >
                    {item.state === "live" ? "Live" : item.state === "next" ? "Next" : "Done"}
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex items-baseline justify-between border-t border-line-soft pt-4">
              <span className="text-[12px] text-muted">Remaining</span>
              <span className="tnum text-[28px] leading-none text-primary">04:12</span>
            </div>
          </div>

          <div data-art-reveal className="mt-4 grid grid-cols-3 gap-3">
            {OUTPUTS.map((out) => (
              <div key={out.label} className="rounded-control border border-line-soft bg-raised/80 p-3">
                <p className="text-[13px] text-primary">{out.label}</p>
                <p className={`mt-2 text-[12px] ${out.tone}`}>{out.status}</p>
              </div>
            ))}
          </div>
        </div>

        {/* The closing line, last — read after the proof above it, not before it. */}
        <div data-art-reveal className="flex flex-col gap-2">
          <p className="tnum text-[12px] uppercase tracking-[0.2em] text-muted-2">Product preview</p>
          <p className="font-display text-[clamp(1.75rem,2.6vw,2.25rem)] leading-[1.1] text-primary">
            One cue.
            <br />
            The whole room follows.
          </p>
        </div>
      </div>
    </div>
  );
}
