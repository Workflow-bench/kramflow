export type ProgramItemType = "item" | "break";

export type ProgramStatus = "confirmed" | "draft" | "cut" | "tbd";

export type SidescreenMode = "none" | "slides" | "live_feed";

export interface AudioRequirement {
  mic: boolean;
  track: boolean;
}

export interface VideoRequirement {
  sidescreen: SidescreenMode;
  backdrop: boolean;
  pptSide: boolean;
}

export interface LightingRequirement {
  hall: string | null;
  stage: string | null;
}

export interface Program {
  id: string;
  order: number;
  type: ProgramItemType;
  title: string;
  kicker: string | null;
  itemCode: string | null;
  presenter: string | null;
  /** New in the Supabase-backed schema — "Presenter requirement" column. */
  presenterRequirement: string | null;
  /** New — phone/walkie contact so Green Room can page a late presenter. */
  presenterContact: string | null;
  sectionLabel: string | null;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  durationMinutes: number;
  audio: AudioRequirement;
  video: VideoRequirement;
  lights: LightingRequirement;
  /** New — live-feed camera angle, shown on the AV view. */
  cameraAngle: string | null;
  /** New — props left/right placement, shown on the Green Room props panel (Phase 3). */
  props: string | null;
  curtains: "open" | "closed" | null;
  stageNotes: string | null;
  team: string | null;
  notes: string | null;
  /** New — Confirmed/Draft/Cut/TBD, lets an item be staged without going live. */
  status: ProgramStatus;
  /** New — visual flag for critical cues on the operator's rundown list. */
  colorTag: string | null;
}

export interface Session {
  id: string;
  sheetName: string;
  eventName: string;
  dayLabel: string;
  sessionLabel: string;
  items: Program[];
}

export type AlertSeverity = "info" | "warning" | "critical";

export interface Alert {
  message: string;
  severity: AlertSeverity;
}

export interface SessionProgress {
  currentOrder: number | null; // null = not started
  startedAt: string | null;
}

export interface LiveState {
  activeSessionId: string;
  progressBySession: Record<string, SessionProgress>;
  /** Timestamp the current hold began, or null when not paused. Resuming
   *  shifts the active item's startedAt forward by the paused duration so
   *  every display's countdown freezes and resumes in lockstep. */
  pausedAt: string | null;
  alert: Alert | null;
  notesOverrides: Record<string, string>; // programId -> operator-edited notes
  /** Which operator tab currently holds the sequencing control lock (Start/
   *  Next/Previous/Jump/Hold/Finish/switch-session), or null when unclaimed
   *  — see docs on app/api/live/route.ts's lock check. Opt-in: unclaimed
   *  behaves exactly like before this existed, no forced workflow change
   *  for a single operator. */
  controllerId: string | null;
  /** Renewed by the controller every ~15s while held; a claim older than
   *  the server's staleness window is treated as abandoned (crashed tab,
   *  closed browser) and can be reclaimed by anyone without forcing. */
  controllerClaimedAt: string | null;
}

export function effectiveNotes(state: LiveState, program: Program): string {
  return state.notesOverrides[program.id] ?? program.notes ?? "";
}

function activeProgress(state: LiveState): SessionProgress {
  return state.progressBySession[state.activeSessionId] ?? { currentOrder: null, startedAt: null };
}

export function getLive(session: Session, state: LiveState): Program | null {
  const { currentOrder } = activeProgress(state);
  if (currentOrder === null) return null;
  return session.items.find((p) => p.order === currentOrder) ?? null;
}

export function getNext(session: Session, state: LiveState): Program | null {
  const { currentOrder } = activeProgress(state);
  if (currentOrder === null) {
    return session.items[0] ?? null;
  }
  return session.items.find((p) => p.order === currentOrder + 1) ?? null;
}

export function getOnDeck(session: Session, state: LiveState): Program | null {
  const { currentOrder } = activeProgress(state);
  if (currentOrder === null) {
    return session.items[1] ?? null;
  }
  return session.items.find((p) => p.order === currentOrder + 2) ?? null;
}

export function audioSummary(a: AudioRequirement): string {
  if (a.mic && a.track) return "Mic + Track";
  if (a.mic) return "Mic";
  if (a.track) return "Track";
  return "None";
}

export function videoSummary(v: VideoRequirement): string {
  const parts: string[] = [];
  if (v.sidescreen === "live_feed") parts.push("Live Feed");
  else if (v.sidescreen === "slides") parts.push("Slides");
  if (v.backdrop) parts.push("Backdrop");
  if (v.pptSide) parts.push("PPT Side");
  return parts.length > 0 ? parts.join(" + ") : "None";
}

export function lightingSummary(l: LightingRequirement): string | null {
  if (l.hall && l.stage) return `Hall ${l.hall} · Stage ${l.stage}`;
  if (l.hall) return `Hall ${l.hall}`;
  if (l.stage) return `Stage ${l.stage}`;
  return null;
}
