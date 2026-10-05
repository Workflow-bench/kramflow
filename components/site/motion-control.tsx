"use client";

import { Pause, Play } from "lucide-react";
import { useReduced } from "./motion";
import { setMotionPaused, useMotionPaused } from "./motion-state";

/**
 * The visitor's stop for continuous motion (Ableton Push's visible pause, adapted).
 *
 * It is a real control, not an icon that appears on hover: fixed, always reachable,
 * keyboard-focusable, and labelled with its current state. Pausing stops the ambient
 * light only — every piece of content, the navigation, the recorded cue example and
 * the view selector keep working exactly as before.
 *
 * When the OS already asks for reduced motion there is nothing for this to turn off,
 * so it reports that instead of offering a dead toggle.
 */
export function MotionControl() {
  const reduce = useReduced();
  const paused = useMotionPaused();

  if (reduce) {
    return (
      <p className="fixed bottom-4 left-4 z-40 rounded-chip border border-line bg-raised px-3 py-2 text-[12px] text-muted">
        Motion off · system setting
      </p>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setMotionPaused(!paused)}
      aria-pressed={paused}
      className="fixed bottom-4 left-4 z-40 inline-flex h-11 items-center gap-2 rounded-chip border border-line bg-raised px-3.5 text-[13px] text-primary transition-colors hover:bg-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      {paused ? <Play className="h-3.5 w-3.5" strokeWidth={2} /> : <Pause className="h-3.5 w-3.5" strokeWidth={2} />}
      {paused ? "Resume motion" : "Pause motion"}
    </button>
  );
}
