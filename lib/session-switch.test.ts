import { describe, expect, it } from "vitest";
import { activeSessionHasStarted, classifySwitchFailure, switchFailureMessage, switchPreflight } from "./session-switch";

describe("activeSessionHasStarted", () => {
  it("is false when no session is active (the old check returned true here)", () => {
    expect(activeSessionHasStarted({ activeSessionId: "", progressBySession: {} })).toBe(false);
  });

  it("is false when the active session has no recorded progress", () => {
    expect(activeSessionHasStarted({ activeSessionId: "s1", progressBySession: {} })).toBe(false);
  });

  it("is false when the active session was reset", () => {
    expect(
      activeSessionHasStarted({ activeSessionId: "s1", progressBySession: { s1: { currentOrder: null, startedAt: null } } })
    ).toBe(false);
  });

  it("is true once the active session is running", () => {
    expect(
      activeSessionHasStarted({
        activeSessionId: "s1",
        progressBySession: { s1: { currentOrder: 2, startedAt: "2026-11-07T00:00:00Z" } },
      })
    ).toBe(true);
  });
});

describe("switchPreflight", () => {
  it("refuses non-owners before any request", () => {
    expect(switchPreflight({ isOwner: false, iHaveControl: false, lockedByOther: false }).kind).toBe("read-only");
  });

  it("asks an owner with no lease to take control first instead of sending a request the server will refuse", () => {
    expect(switchPreflight({ isOwner: true, iHaveControl: false, lockedByOther: false }).kind).toBe("needs-control");
  });

  it("names a held-by-other lease separately so the takeover path is offered", () => {
    expect(switchPreflight({ isOwner: true, iHaveControl: false, lockedByOther: true }).kind).toBe("held-by-other");
  });

  it("sends when this tab holds control", () => {
    expect(switchPreflight({ isOwner: true, iHaveControl: true, lockedByOther: false }).kind).toBe("ready");
  });
});

describe("classifySwitchFailure", () => {
  it.each([
    [423, "control-refused"],
    [403, "permission-refused"],
    [401, "permission-refused"],
    [404, "session-missing"],
    [400, "rejected"],
    [409, "rejected"],
    [500, "uncertain"],
    [502, "uncertain"],
    [null, "uncertain"],
  ])("maps %s to %s", (status, kind) => {
    expect(classifySwitchFailure(status).kind).toBe(kind);
  });

  it("tells the operator not to blindly retry an unconfirmed switch", () => {
    expect(switchFailureMessage({ kind: "uncertain" })).toMatch(/before trying again/);
  });
});
