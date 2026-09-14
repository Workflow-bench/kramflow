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
  // Label reverted to "Green Room" per explicit request — `value` and
  // `route` stay `green-room` regardless of which label is current, so
  // stored display types, share links, and existing display URLs are
  // untouched either way.
  { value: "green-room", label: "Green Room", route: "/green-room" },
  { value: "av", label: "AV", route: "/av" },
  { value: "general", label: "General", route: "/general" },
  // A custom display has no single fixed route the way the 4 real types
  // do — which screen it renders depends on which DisplayProfile it's
  // pointed at (?profileId=... in the URL, same as ?token=...). This
  // route is the base path every custom display link is built from; see
  // app/custom/page.tsx.
  { value: "custom", label: "Custom", route: "/custom" },
];

// "stale" (one missed heartbeat, still short of the hard offline
// threshold) sits between the two — see lib/display-engine/
// use-register-display.ts's STALE_AFTER_MS/OFFLINE_AFTER_MS.
export type DisplayStatus = "online" | "stale" | "offline";

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

// ---------------------------------------------------------------------------
// Display Profiles — the customizable "custom" display type.
//
// A profile fully describes one custom display's content: pick a zone
// template, assign a widget (or leave it empty) to each of that
// template's zones, set a viewing-distance scale, and optionally an
// accent color / static text block. Backed by the real `display_profiles`
// table (supabase/migrations/0013_display_profiles.sql) — see that
// migration's comment for why this exists (display_registry.profile_id
// was already there, pointing at nothing real, since a prior pass).
//
// Deliberately NOT part of DisplayEngineState/the Realtime broadcast-sync
// machinery in store.tsx: a profile is authored configuration (same
// category as Program/Session), not live show state a client mutates
// every few seconds — plain REST CRUD (app/api/display-engine/profiles)
// is the right tool, the same way sessions/programs use plain REST rather
// than the engine's own sync transport.
// ---------------------------------------------------------------------------

export type WidgetType = "now-playing" | "up-next" | "status-pill" | "schedule-list" | "custom-text";

export const WIDGET_TYPES: { value: WidgetType; label: string; desc: string }[] = [
  { value: "now-playing", label: "Now Playing", desc: "Current item, presenter, and countdown" },
  { value: "up-next", label: "Up Next", desc: "The next item on the schedule" },
  { value: "status-pill", label: "Status", desc: "LIVE / PAUSED / STANDBY / ON HOLD" },
  { value: "schedule-list", label: "Schedule", desc: "The full run of show for the active session" },
  { value: "custom-text", label: "Custom Text", desc: "A static message this profile sets (wifi password, venue rules, sponsor line...)" },
];

export type ZoneTemplateId = "hero-sidebar" | "grid-3up" | "full-bleed";

export interface ZoneTemplateDef {
  id: ZoneTemplateId;
  label: string;
  desc: string;
  /** Zone ids in this template, in reading order — the profile editor and
   *  the renderer both iterate this list rather than hardcoding zone
   *  names, so a template's shape lives in exactly one place. */
  zones: { id: string; label: string }[];
}

// 3 templates, not free-form drag-and-drop layout — see
// docs/CUSTOM-DISPLAY-REQUIREMENTS.md section 2.2 for the reasoning.
export const ZONE_TEMPLATES: ZoneTemplateDef[] = [
  {
    id: "hero-sidebar",
    label: "Hero + Sidebar",
    desc: "One large focal widget with a narrower column beside it — general's own layout shape.",
    zones: [
      { id: "hero", label: "Hero" },
      { id: "sidebar", label: "Sidebar" },
    ],
  },
  {
    id: "grid-3up",
    label: "3-Up Grid",
    desc: "Three equal widgets side by side — good for a monitor with several things to track at once.",
    zones: [
      { id: "left", label: "Left" },
      { id: "center", label: "Center" },
      { id: "right", label: "Right" },
    ],
  },
  {
    id: "full-bleed",
    label: "Full Bleed",
    desc: "One widget filling the whole screen — for a single-purpose screen (e.g. just a schedule, or just branding).",
    zones: [{ id: "main", label: "Main" }],
  },
];

export function getZoneTemplate(id: ZoneTemplateId): ZoneTemplateDef {
  return ZONE_TEMPLATES.find((t) => t.id === id) ?? ZONE_TEMPLATES[0];
}

export type ViewingDistance = "close" | "far";

export interface DisplayProfile {
  id: string;
  eventId: string;
  name: string;
  template: ZoneTemplateId;
  /** zoneId -> widget assigned to it, or null for an empty zone. */
  zones: Record<string, WidgetType | null>;
  /** "close" = console/arm's-length type scale, "far" = across-the-room TV scale — same principle the case study calls "distance dictates fidelity," applied here instead of being hand-encoded per display client. */
  viewingDistance: ViewingDistance;
  accentColor: string | null;
  customText: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DisplayProfileInput {
  name: string;
  template: ZoneTemplateId;
  zones: Record<string, WidgetType | null>;
  viewingDistance: ViewingDistance;
  accentColor: string | null;
  customText: string | null;
}
