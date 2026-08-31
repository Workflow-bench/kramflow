"use client";

import { MotionConfig } from "framer-motion";

/**
 * No `prefers-reduced-motion` handling anywhere in the
 * app — every Framer Motion transition (dialog fade/scale, alert opacity,
 * Hold takeover) played regardless of the OS setting. `reducedMotion="user"`
 * makes every `motion.*` component in the tree respect that preference
 * automatically (durations collapse to near-zero, transforms are skipped)
 * without touching any individual component's own transition config — a
 * single point of control instead of a per-component audit.
 */
export function MotionPreferences({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
