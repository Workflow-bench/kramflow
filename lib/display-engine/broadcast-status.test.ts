import { describe, expect, it } from "vitest";
import { describeTarget, effectiveExpiry, isUnexpired } from "./broadcast-status";
import type { DisplayGroup, DisplayInstance } from "./types";

const created = "2026-10-22T10:00:00.000Z";
const t0 = Date.parse(created);

describe("broadcast expiry", () => {
  it("never expires without duration or expiresAt", () => {
    expect(effectiveExpiry({ durationSeconds: null, expiresAt: null, createdAt: created })).toBeNull();
    expect(isUnexpired({ durationSeconds: null, expiresAt: null, createdAt: created }, t0 + 1e9)).toBe(true);
  });
  it("uses duration from creation first", () => {
    const m = { durationSeconds: 60, expiresAt: "2026-10-22T12:00:00.000Z", createdAt: created };
    expect(isUnexpired(m, t0 + 59_000)).toBe(true);
    expect(isUnexpired(m, t0 + 61_000)).toBe(false);
  });
  it("falls back to expiresAt", () => {
    const m = { durationSeconds: null, expiresAt: "2026-10-22T10:05:00.000Z", createdAt: created };
    expect(isUnexpired(m, t0 + 4 * 60_000)).toBe(true);
    expect(isUnexpired(m, t0 + 6 * 60_000)).toBe(false);
  });
});

describe("describeTarget", () => {
  const registry = { d1: { id: "d1", name: "Lobby TV" } } as unknown as Record<string, DisplayInstance>;
  const groups: Record<string, DisplayGroup> = { g1: { id: "g1", name: "Backstage", displayIds: ["d1"] } };
  it("names each target kind", () => {
    expect(describeTarget({ kind: "all" }, registry, groups)).toBe("all displays");
    expect(describeTarget({ kind: "type", value: "green-room" }, registry, groups)).toBe("Green Room displays");
    expect(describeTarget({ kind: "group", value: "g1" }, registry, groups)).toBe("the “Backstage” group");
    expect(describeTarget({ kind: "display", value: "d1" }, registry, groups)).toBe("“Lobby TV”");
  });
  it("stays honest when the referenced group or display is gone", () => {
    expect(describeTarget({ kind: "group", value: "nope" }, registry, groups)).toBe("a display group");
    expect(describeTarget({ kind: "display", value: "nope" }, registry, groups)).toBe("one display");
  });
});
