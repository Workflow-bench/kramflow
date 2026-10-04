// Pure rehearsal-boundary rules, shared by the rehearsal page and its tests.
// currentOrder is 1-based; max is the session's cue count; null = not started.
// currentOrder === max + 1 is the completed state (the page's finish() sets it).

export interface RehearsalPosition {
  currentOrder: number | null;
  max: number;
}

export function canStartRehearsal({ max }: { max: number }): boolean {
  return max > 0;
}

export function isRehearsalComplete({ currentOrder, max }: RehearsalPosition): boolean {
  return currentOrder !== null && currentOrder > max;
}

// The Finish control is enabled at the final cue and does nothing before it
// is reached; the completed state is only reachable through it.
export function canFinishRehearsal({ currentOrder, max }: RehearsalPosition): boolean {
  return currentOrder !== null && max > 0 && currentOrder === max;
}

// Exit confirmation only when there is progress that would be discarded: an
// active run past its first cue and not yet complete. No prompt before start
// or after a clean completion.
export function shouldConfirmExit({ currentOrder, max }: RehearsalPosition): boolean {
  return currentOrder !== null && currentOrder > 1 && currentOrder <= max;
}

// Summary metrics limited to what the rehearsal actually tracks: the cue
// count and the session's own cue list. No holds, alerts, overruns or total
// elapsed time are invented — none are recorded per rehearsal run.
export function completionSummary({ sessionLabel, max }: { sessionLabel: string; max: number }) {
  return { sessionLabel, cuesCompleted: max, cuesTotal: max };
}
