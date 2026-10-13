import { describe, expect, it } from "vitest";
import { cueFingerprint, runKey, runMatchesSession, trustRun, clearAllRuns, RUN_KEY_PREFIX, type StoredRun } from "./rehearsal-run";
import type { Program, Session, LiveState } from "./types";

const item = (order: number, title = `Cue ${order}`, duration = 5): Program =>
  ({ id: `p${order}`, order, title, durationMinutes: duration } as unknown as Program);
const session = (items: Program[], id = "sat-am"): Session =>
  ({ id, sheetName: "S", eventName: "E", dayLabel: "Sat", sessionLabel: "AM", items, partitions: [] } as Session);
const STATE: LiveState = { activeSessionId: "sat-am", progressBySession: {}, pausedAt: null, alert: null, notesOverrides: {}, controllerId: null, controllerClaimedAt: null, itemActuals: {} };
const run = (over: Partial<StoredRun> = {}): StoredRun => ({ userId: "user-a", eventId: "event-1", sessionId: "sat-am", fingerprint: cueFingerprint(session([item(1), item(2)])), state: STATE, interacted: true, ...over });

describe("rehearsal run keys and trust (per identity, event and session)", () => {
  it("keys differ by user and by event", () => {
    expect(runKey("user-a", "event-1")).not.toBe(runKey("user-b", "event-1"));
    expect(runKey("user-a", "event-1")).not.toBe(runKey("user-a", "event-2"));
    expect(runKey("user-a", "event-1").startsWith(RUN_KEY_PREFIX)).toBe(true);
  });

  it("trusts a run only for the same user and event", () => {
    expect(trustRun(run(), { userId: "user-a", eventId: "event-1" })).not.toBeNull();
    expect(trustRun(run(), { userId: "user-b", eventId: "event-1" })).toBeNull();
    expect(trustRun(run(), { userId: "user-a", eventId: "event-2" })).toBeNull();
    expect(trustRun({ state: STATE }, { userId: "user-a", eventId: "event-1" })).toBeNull();
    expect(trustRun("not an object", { userId: "user-a", eventId: "event-1" })).toBeNull();
  });
});

describe("cue fingerprint (invalidates a run when cue data changes)", () => {
  it("is stable for identical cues", () => {
    expect(cueFingerprint(session([item(1), item(2)]))).toBe(cueFingerprint(session([item(1), item(2)])));
  });

  it("changes on a title, duration, order, or count change", () => {
    const base = cueFingerprint(session([item(1), item(2)]));
    expect(cueFingerprint(session([item(1, "Renamed"), item(2)]))).not.toBe(base);
    expect(cueFingerprint(session([item(1), item(2, "Cue 2", 9)]))).not.toBe(base);
    expect(cueFingerprint(session([item(1), item(2), item(3)]))).not.toBe(base);
    expect(cueFingerprint(null)).toBeNull();
  });
});

describe("runMatchesSession", () => {
  it("matches only the same session with the same cue data", () => {
    const s = session([item(1), item(2)]);
    expect(runMatchesSession(run(), s)).toBe(true);
    expect(runMatchesSession(run(), session([item(1), item(2, "Changed")]))).toBe(false);
    expect(runMatchesSession(run(), session([item(1), item(2)], "sun-pm"))).toBe(false);
    expect(runMatchesSession(run(), null)).toBe(false);
  });
});

describe("clearAllRuns (sign-out and account change)", () => {
  it("removes every rehearsal run for every identity and leaves other keys alone", () => {
    const store = new Map<string, string>([
      [runKey("user-a", "event-1"), "{}"],
      [runKey("user-b", "event-2"), "{}"],
      ["unrelated", "keep"],
    ]);
    const fake = {
      get length() { return store.size; },
      key: (i: number) => Array.from(store.keys())[i] ?? null,
      removeItem: (k: string) => { store.delete(k); },
    };
    expect(clearAllRuns(fake)).toBe(2);
    expect(Array.from(store.keys())).toEqual(["unrelated"]);
  });
});
