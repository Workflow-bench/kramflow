import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { canStartRehearsal, isRehearsalComplete, canFinishRehearsal, shouldConfirmExit, completionSummary } from "./rehearsal";

describe("rehearsal boundaries", () => {
  it("zero cues: cannot start, never complete through Finish", () => {
    expect(canStartRehearsal({ max: 0 })).toBe(false);
    expect(canFinishRehearsal({ currentOrder: null, max: 0 })).toBe(false);
    expect(canFinishRehearsal({ currentOrder: 1, max: 0 })).toBe(false);
  });
  it("one cue: start is possible, Finish enabled at that single cue", () => {
    expect(canStartRehearsal({ max: 1 })).toBe(true);
    expect(canFinishRehearsal({ currentOrder: 1, max: 1 })).toBe(true);
    expect(isRehearsalComplete({ currentOrder: 1, max: 1 })).toBe(false);
  });
  it("many cues: Finish disabled before the final cue, enabled at it", () => {
    expect(canFinishRehearsal({ currentOrder: 4, max: 5 })).toBe(false);
    expect(canFinishRehearsal({ currentOrder: 5, max: 5 })).toBe(true);
  });
  it("completed state reached only past the final cue", () => {
    expect(isRehearsalComplete({ currentOrder: 6, max: 5 })).toBe(true);
    expect(isRehearsalComplete({ currentOrder: 5, max: 5 })).toBe(false);
    expect(isRehearsalComplete({ currentOrder: null, max: 5 })).toBe(false);
  });
});

describe("exit confirmation (progress = action taken, not elapsed time)", () => {
  it("no prompt before start", () => {
    expect(shouldConfirmExit({ currentOrder: null, max: 3, interacted: false })).toBe(false);
  });
  it("no prompt on cue 1 with no action, however long it has been running", () => {
    expect(shouldConfirmExit({ currentOrder: 1, max: 3, interacted: false })).toBe(false);
  });
  it("prompt on cue 1 once the operator paused, resumed or raised an alert", () => {
    expect(shouldConfirmExit({ currentOrder: 1, max: 3, interacted: true })).toBe(true);
  });
  it("prompt once past cue 1", () => {
    expect(shouldConfirmExit({ currentOrder: 2, max: 3, interacted: false })).toBe(true);
    expect(shouldConfirmExit({ currentOrder: 3, max: 3, interacted: false })).toBe(true);
  });
  it("no prompt after clean completion, even if interacted", () => {
    expect(shouldConfirmExit({ currentOrder: 4, max: 3, interacted: true })).toBe(false);
  });
  it("zero-cue session never prompts", () => {
    expect(shouldConfirmExit({ currentOrder: null, max: 0, interacted: false })).toBe(false);
  });
});

describe("completion summary", () => {
  it("reports only tracked cue counts", () => {
    expect(completionSummary({ sessionLabel: "Sat AM", max: 7 })).toEqual({ sessionLabel: "Sat AM", cuesCompleted: 7, cuesTotal: 7 });
  });
});

// KF-004: rehearsal must never reach the live path. Source-level check of the page,
// the same approach as the route metadata policy tests (the page itself needs an
// authenticated event session, which this environment does not have).
describe("rehearsal page isolation (KF-004)", () => {
  const raw = readFileSync(path.join(__dirname, "../components/rehearsal/rehearsal-view.tsx"), "utf8");
  // Comments may name the live endpoint to explain why it is absent; code must not use it.
  const page = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  // The completion summary block: from "Rehearsal complete" to the exit control.
  const completion = page.slice(page.indexOf("Rehearsal complete"), page.indexOf("Exit Rehearsal", page.indexOf("Rehearsal complete")));

  it("never calls /api/live or any mutating endpoint", () => {
    expect(page).not.toContain("/api/live");
    expect(page).not.toMatch(/method:\s*["'](PATCH|POST|PUT|DELETE)["']/);
    expect(page).not.toMatch(/\bfetch\(/);
  });

  it("shows only the tracked completion fields", () => {
    expect(completion.length).toBeGreaterThan(0);
    for (const untracked of ["hold", "alert", "overrun", "elapsed"]) {
      expect(completion.toLowerCase()).not.toContain(untracked);
    }
  });
});
