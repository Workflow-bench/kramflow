import { describe, expect, it } from "vitest";
import { deriveSessionLifecycle, isRunning } from "./session-lifecycle";

describe("deriveSessionLifecycle", () => {
  it("is not started with no progress", () => {
    expect(deriveSessionLifecycle({ currentOrder: null, itemCount: 5 })).toBe("not-started");
    expect(deriveSessionLifecycle({ currentOrder: undefined, itemCount: 0 })).toBe("not-started");
  });

  it("is live while a cue is current", () => {
    expect(deriveSessionLifecycle({ currentOrder: 1, itemCount: 5 })).toBe("live");
    expect(deriveSessionLifecycle({ currentOrder: 5, itemCount: 5 })).toBe("live");
  });

  it("is on hold when paused", () => {
    expect(deriveSessionLifecycle({ currentOrder: 2, itemCount: 5, pausedAt: "2026-10-22T10:00:00Z" })).toBe("on-hold");
  });

  it("is finished once past the last cue, even if paused", () => {
    expect(deriveSessionLifecycle({ currentOrder: 6, itemCount: 5 })).toBe("finished");
    expect(deriveSessionLifecycle({ currentOrder: 6, itemCount: 5, pausedAt: "2026-10-22T10:00:00Z" })).toBe("finished");
  });

  it("treats an empty session that was finished as finished, not live", () => {
    expect(deriveSessionLifecycle({ currentOrder: 1, itemCount: 0 })).toBe("finished");
  });

  it("isRunning covers live and on hold only", () => {
    expect(isRunning("live")).toBe(true);
    expect(isRunning("on-hold")).toBe(true);
    expect(isRunning("finished")).toBe(false);
    expect(isRunning("not-started")).toBe(false);
  });
});
