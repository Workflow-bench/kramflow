/**
 * KramFlow Display Engine — core types.
 *
 * This module is additive and self-contained: it composes with the
 * existing `Program` / `Session` / `LiveState` from `@/lib/types` rather
 * than redefining program/session data. The engine only owns state that
 * has no equivalent in the existing app (display registry, timer overrides,
 * hold mode, broadcasts, profiles).
 */

import type { AlertSeverity } from "@/lib/types";

// ---------------------------------------------------------------------------
// Display identity
// ---------------------------------------------------------------------------

export type DisplayType =
  | "presenter"
  | "green-room"
  | "av"
  | "general"
  | "custom";

// The single source of truth for the 4 real display types + "custom" —
// was hand-duplicated in app/e/[eventId]/displays/page.tsx,
// app/e/[eventId]/broadcast/page.tsx (whose comment pointed at a
// nonexistent list in app/page.tsx — already-drifted evidence),
// components/dashboard/events-dashboard.tsx, and
// components/operator/command-palette.tsx, none of which composed from
// this DisplayType union or from each other.
export const DISPLAY_TYPES: { value: DisplayType; label: string; route: string }[] = [
  { value: "presenter", label: "Presenter", route: "/presenter" },
  { value: "green-room", label: "Green Room", route: "/green-room" },
  { value: "av", label: "AV", route: "/av" },
  { value: "general", label: "General", route: "/general" },
  { value: "custom", label: "Custom", route: "/presenter" },
];

export type DisplayStatus = "online" | "offline";

export interface DisplayInstance {
  id: string;
  name: string;
  type: DisplayType;
  room: string | null;
  profileId: string | null;
  registeredAt: string;
  lastSeenAt: string;
  /** Round-trip latency in ms from the most recent heartbeat, or null before the first sample. */
  latencyMs: number | null;
  /** Set by the Display Manager; the display polls for this and acts on it (fullscreen, test message, reload). */
  pendingCommand: DisplayCommand | null;
}

export type DisplayCommand =
  | { type: "test-message"; text: string; issuedAt: string }
  | { type: "force-fullscreen"; issuedAt: string }
  | { type: "reload"; issuedAt: string };

// ---------------------------------------------------------------------------
// Display profiles — reusable presentation presets
// ---------------------------------------------------------------------------

export interface DisplayProfile {
  id: string;
  name: string;
  builtIn: boolean;
  layout: {
    fontScale: number; // multiplier applied to the base type scale, e.g. 1 = default
    showProgressRing: boolean;
    showClock: boolean;
    orientation: "landscape" | "portrait";
  };
  visibleWidgets: DisplayWidget[];
  colorOverrides: Partial<Record<TimerColorState, string>>;
  refreshMs: number; // heartbeat / re-render cadence for slow-changing widgets
}

export type DisplayWidget =
  | "timer"
  | "clock"
  | "program-title"
  | "program-subtitle"
  | "next-program"
  | "progress-ring"
  | "speaker"
  | "room"
  | "messages"
  | "stage-status"
  | "alerts"
  | "running-order"
  | "session-name";

// ---------------------------------------------------------------------------
// Timer engine
// ---------------------------------------------------------------------------

export type TimerMode =
  | "countdown"
  | "count-up"
  | "session"
  | "clock"
  | "minimal"
  | "program";

export type TimerColorState = "green" | "yellow" | "orange" | "red" | "critical";

export type TimerSource = "auto" | "manual";

export interface TimerThresholds {
  /** Seconds remaining at/below which the state becomes yellow. */
  yellowAt: number;
  /** Seconds remaining at/below which the state becomes orange. */
  orangeAt: number;
  /** Seconds remaining at/below which the state becomes red (0 = overtime itself). */
  redAt: number;
  /** Seconds *into* overtime at which red starts blinking ("critical"). */
  criticalAfter: number;
}

export const DEFAULT_TIMER_THRESHOLDS: TimerThresholds = {
  yellowAt: 5 * 60,
  orangeAt: 1 * 60,
  redAt: 0,
  criticalAfter: 60,
};

export interface TimerState {
  mode: TimerMode;
  source: TimerSource;
  /** When the current timer segment started, ISO timestamp. Null if never started. */
  startedAt: string | null;
  /** Total planned duration in seconds for this segment (manual mode) — ignored in auto mode, which reads the live program's duration. */
  durationSeconds: number;
  /** Timestamp a pause began, or null when running. Same shift-on-resume model as LiveState.pausedAt. */
  pausedAt: string | null;
  /** Cumulative manual adjustment in seconds (+/- quick buttons), applied on top of durationSeconds. */
  adjustmentSeconds: number;
  thresholds: TimerThresholds;
}

export const INITIAL_TIMER_STATE: TimerState = {
  mode: "program",
  source: "auto",
  startedAt: null,
  durationSeconds: 5 * 60,
  pausedAt: null,
  adjustmentSeconds: 0,
  thresholds: DEFAULT_TIMER_THRESHOLDS,
};

// ---------------------------------------------------------------------------
// Hold mode
// ---------------------------------------------------------------------------

export interface HoldState {
  active: boolean;
  message: string;
  subMessage: string | null;
  /** If true, the timer keeps running underneath the hold screen; if false, it freezes. */
  continueClock: boolean;
  activatedAt: string | null;
}

export const HOLD_PRESETS: { label: string; message: string; subMessage: string | null }[] = [
  { label: "Stand By", message: "Please Stand By", subMessage: null },
  { label: "Starting Soon", message: "Session Will Begin Shortly", subMessage: null },
  { label: "Technical Pause", message: "Technical Pause", subMessage: "We'll be right back" },
  { label: "Break", message: "Break", subMessage: null },
  { label: "Resume in 5", message: "Resuming Shortly", subMessage: "Resume in 05:00" },
];

export const INITIAL_HOLD_STATE: HoldState = {
  active: false,
  message: HOLD_PRESETS[0].message,
  subMessage: null,
  continueClock: false,
  activatedAt: null,
};

// ---------------------------------------------------------------------------
// Broadcast Center
// ---------------------------------------------------------------------------

export type BroadcastType =
  | "info"
  | "reminder"
  | "warning"
  | "success"
  | "emergency"
  | "custom";

export type BroadcastTargetKind = "all" | "type" | "display" | "group";

export interface BroadcastTarget {
  kind: BroadcastTargetKind;
  /** DisplayType when kind === "type", DisplayInstance id when kind === "display", group id when kind === "group". Unused when kind === "all". */
  value?: string;
}

export interface BroadcastMessage {
  id: string;
  type: BroadcastType;
  title: string;
  message: string;
  icon: string | null;
  priority: 1 | 2 | 3;
  target: BroadcastTarget;
  createdAt: string;
  /** ISO timestamp after which the message should no longer render, or null for no expiry. */
  expiresAt: string | null;
  /** How long to show it, in seconds, from the moment a display receives it — null means "until expiresAt or dismissed". */
  durationSeconds: number | null;
  acknowledgementRequired: boolean;
  persistent: boolean;
  acknowledgedBy: string[]; // display ids
  /** Non-null for a broadcast that was scheduled ahead rather than sent immediately. Cleared once promoted to active. */
  scheduledFor: string | null;
}

export interface BroadcastDraft {
  type: BroadcastType;
  title: string;
  message: string;
  icon: string | null;
  priority: 1 | 2 | 3;
  target: BroadcastTarget;
  expiresInMinutes: number | null;
  durationSeconds: number | null;
  acknowledgementRequired: boolean;
  persistent: boolean;
  /** ISO timestamp — if set and in the future, "Send" schedules instead of sending immediately. */
  scheduledFor: string | null;
}

export interface BroadcastTemplate {
  id: string;
  name: string;
  draft: BroadcastDraft;
}

export const EMERGENCY_PRESETS: { label: string; title: string; message: string }[] = [
  { label: "Evacuate", title: "EVACUATE BUILDING", message: "Proceed to the nearest exit calmly." },
  { label: "Medical", title: "Medical Emergency", message: "Medical staff requested. Please clear the area." },
  { label: "Power", title: "Power Failure", message: "Please remain calm. Updates to follow." },
  { label: "Fire", title: "Fire Alarm", message: "Proceed to the nearest exit immediately." },
  { label: "Lost Child", title: "Lost Child", message: "Please report to the nearest volunteer." },
];

// ---------------------------------------------------------------------------
// Groups (for targeted broadcasts / display organization)
// ---------------------------------------------------------------------------

export interface DisplayGroup {
  id: string;
  name: string;
  displayIds: string[];
}

// ---------------------------------------------------------------------------
// Root engine state — persisted + synced
// ---------------------------------------------------------------------------

export interface DisplayEngineState {
  registry: Record<string, DisplayInstance>;
  groups: Record<string, DisplayGroup>;
  profiles: Record<string, DisplayProfile>;
  timer: TimerState;
  hold: HoldState;
  broadcasts: {
    active: BroadcastMessage[];
    history: BroadcastMessage[];
    scheduled: BroadcastMessage[];
    templates: BroadcastTemplate[];
    favorites: string[]; // template ids
    drafts: BroadcastDraft[];
  };
  /** Self-reported "ready to be called" flag per program id — genuinely new information with no equivalent in the existing Program/LiveState models. Keyed rather than modeled on Program itself so it stays fully additive. */
  speakerReady: Record<string, boolean>;
}

// ---------------------------------------------------------------------------
// Transport envelope — see transport.ts
// ---------------------------------------------------------------------------

export type EngineEventType =
  | "state-sync" // full DisplayEngineState replacement
  | "display-heartbeat"
  | "display-command-ack";

export interface EngineMessage<T = unknown> {
  type: EngineEventType;
  payload: T;
  senderId: string;
  sentAt: string;
}

// Re-exported for convenience so display components importing from the
// engine don't also need a separate import from "@/lib/types" for alerts.
export type { AlertSeverity };
