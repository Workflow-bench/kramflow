"use client";

import { motion } from "framer-motion";
import { ProductShot } from "./product-shot";
import { AppWindow } from "./app-window";

/**
 * Name the problem, then answer it with the artefact in one beat.
 *
 * Splitting these apart is what gave the earlier page its flat rhythm:
 * a text section followed by another text section, so nothing landed.
 * Here the statement is set at display scale with a short measure, and
 * the real Cue Sheet arrives directly beneath it, cropped at the fold —
 * because a rundown that fits neatly inside a card is lying about the
 * size of the thing.
 */
export function ProblemSection() {
  return (
    <section className="relative overflow-hidden border-b border-line-soft">
      <div className="mx-auto max-w-[1600px] px-6 pt-24 sm:px-10 lg:pt-36">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-4xl"
        >
          <h2 className="font-display text-[clamp(1.875rem,4.6vw,3.5rem)] text-primary">
            Most shows still run on a spreadsheet, a group chat, and whoever is standing nearest the booth.
          </h2>
          <p className="mt-8 max-w-[54ch] text-lg leading-relaxed text-muted">
            The rundown lives in one file. The timing lives in someone&apos;s head. The booth hears about the change
            when it is shouted across the room, and the lobby screen is simply wrong for the next four minutes. That
            holds together right up until the moment it matters.
          </p>
        </motion.div>
      </div>

      <div className="relative mx-auto mt-16 max-w-[1600px] px-6 sm:px-10 lg:mt-24">
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.15 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="relative mx-auto max-w-5xl"
        >
          {/* Windowed like every other desktop capture on the page — this
              was previously the one full-app screenshot with no chrome,
              which left it ambiguous whether the hard-edged rectangle was
              a crop or a card. The bottom fade still bleeds past the
              window's own edge underneath it, so the rundown still reads
              as continuing past the frame; only the top now has a
              designed edge instead of an arbitrary cut. */}
          <AppWindow label="/e/northwind-summit-2026/operator/cue-sheet" className="shadow-[0_40px_120px_-30px_rgba(0,0,0,0.85)]">
            <ProductShot shot="cueSheet" sizes="(min-width: 1024px) 64rem, 100vw" />
          </AppWindow>
          {/* Fade the last rows into the page ground: the rundown continues
              past the frame rather than stopping on a hard edge. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-background to-transparent"
          />
        </motion.div>
        <p className="mx-auto mt-6 max-w-5xl text-console-meta text-muted-2">
          One session of a two-day conference. Import the rundown you already have from Excel, or build it here.
        </p>
      </div>

      {/* Trimmed from h-28: stacked on top of One Cue's own h-screen stage
          (which centers a content block shorter than the viewport, adding
          its own black margin above the heading), this spacer was
          contributing to a scroll stretch of dead black between the cue
          sheet and the "One cue" headline. Left small rather than
          removed — the section still needs a beat before the next one. */}
      <div className="h-10 lg:h-14" />
    </section>
  );
}
