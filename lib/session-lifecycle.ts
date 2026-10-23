// One derivation of a session's show state, shared by Dashboard, Run and the
// session switcher (2026-10 review F03). Finish stores
// currentOrder = itemCount + 1, so "has progress" alone is not "live":
// a finished active session must read Finished everywhere, not Live.
export type SessionLifecycle = "not-started" | "live" | "on-hold" | "finished";

export function deriveSessionLifecycle({
  currentOrder,
  itemCount,
  pausedAt,
}: {
  currentOrder: number | null | undefined;
  itemCount: number;
  pausedAt?: string | null;
}): SessionLifecycle {
  if (currentOrder == null) return "not-started";
  if (currentOrder > itemCount) return "finished";
  return pausedAt ? "on-hold" : "live";
}

export function isRunning(lifecycle: SessionLifecycle): boolean {
  return lifecycle === "live" || lifecycle === "on-hold";
}

export const LIFECYCLE_LABEL: Record<SessionLifecycle, string> = {
  "not-started": "Not started",
  live: "Live",
  "on-hold": "On hold",
  finished: "Finished",
};
