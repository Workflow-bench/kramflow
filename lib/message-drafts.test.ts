import { describe, expect, it } from "vitest";
import { INITIAL_MESSAGE_DRAFTS, createGuardSet, patchAlert, patchBroadcast } from "./message-drafts";

describe("message drafts", () => {
  it("keeps Quick alert and Broadcast drafts independent", () => {
    let d = INITIAL_MESSAGE_DRAFTS;
    d = patchAlert({ message: "Drama team to stage left", severity: "critical" })(d);
    d = patchBroadcast({ title: "Doors open", message: "Hall B", type: "warning" })(d);
    expect(d.alert).toMatchObject({ message: "Drama team to stage left", severity: "critical" });
    expect(d.broadcast).toMatchObject({ title: "Doors open", message: "Hall B", type: "warning" });
    // Clearing one after a send leaves the other untouched.
    d = patchBroadcast({ title: "", message: "" })(d);
    expect(d.alert.message).toBe("Drama team to stage left");
  });

  it("never mutates the initial state shared by new events", () => {
    patchAlert({ message: "x" })(INITIAL_MESSAGE_DRAFTS);
    expect(INITIAL_MESSAGE_DRAFTS.alert.message).toBe("");
    expect(INITIAL_MESSAGE_DRAFTS.broadcast.title).toBe("");
    expect(INITIAL_MESSAGE_DRAFTS.emergencySending).toBe(false);
  });
});

describe("in-flight guards", () => {
  it("lets only the first of a click burst through until released", () => {
    const g = createGuardSet();
    const results = [g.claim("emergencySending"), g.claim("emergencySending"), g.claim("emergencySending")];
    expect(results).toEqual([true, false, false]);
    g.release("emergencySending");
    expect(g.claim("emergencySending")).toBe(true);
  });

  it("keeps each guard separate", () => {
    const g = createGuardSet();
    expect(g.claim("alertPosting")).toBe(true);
    expect(g.claim("broadcastSending")).toBe(true);
    expect(g.claim("alertDrafting")).toBe(true);
    expect(g.claim("alertPosting")).toBe(false);
  });

  it("starts fresh for a new store (a different event)", () => {
    const eventA = createGuardSet();
    eventA.claim("alertPosting");
    const eventB = createGuardSet();
    expect(eventB.claim("alertPosting")).toBe(true);
  });
});
