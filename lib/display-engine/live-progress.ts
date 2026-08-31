import type { LiveState, Program, Session, SessionProgress } from "@/lib/types";
import type { AutoProgramInput } from "./use-display-timer";

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

export function deriveAutoTimerInput(
  live: Program | null,
  progress: SessionProgress | undefined,
  pausedAt: string | null
): AutoProgramInput | null {
  return live && live.type === "item"
    ? { durationMinutes: live.durationMinutes, startedAt: progress?.startedAt ?? null, pausedAt }
    : null;
}
