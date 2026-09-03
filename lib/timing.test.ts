import { describe, it, expect } from "vitest";
import type { LiveState, Program, Session } from "@/lib/types";
import { computeRundownProjection, computeSessionTimingReport, driftSeverity, computeRemainingSeconds } from "./timing";

const BASE_PROGRAM: Omit<Program, "id" | "order" | "title" | "durationMinutes" | "scheduledStart" | "scheduledEnd"> = {
  type: "item",
  kicker: null,
  itemCode: null,
  presenter: null,
  presenterRequirement: null,
  presenterContact: null,
  sectionLabel: null,
  partitionId: null,
  timeIsComputed: false,
  audio: { mic: false, track: false },
  video: { sidescreen: "none", backdrop: false, pptSide: false },
  lights: { hall: null, stage: null },
  cameraAngle: null,
  props: null,
  curtains: null,
  stageNotes: null,
  team: null,
  notes: null,
  status: "confirmed",
  colorTag: null,
  auditoriumId: null,
};

function program(overrides: Partial<Program> & { id: string; order: number; title: string }): Program {
  return {
    ...BASE_PROGRAM,
    durationMinutes: 10,
    scheduledStart: null,
    scheduledEnd: null,
    ...overrides,
  };
}

function session(items: Program[]): Session {
  return { id: "s1", sheetName: "Sheet1", eventName: "Test Event", dayLabel: "Day 1", sessionLabel: "Session", items, partitions: [] };
}

const EMPTY_STATE: LiveState = {
  activeSessionId: "s1",
  progressBySession: {},
  pausedAt: null,
  alert: null,
  notesOverrides: {},
  controllerId: null,
  controllerClaimedAt: null,
  itemActuals: {},
};

function stateWith(overrides: Partial<LiveState>): LiveState {
  return { ...EMPTY_STATE, ...overrides };
}

// A fixed "now" for deterministic tests — 9:10 AM.
const NOW = new Date(2026, 0, 1, 9, 10, 0);
function at(hours: number, minutes: number): string {
  return new Date(2026, 0, 1, hours, minutes, 0).toISOString();
}

describe("computeRemainingSeconds", () => {
  it("returns the full duration before the item has started", () => {
    expect(computeRemainingSeconds(null, 10, null, NOW.getTime())).toBe(600);
  });
  it("counts down normally while running", () => {
    const started = new Date(2026, 0, 1, 9, 5, 0).getTime(); // 5 min ago
    expect(computeRemainingSeconds(started, 10, null, NOW.getTime())).toBe(300);
  });
  it("goes negative on overrun", () => {
    const started = new Date(2026, 0, 1, 8, 55, 0).getTime(); // 15 min ago
    expect(computeRemainingSeconds(started, 10, null, NOW.getTime())).toBe(-300);
  });
  it("freezes at the pause moment while paused", () => {
    const started = new Date(2026, 0, 1, 9, 0, 0).getTime(); // 10 min ago
    const paused = new Date(2026, 0, 1, 9, 5, 0).getTime(); // paused 5 min ago (5 min elapsed at pause)
    expect(computeRemainingSeconds(started, 10, paused, NOW.getTime())).toBe(300); // unaffected by real "now"
  });
});

describe("driftSeverity", () => {
  it("classifies on-schedule, mild, significant using the 1min/5min lines", () => {
    expect(driftSeverity(0)).toBe("on-schedule");
    expect(driftSeverity(0.5)).toBe("on-schedule");
    expect(driftSeverity(-0.9)).toBe("on-schedule");
    expect(driftSeverity(1)).toBe("mild");
    expect(driftSeverity(4.9)).toBe("mild");
    expect(driftSeverity(-4)).toBe("mild");
    expect(driftSeverity(5)).toBe("significant");
    expect(driftSeverity(-20)).toBe("significant");
  });
});

describe("computeRundownProjection", () => {
  it("ON PLAN — live item started exactly at its scheduled time", () => {
    const items = [
      program({ id: "a", order: 1, title: "A", durationMinutes: 10, scheduledStart: "9:00 AM", scheduledEnd: "9:10 AM" }),
      program({ id: "b", order: 2, title: "B", durationMinutes: 10, scheduledStart: "9:10 AM", scheduledEnd: "9:20 AM" }),
    ];
    const s = session(items);
    const state = stateWith({
      progressBySession: { s1: { currentOrder: 1, startedAt: at(9, 0) } },
      itemActuals: { a: { actualStart: at(9, 0), actualEnd: null } },
    });
    const result = computeRundownProjection(s, state, NOW); // now = 9:10, item A just finishing
    expect(result.currentDriftMinutes).toBe(0);
    expect(result.isReplayingEarlierItem).toBe(false);
    expect(result.finish.kind).toBe("projected");
  });

  it("AHEAD OF PLAN — live item started before its scheduled time", () => {
    const items = [program({ id: "a", order: 1, title: "A", durationMinutes: 10, scheduledStart: "9:15 AM" })];
    const s = session(items);
    const state = stateWith({
      progressBySession: { s1: { currentOrder: 1, startedAt: at(9, 0) } },
      itemActuals: { a: { actualStart: at(9, 0), actualEnd: null } },
    });
    const result = computeRundownProjection(s, state, NOW);
    expect(result.currentDriftMinutes).toBe(-15);
  });

  it("BEHIND PLAN — live item started after its scheduled time", () => {
    const items = [program({ id: "a", order: 1, title: "A", durationMinutes: 10, scheduledStart: "8:50 AM" })];
    const s = session(items);
    const state = stateWith({
      progressBySession: { s1: { currentOrder: 1, startedAt: at(9, 0) } },
      itemActuals: { a: { actualStart: at(9, 0), actualEnd: null } },
    });
    const result = computeRundownProjection(s, state, NOW);
    expect(result.currentDriftMinutes).toBe(10);
    expect(driftSeverity(result.currentDriftMinutes!)).toBe("significant"); // >= 5min line
  });

  it("CURRENT ITEM OVERRUN — projected finish clamps the live item's contribution to 0, not negative", () => {
    const items = [
      program({ id: "a", order: 1, title: "A", durationMinutes: 10 }),
      program({ id: "b", order: 2, title: "B", durationMinutes: 20 }),
    ];
    const s = session(items);
    // started 25 min ago (9:10 - 25 = 8:45), 10 min planned -> 15 min overrun
    const started = new Date(2026, 0, 1, 8, 45, 0).toISOString();
    const state = stateWith({
      progressBySession: { s1: { currentOrder: 1, startedAt: started } },
      itemActuals: { a: { actualStart: started, actualEnd: null } },
    });
    const result = computeRundownProjection(s, state, NOW);
    expect(result.remainingPlannedMinutes).toBe(20); // item b only
    expect(result.finish.kind).toBe("projected");
    if (result.finish.kind === "projected") {
      // now (9:10) + 0 (clamped overrun) + 20 planned = 9:30
      const finish = new Date(result.finish.at);
      expect(finish.getHours()).toBe(9);
      expect(finish.getMinutes()).toBe(30);
    }
  });

  it("CURRENT ITEM UNDERRUN — mid-item, well within its duration", () => {
    const items = [program({ id: "a", order: 1, title: "A", durationMinutes: 10 })];
    const s = session(items);
    const started = at(9, 5); // 5 min ago, 10 min planned -> 5 min remaining
    const state = stateWith({
      progressBySession: { s1: { currentOrder: 1, startedAt: started } },
      itemActuals: { a: { actualStart: started, actualEnd: null } },
    });
    const result = computeRundownProjection(s, state, NOW);
    expect(result.finish.kind).toBe("projected");
    if (result.finish.kind === "projected") {
      const finish = new Date(result.finish.at);
      expect(finish.getMinutes()).toBe(15); // 9:10 + 5 remaining
    }
  });

  it("MISSING DURATION — a 0-duration live item contributes nothing extra once live", () => {
    const items = [
      program({ id: "a", order: 1, title: "A", durationMinutes: 0 }),
      program({ id: "b", order: 2, title: "B", durationMinutes: 10 }),
    ];
    const s = session(items);
    const state = stateWith({
      progressBySession: { s1: { currentOrder: 1, startedAt: at(9, 0) } },
      itemActuals: { a: { actualStart: at(9, 0), actualEnd: null } },
    });
    const result = computeRundownProjection(s, state, NOW);
    expect(result.finish.kind).toBe("projected");
    if (result.finish.kind === "projected") {
      const finish = new Date(result.finish.at);
      expect(finish.getMinutes()).toBe(20); // 9:10 + 0 (clamped) + 10 planned
    }
  });

  it("MISSING ACTUAL START — no scheduledStart set at all, drift unavailable but projection still works", () => {
    const items = [program({ id: "a", order: 1, title: "A", durationMinutes: 10, scheduledStart: null })];
    const s = session(items);
    const state = stateWith({
      progressBySession: { s1: { currentOrder: 1, startedAt: at(9, 5) } },
      itemActuals: {}, // never recorded, e.g. rehearsal
    });
    const result = computeRundownProjection(s, state, NOW);
    expect(result.currentDriftMinutes).toBeNull();
    expect(result.finish.kind).toBe("projected"); // independent of drift
  });

  it("NO ACTUAL DATA — item_actuals entirely empty (rehearsal), projection uses progress.startedAt only", () => {
    const items = [program({ id: "a", order: 1, title: "A", durationMinutes: 10, scheduledStart: "9:00 AM" })];
    const s = session(items);
    const state = stateWith({
      progressBySession: { s1: { currentOrder: 1, startedAt: at(9, 0) } },
      itemActuals: {},
    });
    const result = computeRundownProjection(s, state, NOW);
    expect(result.currentDriftMinutes).toBeNull(); // no actualStart recorded
    expect(result.finish.kind).toBe("projected"); // still computable
  });

  it("COMPLETED SESSION — returns unavailable/finished", () => {
    const items = [program({ id: "a", order: 1, title: "A" })];
    const s = session(items);
    const state = stateWith({ progressBySession: { s1: { currentOrder: 2, startedAt: null } } });
    const result = computeRundownProjection(s, state, NOW);
    expect(result.finish).toEqual({ kind: "unavailable", reason: "finished" });
  });

  it("PARTIAL SESSION (not started) — returns the planned finish, not a projected one", () => {
    const items = [
      program({ id: "a", order: 1, title: "A", durationMinutes: 10, scheduledStart: "9:00 AM", scheduledEnd: "9:10 AM" }),
      program({ id: "b", order: 2, title: "B", durationMinutes: 10, scheduledStart: "9:10 AM", scheduledEnd: "9:20 AM" }),
    ];
    const s = session(items);
    const state = stateWith({ progressBySession: {} });
    const result = computeRundownProjection(s, state, NOW);
    expect(result.finish.kind).toBe("planned");
    if (result.finish.kind === "planned") {
      expect(new Date(result.finish.at).getMinutes()).toBe(20);
    }
    expect(result.currentDriftMinutes).toBeNull();
  });

  it("SKIPPED ITEM — jumping 1 -> 3 excludes the skipped item from remaining, and drift reflects the real gap", () => {
    const items = [
      program({ id: "a", order: 1, title: "A", durationMinutes: 10, scheduledStart: "9:00 AM" }),
      program({ id: "b", order: 2, title: "B", durationMinutes: 10, scheduledStart: "9:10 AM" }),
      program({ id: "c", order: 3, title: "C", durationMinutes: 10, scheduledStart: "9:20 AM" }),
    ];
    const s = session(items);
    // Started item 1 on time, then jumped straight to item 3 at 9:10 (skipping item 2 entirely).
    const state = stateWith({
      progressBySession: { s1: { currentOrder: 3, startedAt: at(9, 10) } },
      itemActuals: {
        a: { actualStart: at(9, 0), actualEnd: at(9, 10) },
        c: { actualStart: at(9, 10), actualEnd: null },
      },
    });
    const result = computeRundownProjection(s, state, NOW);
    // Item 3 is starting exactly on its planned slot (9:20 was planned assuming item 2 ran,
    // but real elapsed is only 10 min) — drift reflects the true gap, not a fabricated one.
    expect(result.currentDriftMinutes).toBe(-10); // 9:10 actual vs 9:20 planned = 10 min ahead
    expect(result.remainingPlannedMinutes).toBe(0); // item 2 was skipped, not "remaining" — nothing after item 3
  });

  it("REORDERED ITEM — item_actuals stays correctly keyed by id after reorder", () => {
    // b now sorts before a (reordered), but b's own actuals are unaffected by the reorder.
    const items = [
      program({ id: "b", order: 1, title: "B", durationMinutes: 10 }),
      program({ id: "a", order: 2, title: "A", durationMinutes: 10 }),
    ];
    const s = session(items);
    const state = stateWith({
      progressBySession: { s1: { currentOrder: 1, startedAt: at(9, 0) } },
      itemActuals: { b: { actualStart: at(9, 0), actualEnd: null } },
    });
    const result = computeRundownProjection(s, state, NOW);
    expect(result.remainingPlannedMinutes).toBe(10); // item a, correctly identified post-reorder
  });

  it("HOLD/PAUSE — projected finish keeps advancing with real time while paused, item remaining stays frozen", () => {
    const items = [
      program({ id: "a", order: 1, title: "A", durationMinutes: 10 }),
      program({ id: "b", order: 2, title: "B", durationMinutes: 10 }),
    ];
    const s = session(items);
    const started = at(9, 0); // 10 min elapsed at "now" (9:10) if not paused
    const pausedAt = at(9, 5); // paused after 5 min elapsed (5 min remaining, frozen)
    const state = stateWith({
      progressBySession: { s1: { currentOrder: 1, startedAt: started } },
      pausedAt,
      itemActuals: { a: { actualStart: started, actualEnd: null } },
    });
    const result = computeRundownProjection(s, state, NOW); // "now" is 9:10, 5 min into the hold
    expect(result.finish.kind).toBe("projected");
    if (result.finish.kind === "projected") {
      // now (9:10) + 5 min frozen-remaining + 10 planned for item b = 9:25
      expect(new Date(result.finish.at).getMinutes()).toBe(25);
    }
  });

  it("BACKWARD JUMP — projection is explicitly unavailable, not a misleading large-drift number", () => {
    const items = [
      program({ id: "a", order: 1, title: "A", durationMinutes: 10 }),
      program({ id: "b", order: 2, title: "B", durationMinutes: 10 }),
      program({ id: "c", order: 3, title: "C", durationMinutes: 10 }),
    ];
    const s = session(items);
    // Reached item 3 already (has actualStart), then jumped back to item 1.
    const state = stateWith({
      progressBySession: { s1: { currentOrder: 1, startedAt: at(9, 30) } },
      itemActuals: {
        a: { actualStart: at(9, 0), actualEnd: at(9, 10) },
        b: { actualStart: at(9, 10), actualEnd: at(9, 20) },
        c: { actualStart: at(9, 20), actualEnd: null },
        // re-landing on "a" overwrites its actualStart per withArrival's real behavior:
      },
    });
    // Simulate the overwrite withArrival performs on re-arrival.
    state.itemActuals.a = { actualStart: at(9, 30), actualEnd: null };
    const result = computeRundownProjection(s, state, NOW);
    expect(result.isReplayingEarlierItem).toBe(true);
    expect(result.finish).toEqual({ kind: "unavailable", reason: "replaying-earlier-item" });
  });
});

describe("computeSessionTimingReport", () => {
  it("computes planned vs actual for a fully-completed session", () => {
    const items = [
      program({ id: "a", order: 1, title: "A", durationMinutes: 10, scheduledStart: "9:00 AM", scheduledEnd: "9:10 AM" }),
      program({ id: "b", order: 2, title: "B", durationMinutes: 10, scheduledStart: "9:10 AM", scheduledEnd: "9:20 AM" }),
    ];
    const s = session(items);
    const state = stateWith({
      progressBySession: { s1: { currentOrder: 3, startedAt: at(9, 12) } }, // past the last item -> finished
      itemActuals: {
        a: { actualStart: at(9, 0), actualEnd: at(9, 12) }, // ran 12 min, 2 over
        b: { actualStart: at(9, 12), actualEnd: at(9, 19) }, // ran 7 min, 3 under
      },
    });
    const report = computeSessionTimingReport(s, state);
    expect(report.isFinished).toBe(true);
    expect(report.plannedDurationMinutes).toBe(20);
    expect(report.actualDurationMinutes).toBe(19);
    expect(report.items[0].varianceMinutes).toBe(2);
    expect(report.items[1].varianceMinutes).toBe(-3);
    expect(report.startVarianceMinutes).toBe(0);
  });

  it("distinguishes skipped / interrupted / not-reached / in-progress for a session still running", () => {
    const items = [
      program({ id: "a", order: 1, title: "A" }),
      program({ id: "b", order: 2, title: "B" }), // skipped — behind current, no actuals
      program({ id: "c", order: 3, title: "C" }), // interrupted — has a start, no end, not current
      program({ id: "d", order: 4, title: "D" }), // in-progress — the current live item
      program({ id: "e", order: 5, title: "E" }), // not-reached — ahead of current
    ];
    const s = session(items);
    const state = stateWith({
      progressBySession: { s1: { currentOrder: 4, startedAt: at(9, 30) } },
      itemActuals: {
        a: { actualStart: at(9, 0), actualEnd: at(9, 10) },
        c: { actualStart: at(9, 15), actualEnd: null },
        d: { actualStart: at(9, 30), actualEnd: null },
      },
    });
    const report = computeSessionTimingReport(s, state);
    expect(report.isFinished).toBe(false);
    expect(report.items[0].exception).toBe("none");
    expect(report.items[1].exception).toBe("skipped");
    expect(report.items[2].exception).toBe("interrupted");
    expect(report.items[3].exception).toBe("in-progress");
    expect(report.items[4].exception).toBe("not-reached");
    // Session hasn't finished — no fabricated "actual finish" yet.
    expect(report.actualFinish).toBeNull();
    expect(report.finishVarianceMinutes).toBeNull();
  });

  it("treats a never-reached item as skipped, not merely 'not-reached,' once the session has finished", () => {
    const items = [program({ id: "a", order: 1, title: "A" }), program({ id: "b", order: 2, title: "B" })];
    const s = session(items);
    const state = stateWith({
      progressBySession: { s1: { currentOrder: 3, startedAt: null } }, // past the last item -> finished
      itemActuals: { a: { actualStart: at(9, 0), actualEnd: at(9, 10) } },
    });
    const report = computeSessionTimingReport(s, state);
    expect(report.items[1].exception).toBe("skipped");
  });

  it("returns nulls, not fabricated zeros, when there are no actuals at all", () => {
    const items = [program({ id: "a", order: 1, title: "A" })];
    const s = session(items);
    const report = computeSessionTimingReport(s, EMPTY_STATE);
    expect(report.actualDurationMinutes).toBeNull();
    expect(report.actualStart).toBeNull();
    expect(report.startVarianceMinutes).toBeNull();
    // No progress recorded at all (not even started) -> not "skipped" in
    // the pointed sense, but there's no in-progress/not-reached comparison
    // possible either since currentOrder is null; falls out as skipped,
    // which a caller renders as "never run" — accurate for this state too.
    expect(report.items[0].exception).toBe("skipped");
  });
});

// Section 5 of the 2026-09 product-integrity pass — verifies the timing
// engine's behavior after app/api/live/route.ts's resetSession action,
// which removes only progress_by_session[sessionId] (simulated here by a
// state with no entry for the reset session) while deliberately leaving
// item_actuals untouched (real timing history, per migration
// 0007_pilot_readiness_v2.sql's own comment on that column).
describe("post-reset behavior (resetSession leaves item_actuals in place)", () => {
  function twoSessionFixture() {
    const sessionA = session([
      program({ id: "a1", order: 1, title: "A1", durationMinutes: 10, scheduledStart: "9:00 AM" }),
      program({ id: "a2", order: 2, title: "A2", durationMinutes: 10, scheduledStart: "9:10 AM" }),
    ]);
    sessionA.id = "sA";
    const sessionB = session([
      program({ id: "b1", order: 1, title: "B1", durationMinutes: 10, scheduledStart: "2:00 PM" }),
    ]);
    sessionB.id = "sB";
    return { sessionA, sessionB };
  }

  it("computeRundownProjection shows the planned finish (not projected) for a reset session, with no false backward-jump", () => {
    const { sessionA } = twoSessionFixture();
    // sA was fully run once (both items have real actuals) then reset —
    // progress_by_session has no entry for it at all.
    const state = stateWith({
      progressBySession: {}, // sA's entry removed by resetSession; sB untouched (has none either, never run)
      itemActuals: {
        a1: { actualStart: at(9, 0), actualEnd: at(9, 10) },
        a2: { actualStart: at(9, 10), actualEnd: at(9, 21) },
      },
    });
    const result = computeRundownProjection(sessionA, state, NOW);
    expect(result.finish.kind).toBe("planned");
    expect(result.isReplayingEarlierItem).toBe(false);
    expect(result.currentDriftMinutes).toBeNull();
  });

  it("computeSessionTimingReport still honestly reflects the prior run's actuals — isFinished is false, not fabricated true", () => {
    const { sessionA } = twoSessionFixture();
    const state = stateWith({
      progressBySession: {}, // reset
      itemActuals: {
        a1: { actualStart: at(9, 0), actualEnd: at(9, 10) },
        a2: { actualStart: at(9, 10), actualEnd: at(9, 21) },
      },
    });
    const report = computeSessionTimingReport(sessionA, state);
    // currentOrder is null post-reset -> not finished, even though every
    // item happens to have a completed actual pair from the prior run.
    expect(report.isFinished).toBe(false);
    // The historical record itself is untouched and still honest.
    expect(report.items[0].exception).toBe("none");
    expect(report.items[0].actualMinutes).toBe(10);
    expect(report.items[1].varianceMinutes).toBe(1);
    // No fabricated "session finish" while progress says not-started.
    expect(report.actualFinish).toBeNull();
    expect(report.finishVarianceMinutes).toBeNull();
  });

  it("resetting one session's progress leaves an unrelated session's report byte-for-byte unaffected", () => {
    const { sessionB } = twoSessionFixture();
    const beforeReset = stateWith({
      progressBySession: {
        sA: { currentOrder: 3, startedAt: at(9, 10) }, // sA finished (past its 2 items)
        sB: { currentOrder: 1, startedAt: at(14, 0) }, // sB mid-run
      },
      itemActuals: {
        a1: { actualStart: at(9, 0), actualEnd: at(9, 10) },
        a2: { actualStart: at(9, 10), actualEnd: at(9, 21) },
        b1: { actualStart: at(14, 0), actualEnd: null },
      },
    });
    const reportBBefore = computeSessionTimingReport(sessionB, beforeReset);

    // Simulate resetSession("sA") — removes only sA's progress entry,
    // sB's and all item_actuals untouched, exactly as the API route does.
    const afterReset = stateWith({
      ...beforeReset,
      progressBySession: { sB: beforeReset.progressBySession.sB },
    });
    const reportBAfter = computeSessionTimingReport(sessionB, afterReset);

    expect(reportBAfter).toEqual(reportBBefore);
  });
});
