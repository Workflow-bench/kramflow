import { describe, expect, it } from "vitest";
import { computeScheduledTimes, formatMinutesToLabel, normalizeStartTime, parseTimeLabel } from "./schedule";
import type { Partition, Program } from "./types";

const section = (startTime: string | null): Partition => ({ id: "p1", label: "Main", startTime }) as Partition;
const item = (over: Partial<Program>): Program =>
  ({
    id: "i",
    durationMinutes: 10,
    timeIsComputed: true,
    scheduledStart: null,
    scheduledEnd: null,
    ...over,
  }) as Program;

describe("parseTimeLabel / formatMinutesToLabel", () => {
  it("round-trips a label", () => {
    expect(formatMinutesToLabel(parseTimeLabel("9:05 AM")!)).toBe("9:05 AM");
    expect(formatMinutesToLabel(parseTimeLabel("12:00 PM")!)).toBe("12:00 PM");
    expect(formatMinutesToLabel(parseTimeLabel("12:30 AM")!)).toBe("12:30 AM");
  });
  it("rejects anything that is not H:MM AM/PM", () => {
    for (const bad of ["", "9", "9am", "25:00", "banana", null]) expect(parseTimeLabel(bad as string | null)).toBeNull();
  });
});

describe("normalizeStartTime", () => {
  it("treats blank as no start time", () => {
    expect(normalizeStartTime("")).toEqual({ ok: true, label: null });
    expect(normalizeStartTime("   ")).toEqual({ ok: true, label: null });
  });
  it("normalises valid input to the canonical label", () => {
    expect(normalizeStartTime("09:00 am")).toEqual({ ok: true, label: "9:00 AM" });
    expect(normalizeStartTime(" 1:30 PM ")).toEqual({ ok: true, label: "1:30 PM" });
  });
  it("rejects input that is not a time", () => {
    expect(normalizeStartTime("banana")).toEqual({ ok: false });
    expect(normalizeStartTime("9am")).toEqual({ ok: false });
  });
});

describe("computeScheduledTimes", () => {
  it("cascades computed items off the section start", () => {
    const out = computeScheduledTimes(section("9:00 AM"), [
      item({ id: "a", durationMinutes: 10 }),
      item({ id: "b", durationMinutes: 30 }),
      item({ id: "c", durationMinutes: 15 }),
    ]);
    expect(out.map((i) => i.scheduledStart)).toEqual(["9:00 AM", "9:10 AM", "9:40 AM"]);
    expect(out.map((i) => i.scheduledEnd)).toEqual(["9:10 AM", "9:40 AM", "9:55 AM"]);
  });
  it("leaves items unscheduled when the section has no start time", () => {
    const out = computeScheduledTimes(section(null), [item({ id: "a" })]);
    expect(out[0].scheduledStart).toBeNull();
  });
  it("resyncs the clock to a pinned item so later items follow it", () => {
    const out = computeScheduledTimes(section("9:00 AM"), [
      item({ id: "a", durationMinutes: 10 }),
      item({ id: "pinned", timeIsComputed: false, scheduledStart: "10:00 AM", scheduledEnd: "10:20 AM" }),
      item({ id: "c", durationMinutes: 5 }),
    ]);
    expect(out[2].scheduledStart).toBe("10:20 AM");
  });
  it("shifts every later item when an earlier duration grows", () => {
    const before = computeScheduledTimes(section("9:00 AM"), [item({ id: "a", durationMinutes: 10 }), item({ id: "b" })]);
    const after = computeScheduledTimes(section("9:00 AM"), [item({ id: "a", durationMinutes: 11 }), item({ id: "b" })]);
    expect(before[1].scheduledStart).toBe("9:10 AM");
    expect(after[1].scheduledStart).toBe("9:11 AM");
  });
});
