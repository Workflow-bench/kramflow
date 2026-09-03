import { parseTimeLabel } from "@/lib/schedule";
import { driftMinutes, type LiveState, type Program, type Session } from "@/lib/types";

// ============================================================================
// THE TIMING MODEL — whole-rundown drift/pace projection + post-event report.
// 2026-09 NEXT-tier product refinement. Read this before touching any of the
// functions below; every one of them is a direct implementation of an
// equation documented here, not an independent judgment call.
//
// FOUR TERMS, kept deliberately distinct (never collapsed into one number):
//
//   PLANNED   — the schedule as designed, oblivious to anything that has
//               actually happened. Program.scheduledStart/scheduledEnd
//               (lib/schedule.ts's computeScheduledTimes: a partition-anchor
//               + cumulative-duration cascade, recomputed on every read) and
//               Program.durationMinutes. Exists whether or not the session
//               has ever gone live.
//
//   ACTUAL    — what really happened, recorded server-side as the show ran.
//               LiveState.itemActuals[programId].actualStart/actualEnd
//               (app/api/live/route.ts's withArrival/withDeparture). Only
//               exists for items that have gone live at least once — and
//               reflects only the MOST RECENT pass through an item
//               (withArrival overwrites actualStart on every re-arrival,
//               including a backward jump landing on an already-visited
//               item). This is a real, pre-existing limitation of the data
//               this model reads, not something introduced here — see the
//               module-level "KNOWN LIMITATIONS" note at the bottom.
//
//   EXPECTED  — a forward-looking, per-item extrapolation for an item that
//               HASN'T happened yet, computed as
//                 EXPECTED_START(item) = PLANNED_START(item) + CURRENT_DRIFT
//               i.e. "if the drift observed on the live item persists
//               unchanged, this is when we'd expect to reach this item."
//               Always phrased with "expected"/"~" — an extrapolation, not
//               a claim about the future.
//
//   PROJECTED — specifically PROJECTED_FINISH: a single extrapolated
//               session-finish clock time (see equation 3 below). Same
//               "extrapolation, not certainty" framing.
//
// EQUATIONS
//
// (1) CURRENT DRIFT — unchanged, reused exactly as-is (lib/types.ts's
//     driftMinutes, already shipped and already used by Console's DriftLine
//     and this pass's readiness/rundown work). ACTUAL_START(liveItem) −
//     PLANNED_START(liveItem), in minutes, wall-clock time-of-day. Positive
//     = behind, negative = ahead, null = unavailable (no schedule, or the
//     item never actually went live — e.g. rehearsal never writes actuals).
//     This module never recomputes drift a second way.
//
// (2) REMAINING PLANNED MINUTES — sum of durationMinutes for every item
//     with order > currentOrder that does not already have a recorded
//     actualEnd. Both conditions matter: order > currentOrder excludes
//     anything already passed over in the cue sequence — including a
//     deliberately SKIPPED item (jumped past, never actually run), which
//     must NOT count as "still coming up" just because it lacks actuals;
//     the actualEnd exclusion additionally excludes an item that sorts
//     after the live item only because of a BACKWARD JUMP (it was already
//     actually completed before the jump, and re-counting it would double-
//     count real time already spent). Together these are what let the
//     projection fail gracefully under a skip or a jump/replay without a
//     separate special case for either.
//
// (3) PROJECTED FINISH — now() + max(0, remainingSecondsInLiveItem)/60 +
//     REMAINING PLANNED MINUTES, converted to a clock time.
//     remainingSecondsInLiveItem is the *exact* formula lib/use-countdown.ts
//     already uses (frozen at pausedAt while on Hold, live otherwise) —
//     reimplemented here as a pure function so both the hook and this
//     module compute the identical number (see computeRemainingSeconds).
//     The max(0, ...) clamp matters: once the live item is already
//     overrunning, its "remaining time" is operator-controlled and
//     unknowable (Next could land any second) — assuming it contributes 0
//     *additional* minutes (not a negative one, which would wrongly credit
//     the future with time already spent) is the honest lower-bound
//     treatment, not a forecast. Notably this equation never needs
//     CURRENT DRIFT as an explicit term — it falls out implicitly, because
//     remainingSecondsInLiveItem is computed from the item's real elapsed
//     time (progress.startedAt), not its planned one. That means
//     PROJECTED FINISH is computable even when CURRENT DRIFT is null (no
//     scheduledStart set) — the two are independent, not the same
//     computation reused twice.
//
// (4) PLANNED FINISH (before Start) — when the session hasn't started yet,
//     there is no live item and therefore no drift to extrapolate. Rather
//     than fabricate a "projected" finish with nothing to base it on, this
//     is reported as the plain PLANNED finish (the last item's own
//     scheduledEnd, or, if that isn't computable, PLANNED_START(item 1) +
//     total planned duration) — a different, explicitly-labeled quantity
//     from PROJECTED FINISH, never collapsed into it.
//
// (5) BACKWARD JUMP / REPLAY — detected as currentOrder < the highest
//     order among items with a non-null actualStart. When true, CURRENT
//     DRIFT would be comparing "now" against an earlier item's planned
//     slot — a technically-real number that doesn't represent session pace
//     (it conflates "replaying an earlier cue" with "running behind").
//     Per this phase's explicit instruction not to fabricate a result in
//     an edge case the data can't honestly support, PROJECTED FINISH
//     returns unavailable ("replaying-earlier-item") in this state rather
//     than compounding a stale/misleading drift into a forward
//     projection. REMAINING PLANNED MINUTES (equation 2) already excludes
//     already-completed items regardless of order, so it stays correct
//     even mid-replay — only the *finish projection* is suppressed.
//
// HOLD/PAUSE — no special case needed. remainingSecondsInLiveItem freezes
// while paused (identical to the on-screen countdown), but now() keeps
// advancing — so PROJECTED FINISH correctly creeps later in real time for
// exactly as long as the hold lasts, and stops the moment it's resumed.
// This is not a separate "show delay" bucket layered on top of "item
// overrun": the product's own existing resume-shift semantics
// (app/api/live/route.ts's togglePause — resuming shifts progress.startedAt
// forward by the paused duration) already establish that hold time is
// excluded from an item's own overrun accounting; Hold is already a
// distinct, existing UI signal (components/ui/operational-status.tsx's
// "hold" badge) shown alongside these numbers, not encoded a second time
// inside them. Decomposing *historical* drift into "how much was overrun
// vs. how much was hold" is NOT attempted — the data only records whether
// the show is *currently* paused, not how many minutes of hold occurred
// during a now-finished item, so that split can't be honestly reconstructed
// after the fact. Documented as a known limitation, not fabricated.
//
// DRIFT SEVERITY — three tiers, not a bare boolean: <1 min "on schedule"
// (unchanged from the existing DriftLine), 1–5 min "mild" (same single-tier
// treatment DriftLine already had), ≥5 min "significant" (new). The 5-minute
// line is not invented for this — it's the product's own existing choice
// for "this needs attention" granularity, reused from
// lib/display-engine/types.ts's DEFAULT_TIMER_THRESHOLDS.yellowAt (5 * 60
// seconds), the threshold Presenter's own on-screen timer already escalates
// at. Same number, same meaning ("worth the operator's attention now"),
// applied to session-level drift instead of item-level remaining time.
//
// KNOWN LIMITATIONS (not fixed here — documented per this phase's own
// "if an edge case cannot be modeled correctly, do not fabricate a result"
// instruction):
//   - item_actuals reflects only the most recent pass through an item. An
//     item visited twice (backward jump, then re-reached forward) reports
//     only the second pass's timing in the post-event report — the first
//     pass's real duration is not recoverable from current data.
//   - The post-event report's item order reflects the CURRENT (possibly
//     since-reordered) cue-sheet order, not necessarily the order items
//     actually ran in, if the cue sheet was reordered mid-show.
// ============================================================================

export type DriftSeverity = "on-schedule" | "mild" | "significant";

/** Reused everywhere a drift/variance number needs a visual tier — see the
 *  module doc's "DRIFT SEVERITY" section for why 5 minutes specifically. */
export function driftSeverity(minutes: number): DriftSeverity {
  const abs = Math.abs(minutes);
  if (abs < 1) return "on-schedule";
  if (abs < 5) return "mild";
  return "significant";
}

/** The exact formula lib/use-countdown.ts's useCountdown() uses, extracted
 *  as a pure function so this module and that hook can never silently
 *  diverge. `now`/`pausedAt`/`startedAt` are all epoch milliseconds (or
 *  null) rather than the hook's ISO-string props, since this is called from
 *  plain computation code, not a component. */
export function computeRemainingSeconds(
  startedAtMs: number | null,
  durationMinutes: number,
  pausedAtMs: number | null,
  nowMs: number
): number {
  const totalSeconds = durationMinutes * 60;
  if (startedAtMs === null) return totalSeconds;
  const clockNow = pausedAtMs ?? nowMs;
  const elapsedSeconds = Math.max(0, Math.floor((clockNow - startedAtMs) / 1000));
  return totalSeconds - elapsedSeconds;
}

export type ProjectionUnavailableReason = "not-started" | "finished" | "replaying-earlier-item";

export interface RundownProjection {
  /** Equation 3/4 — an ISO timestamp when available, explicitly typed as
   *  "planned" (before Start) vs "projected" (live, drift-adjusted) so a
   *  caller can never accidentally present one as the other. */
  finish: { kind: "planned" | "projected"; at: string } | { kind: "unavailable"; reason: ProjectionUnavailableReason };
  /** Equation 2 — minutes of planned runtime not yet actually completed. */
  remainingPlannedMinutes: number;
  /** Equation 1, passed through unchanged — the single source every
   *  downstream "expected ~Xm late" annotation multiplies off. */
  currentDriftMinutes: number | null;
  /** True once currentOrder < the highest order with a recorded
   *  actualStart — equation 5. Exposed so callers can soften language
   *  ("Replaying an earlier item") without duplicating the detection. */
  isReplayingEarlierItem: boolean;
}

/** The one place whole-rundown projection is computed — Console and the
 *  post-event report both call this, never their own arithmetic. `now`
 *  is injected (not Date.now() internally) so this stays a pure,
 *  synchronously-testable function — see lib/timing.test.ts. */
export function computeRundownProjection(session: Session, state: LiveState, now: Date): RundownProjection {
  const progress = state.progressBySession[session.id];
  const currentOrder = progress?.currentOrder ?? null;
  const maxOrder = session.items.length;
  const isFinished = currentOrder !== null && currentOrder > maxOrder;

  if (isFinished) {
    return {
      finish: { kind: "unavailable", reason: "finished" },
      remainingPlannedMinutes: 0,
      currentDriftMinutes: null,
      isReplayingEarlierItem: false,
    };
  }

  if (currentOrder === null) {
    // Equation 4 — before Start, no live item, so no drift to extrapolate.
    // Report the plain planned finish instead.
    const plannedFinish = plannedFinishClock(session, now);
    return {
      finish: plannedFinish
        ? { kind: "planned", at: plannedFinish }
        : { kind: "unavailable", reason: "not-started" },
      remainingPlannedMinutes: session.items.reduce((sum, i) => sum + i.durationMinutes, 0),
      currentDriftMinutes: null,
      isReplayingEarlierItem: false,
    };
  }

  const liveItem = session.items.find((p) => p.order === currentOrder) ?? null;

  // Equation 5 — backward jump / replay detection.
  const highestActualOrder = session.items.reduce((max, item) => {
    const hasActual = !!state.itemActuals[item.id]?.actualStart;
    return hasActual && item.order > max ? item.order : max;
  }, 0);
  const isReplayingEarlierItem = currentOrder < highestActualOrder;

  const currentDriftMinutes = liveItem ? driftMinutes(liveItem, state) : null;

  // Equation 2 — excludes anything already passed over (order <=
  // currentOrder, whether skipped or actually run) and anything already
  // actually completed regardless of order (what stays correct through a
  // replay — see the module doc).
  const remainingPlannedMinutes = session.items.reduce((sum, item) => {
    if (item.order <= currentOrder) return sum;
    if (state.itemActuals[item.id]?.actualEnd) return sum;
    return sum + item.durationMinutes;
  }, 0);

  if (isReplayingEarlierItem) {
    return {
      finish: { kind: "unavailable", reason: "replaying-earlier-item" },
      remainingPlannedMinutes,
      currentDriftMinutes,
      isReplayingEarlierItem: true,
    };
  }

  // Equation 3.
  const startedAtMs = progress?.startedAt ? Date.parse(progress.startedAt) : null;
  const pausedAtMs = state.pausedAt ? Date.parse(state.pausedAt) : null;
  const remainingSecondsInLiveItem = liveItem
    ? computeRemainingSeconds(startedAtMs, liveItem.durationMinutes, pausedAtMs, now.getTime())
    : 0;
  const finishMs = now.getTime() + Math.max(0, remainingSecondsInLiveItem) * 1000 + remainingPlannedMinutes * 60_000;

  return {
    finish: { kind: "projected", at: new Date(finishMs).toISOString() },
    remainingPlannedMinutes,
    currentDriftMinutes,
    isReplayingEarlierItem: false,
  };
}

/** Equation 4's helper — the last item's own scheduledEnd if computable,
 *  else PLANNED_START(item 1) + total planned duration. Returns an ISO
 *  string anchored to `now`'s calendar day (scheduledStart/End are
 *  time-of-day labels with no date of their own — see lib/schedule.ts). */
function plannedFinishClock(session: Session, now: Date): string | null {
  if (session.items.length === 0) return null;
  const last = session.items[session.items.length - 1];
  const lastEndMinutes = parseTimeLabel(last.scheduledEnd);
  if (lastEndMinutes !== null) return minutesOfDayToIso(lastEndMinutes, now);

  const first = session.items[0];
  const firstStartMinutes = parseTimeLabel(first.scheduledStart);
  if (firstStartMinutes === null) return null;
  const totalPlanned = session.items.reduce((sum, i) => sum + i.durationMinutes, 0);
  return minutesOfDayToIso(firstStartMinutes + totalPlanned, now);
}

function minutesOfDayToIso(totalMinutes: number, now: Date): string {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  d.setMinutes(((totalMinutes % 1440) + 1440) % 1440);
  return d.toISOString();
}

export function formatClockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function formatMinutes(total: number): string {
  const sign = total < 0 ? "-" : "";
  const abs = Math.abs(total);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return h > 0 ? `${sign}${h}h ${m}m` : `${sign}${m}m`;
}

// ============================================================================
// POST-EVENT REPORT — reuses equations 1/2's inputs (item_actuals,
// durationMinutes) but is a point-in-time historical summary, not a live
// projection: no "now," no drift extrapolation, just what the recorded
// PLANNED and ACTUAL values actually were.
// ============================================================================

export interface ItemVariance {
  program: Program;
  plannedMinutes: number;
  /** null except for "none" — the only status with a completed pair. */
  actualMinutes: number | null;
  /** actualMinutes - plannedMinutes; null whenever actualMinutes is. */
  varianceMinutes: number | null;
  /** "none" — completed normally, has both actualStart and actualEnd.
   *  "in-progress" — the session's current live item; has actualStart, no
   *  actualEnd yet, because it hasn't finished — expected, not a gap.
   *  "not-reached" — order is still ahead of the live item; the session is
   *  mid-show and simply hasn't gotten there yet — the normal state of
   *  most of a rundown while it's running, not a notable exception.
   *  "skipped" — order is behind the live item (or the session has
   *  finished) with no actuals at all — genuinely bypassed.
   *  "interrupted" — has actualStart but no actualEnd, and isn't the
   *  current live item — something was left mid-way (e.g. Reset, or an
   *  unusual jump away without finishing). */
  exception: "none" | "in-progress" | "not-reached" | "skipped" | "interrupted";
}

export interface SessionTimingReport {
  /** Whether the session has actually finished (currentOrder past the last
   *  item) — governs whether "actual finish"/"finish variance" are
   *  meaningful yet, and whether a not-yet-reached item is even
   *  classifiable as a real exception. */
  isFinished: boolean;
  plannedDurationMinutes: number;
  /** Real elapsed span from the earliest actualStart to the latest
   *  actualEnd across all items — null if the session has no usable
   *  actuals at all (never run, or run only in Rehearsal, which never
   *  writes them), OR if the session hasn't finished yet (see isFinished
   *  — a partial elapsed-so-far number labeled as "actual duration" would
   *  overstate what's actually known this early). */
  actualDurationMinutes: number | null;
  actualStart: string | null;
  /** null unless isFinished — see actualDurationMinutes' reasoning. */
  actualFinish: string | null;
  /** driftMinutes-equivalent for the session's first item — how the show
   *  actually began relative to plan. Meaningful as soon as the session
   *  has started, independent of isFinished. */
  startVarianceMinutes: number | null;
  /** actualFinish - plannedFinish, in minutes — null if either side is
   *  unavailable, including whenever !isFinished. Distinct from
   *  startVarianceMinutes: a show can start late and still finish on time
   *  (or vice versa). */
  finishVarianceMinutes: number | null;
  items: ItemVariance[];
}

export function computeSessionTimingReport(session: Session, state: LiveState): SessionTimingReport {
  const currentOrder = state.progressBySession[session.id]?.currentOrder ?? null;
  const isFinished = currentOrder !== null && currentOrder > session.items.length;

  const items: ItemVariance[] = session.items.map((program) => {
    const actual = state.itemActuals[program.id];
    if (actual?.actualStart && actual.actualEnd) {
      const actualMinutes = Math.round((Date.parse(actual.actualEnd) - Date.parse(actual.actualStart)) / 60_000);
      return {
        program,
        plannedMinutes: program.durationMinutes,
        actualMinutes,
        varianceMinutes: actualMinutes - program.durationMinutes,
        exception: "none" as const,
      };
    }
    const base = { program, plannedMinutes: program.durationMinutes, actualMinutes: null, varianceMinutes: null };
    if (actual?.actualStart) {
      // Has a start but no end — the live item itself vs. a genuine gap.
      const isLive = !isFinished && currentOrder !== null && program.order === currentOrder;
      return { ...base, exception: isLive ? ("in-progress" as const) : ("interrupted" as const) };
    }
    // No actuals at all — ahead of the live item (hasn't happened yet) vs.
    // behind it / session finished (genuinely bypassed).
    const notReachedYet = !isFinished && currentOrder !== null && program.order > currentOrder;
    return { ...base, exception: notReachedYet ? ("not-reached" as const) : ("skipped" as const) };
  });

  const plannedDurationMinutes = session.items.reduce((sum, i) => sum + i.durationMinutes, 0);

  const starts = session.items
    .map((i) => state.itemActuals[i.id]?.actualStart)
    .filter((v): v is string => !!v)
    .map((v) => Date.parse(v));
  const ends = session.items
    .map((i) => state.itemActuals[i.id]?.actualEnd)
    .filter((v): v is string => !!v)
    .map((v) => Date.parse(v));

  const actualStartMs = starts.length ? Math.min(...starts) : null;
  const actualFinishMs = isFinished && ends.length ? Math.max(...ends) : null;
  const actualDurationMinutes =
    actualStartMs !== null && actualFinishMs !== null ? Math.round((actualFinishMs - actualStartMs) / 60_000) : null;

  const firstItem = session.items[0];
  const startVarianceMinutes = firstItem ? driftMinutes(firstItem, state) : null;

  const lastItem = session.items[session.items.length - 1];
  const plannedFinishMinutes = lastItem ? parseTimeLabel(lastItem.scheduledEnd) : null;
  let finishVarianceMinutes: number | null = null;
  if (plannedFinishMinutes !== null && actualFinishMs !== null) {
    const actualFinishDate = new Date(actualFinishMs);
    let diff = actualFinishDate.getHours() * 60 + actualFinishDate.getMinutes() - plannedFinishMinutes;
    if (diff > 720) diff -= 1440;
    if (diff < -720) diff += 1440;
    finishVarianceMinutes = diff;
  }

  return {
    isFinished,
    plannedDurationMinutes,
    actualDurationMinutes,
    actualStart: actualStartMs !== null ? new Date(actualStartMs).toISOString() : null,
    actualFinish: actualFinishMs !== null ? new Date(actualFinishMs).toISOString() : null,
    startVarianceMinutes,
    finishVarianceMinutes,
    items,
  };
}
