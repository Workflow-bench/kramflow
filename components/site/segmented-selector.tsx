"use client";

import { useRef } from "react";
import { motion } from "framer-motion";
import { useTransitionMotion } from "./motion-state";

/**
 * A small segmented control with a selection indicator that travels between items.
 *
 * The moving-indicator treatment is adapted from Motion Primitives'
 * `animated-background` (MIT, https://github.com/ibelick/motion-primitives —
 * licence: https://github.com/ibelick/motion-primitives/blob/main/LICENCE.md), which
 * is the same idea Watermelon's Continuous Tabs demonstrates. Nothing was installed
 * for it: the effect is a `layoutId` on the Framer Motion already in this project, so
 * no second motion runtime and no component platform enter the dependency tree.
 *
 * What was added on top of that reference is the accessibility contract it does not
 * carry: a real tablist with roving tabindex, Left/Right/Up/Down, Home/End, wrapping,
 * and selection that follows focus. There is no hover-only state — hovering never
 * changes which panel is shown, so a keyboard user and a pointer user drive exactly
 * the same control.
 *
 * These are homepage-owned controls that choose which recorded capture is displayed.
 * They are not a copy of any control inside the product and must never be styled to
 * look like one.
 */

export interface SegmentedItem {
  value: string;
  label: string;
}

export function SegmentedSelector({
  items,
  value,
  onChange,
  label,
  idBase,
  panelId,
  className = "",
}: {
  items: readonly SegmentedItem[];
  value: string;
  onChange: (value: string) => void;
  /** Accessible name for the group. */
  label: string;
  idBase: string;
  /** The region these controls govern. */
  panelId: string;
  className?: string;
}) {
  const animate = useTransitionMotion();
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  function move(to: number) {
    const next = items[(to + items.length) % items.length];
    onChange(next.value);
    refs.current[next.value]?.focus();
  }

  return (
    <div
      role="tablist"
      aria-label={label}
      className={`inline-flex items-center gap-1 rounded-control border border-line-soft bg-raised/60 p-1 ${className}`}
    >
      {items.map((item, i) => {
        const selected = item.value === value;
        return (
          <button
            key={item.value}
            ref={(el) => {
              refs.current[item.value] = el;
            }}
            id={`${idBase}-${item.value}`}
            role="tab"
            type="button"
            aria-selected={selected}
            aria-controls={panelId}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(item.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight" || e.key === "ArrowDown") {
                e.preventDefault();
                move(i + 1);
              } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
                e.preventDefault();
                move(i - 1);
              } else if (e.key === "Home") {
                e.preventDefault();
                move(0);
              } else if (e.key === "End") {
                e.preventDefault();
                move(items.length - 1);
              }
            }}
            className={`relative inline-flex h-11 items-center rounded-control px-4 text-[14px] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
              selected ? "text-primary" : "text-muted hover:text-primary"
            }`}
          >
            {selected && (
              <motion.span
                layoutId={`${idBase}-indicator`}
                aria-hidden="true"
                className="absolute inset-0 -z-10 rounded-control border border-line bg-card"
                transition={animate ? { type: "spring", stiffness: 380, damping: 32, duration: 0.21 } : { duration: 0 }}
              />
            )}
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
