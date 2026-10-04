"use client";

import { motion } from "framer-motion";
import { useReduced } from "./motion";

/**
 * Mechanical departure-board digits. Each digit is a tile holding a vertical
 * strip of 0-9; changing the value rolls the strip on a spring, with a seam
 * across the middle like a real flap. Non-digits (colons, suffixes) sit still.
 * Only `transform` animates, and a tile's size never changes.
 */
function Digit({ d, tone }: { d: number; tone: "dark" | "light" }) {
  const reduce = useReduced();
  return (
    <span
      aria-hidden="true"
      className={`relative inline-block h-[1.2em] w-[0.7em] overflow-hidden rounded-[0.14em] ${
        tone === "dark" ? "bg-raised/80 ring-1 ring-line-soft" : "bg-background ring-1 ring-background"
      }`}
    >
      <motion.span
        className="absolute inset-x-0 top-0 flex flex-col"
        initial={false}
        animate={{ y: `${-d * 10}%` }}
        transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 210, damping: 20, mass: 0.8 }}
      >
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
          <span key={n} className="flex h-[1.2em] items-center justify-center leading-none text-primary">
            {n}
          </span>
        ))}
      </motion.span>
      <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-1/2 h-px bg-black/60" />
    </span>
  );
}

export function SplitFlap({
  value,
  className = "",
  tone = "dark",
}: {
  value: string;
  className?: string;
  tone?: "dark" | "light";
}) {
  return (
    <span role="img" aria-label={value} className={`tnum inline-flex items-center gap-[0.08em] ${className}`}>
      {value.split("").map((ch, i) =>
        /\d/.test(ch) ? (
          <Digit key={i} d={Number(ch)} tone={tone} />
        ) : (
          <span key={i} aria-hidden="true" className="px-[0.04em]">
            {ch}
          </span>
        )
      )}
    </span>
  );
}
