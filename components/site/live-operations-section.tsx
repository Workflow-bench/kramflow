"use client";

import { useRef } from "react";
import { useInView } from "framer-motion";
import { SplitFlap } from "./split-flap";

/**
 * The inverted beat. After a run of dark, image-led sections the page flips
 * to the light ground for one statement and four facts about how the product
 * is built, then returns to dark for the close. No product visual here on
 * purpose, and every figure is a fact from the product's own spec, never a
 * usage statistic.
 */

const FACTS = [
  { to: "4", suffix: "", label: "Display surfaces", detail: "General, AV, Green Room and Presenter, each cut for its own audience." },
  { to: "1", suffix: "s", label: "To reach every screen", detail: "Connected displays reflect a cue within about a second, with nothing relayed by hand." },
  { to: "6", suffix: "", label: "Digits to connect a TV", detail: "Type the code on the wall screen. No account, no login, no cable." },
  { to: "200", suffix: "+", label: "Items in a real cue sheet", detail: "The rundown this was built against: multi-day, multi-session, imported from Excel." },
];


export function LiveOperationsSection() {
  const facts = useRef<HTMLDListElement>(null);
  // The figures start on zeros and roll to their values as the row arrives.
  const arrived = useInView(facts, { once: true, margin: "-80px" });
  return (
    <section data-cue="Guarantees" data-cue-invert className="border-b border-background/15 bg-primary text-background">
      <div className="mx-auto max-w-[1280px] px-6 py-20 sm:px-10 lg:py-32">
        <h2 className="max-w-[15ch] font-display text-[clamp(2.25rem,6vw,5rem)]">
          Built for the minute it goes wrong.
        </h2>


        <dl ref={facts} className="mt-12 grid grid-cols-2 gap-px overflow-hidden rounded-panel border border-background/15 bg-background/15 lg:grid-cols-4">
          {FACTS.map((f) => (
            <div key={f.label} className="flex flex-col-reverse justify-end bg-primary p-5 sm:p-7">
              <dt className="tnum mt-5 text-[11px] uppercase tracking-[0.16em] text-background/60">
                <span className="sr-only">{f.to}{f.suffix} </span>
                {f.label}
              </dt>
              <div aria-hidden="true" className="font-display text-[clamp(2.25rem,4.4vw,3.75rem)] leading-none">
                <SplitFlap value={arrived ? f.to : f.to.replace(/\d/g, "0")} tone="light" />
                {f.suffix && <span className="ml-1 text-[0.6em]">{f.suffix}</span>}
              </div>
            </div>
          ))}
        </dl>

      </div>
    </section>
  );
}
