import type { TimerColorState } from "./types";

/**
 * Timer color escalation. Green/orange/red reference the actual
 * app/globals.css variables (--color-green / --color-orange / --color-red)
 * directly, rather than a second hardcoded hex copy of them, so a Presenter
 * Display can never silently drift from the rest of KramFlow's palette
 * again — a prior copy here (#22c55e/#f59e0b/#ef4444) had quietly diverged
 * from globals.css's actual values (#2bb673/#e8a33d/#e5484d) despite the
 * comment claiming otherwise. Yellow is a real, separate hex — the rest of
 * the app doesn't need a 5-step color ramp, but a confidence monitor
 * genuinely does (the one deliberate, documented exception to "no second
 * palette" — see docs/DISPLAY_ENGINE.md). "critical" intentionally reuses
 * red rather than introducing a 6th tone.
 */
export const TIMER_COLORS: Record<TimerColorState, string> = {
  green: "var(--color-green)",
  yellow: "#eab308",
  orange: "var(--color-orange)",
  red: "var(--color-red)",
  critical: "var(--color-red)",
};

export const TIMER_COLOR_LABELS: Record<TimerColorState, string> = {
  green: "On time",
  yellow: "Approaching end",
  orange: "Final minute",
  red: "Overtime",
  critical: "Critical overtime",
};
