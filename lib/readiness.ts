import type { Session } from "@/lib/types";
import { getDisplayStatus } from "@/lib/display-engine/use-register-display";
import type { DisplayInstance } from "@/lib/display-engine/types";

// C. PROFESSIONAL WORKFLOW GAP — "is this event ready to go live" had no
// single answer anywhere: the Dashboard's readiness data is a session/item
// count, not a validity check; the Cue Sheet flags a missing duration only
// per-row; Console's TargetHealthSummary answers "is the display fleet
// healthy" alone. This aggregates the three into one small, session-scoped
// check — computed entirely from data the caller already has (Session +
// the display registry), no new fetch, no new DB schema.
//
// Deliberately excludes collaborator access: an event with zero
// collaborators (solo owner running their own show) is completely normal,
// not unready — there's no meaningful pass/warn/fail signal there, unlike
// "the cue sheet is empty" or "an item has no duration."
export type ReadinessStatus = "pass" | "warn" | "fail";

export interface ReadinessCheck {
  id: string;
  status: ReadinessStatus;
  detail: string;
}

export function computeSessionReadiness(
  session: Session,
  registry: Record<string, DisplayInstance>
): ReadinessCheck[] {
  const checks: ReadinessCheck[] = [];

  if (session.items.length === 0) {
    checks.push({ id: "items", status: "fail", detail: "Cue sheet is empty, nothing to run" });
    return checks;
  }

  // Same predicate the Cue Sheet's own missingDurationCount uses
  // (app/e/[eventId]/operator/cue-sheet/page.tsx) — a break legitimately
  // has no duration, so it's excluded rather than flagged.
  const missingDuration = session.items.filter((item) => item.type !== "break" && item.durationMinutes === 0).length;
  if (missingDuration > 0) {
    checks.push({
      id: "durations",
      status: "warn",
      detail: `${missingDuration} item${missingDuration === 1 ? "" : "s"} missing a duration`,
    });
  }

  const displays = Object.values(registry);
  if (displays.length === 0) {
    // Not a fail — a console-only run with nothing projected externally is
    // a legitimate use, just worth surfacing rather than assuming.
    checks.push({ id: "displays", status: "warn", detail: "No displays registered yet" });
  } else {
    const now = Date.now();
    const online = displays.filter((d) => getDisplayStatus(d, now) === "online").length;
    if (online < displays.length) {
      checks.push({
        id: "displays",
        status: "warn",
        detail: `${online}/${displays.length} display${displays.length === 1 ? "" : "s"} online`,
      });
    }
  }

  return checks;
}
