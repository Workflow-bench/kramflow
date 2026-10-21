import { describe, expect, it } from "vitest";
import { planOpenConsole } from "./cue-sheet-open";

const base = { chosenStoredId: "sat-am", liveId: "", lockedByOther: false, liveHasStarted: false, dayLabel: "Sat", sessionLabel: "AM" };

describe("planOpenConsole (KF-006 explicit session, no automatic live start)", () => {
  it("opens the console on the session that is already live, without selecting", () => {
    expect(planOpenConsole({ ...base, liveId: "sat-am" })).toEqual({ kind: "navigate" });
  });

  it("selects the chosen session only when nothing has started yet (explicit click)", () => {
    expect(planOpenConsole(base)).toEqual({ kind: "select-then-navigate" });
  });

  it("does not switch a running session: says so and opens unchanged", () => {
    const plan = planOpenConsole({ ...base, liveId: "sun-pm", liveHasStarted: true });
    expect(plan).toEqual({
      kind: "toast-then-navigate",
      message: "Sat • AM is not live. Switch sessions in the console.",
    });
  });

  it("refuses when another operator holds control, whether or not something started", () => {
    expect(planOpenConsole({ ...base, lockedByOther: true })).toEqual({ kind: "refuse-locked" });
    expect(planOpenConsole({ ...base, liveId: "sun-pm", liveHasStarted: true, lockedByOther: true })).toEqual({ kind: "refuse-locked" });
  });
});
