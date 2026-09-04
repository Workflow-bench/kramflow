import type { LiveState, Program, Session, SessionProgress } from "@/lib/types";
import type { AutoProgramInput } from "./use-display-timer";
import type { StageStatus } from "@/components/display-engine/stage-status-pill";

// Was hand-copied verbatim (including its explanatory comment) into
// general/av/green-room/presenter's display clients — a signal it should
// be a shared derivation, not four independent copies that a fix has to
// reach identically each time.
export function deriveProgress(session: Session | null | undefined, appState: LiveState) {
  const progress = session ? appState.progressBySession[appState.activeSessionId] : undefined;
  const currentOrder = progress?.currentOrder ?? null;
  const total = session?.items.length ?? 0;
  const isFinished = currentOrder !== null && currentOrder > total;
  return { progress, currentOrder, total, isFinished };
}

// Was computed independently in AV/Green Room (identical) and Presenter
// (which alone also accounts for Hold, since Presenter is the one display
// a human can put on Hold locally) — General computed it not at all, so it
// never showed a status pill. Same "hand-copied, should be shared" shape as
// deriveProgress above; holdActive is optional so callers with no Hold
// concept of their own (none currently, but General didn't wire it before)
// don't need to pass a hard-coded `false`.
export function deriveStageStatus(live: Program | null, pausedAt: string | null, holdActive = false): StageStatus {
  if (holdActive) return "ON HOLD";
  if (pausedAt) return "PAUSED";
  if (live) return "LIVE";
  return "STANDBY";
}

export function deriveAutoTimerInput(
  live: Program | null,
  progress: SessionProgress | undefined,
  pausedAt: string | null
): AutoProgramInput | null {
  return live && live.type === "item"
    ? { durationMinutes: live.durationMinutes, startedAt: progress?.startedAt ?? null, pausedAt }
    : null;
}
