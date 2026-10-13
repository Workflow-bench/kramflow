import { describe, expect, it } from "vitest";
import { importedSessionChoices, replacedSessions } from "./cue-sheet-import-result";
import type { ParsedSession } from "./parse-cuesheet";
import type { Session } from "./types";

const parsed = (id: string, day: string, label: string): ParsedSession => ({
  id,
  sheet_name: "Sheet",
  event_name: "Event",
  day_label: day,
  session_label: label,
  sort_order: 0,
});

const existing = (id: string, day: string, label: string): Session => ({
  id,
  sheetName: "Sheet",
  eventName: "Event",
  dayLabel: day,
  sessionLabel: label,
  items: [],
  partitions: [],
});

describe("replacedSessions", () => {
  it("matches an existing session by labels even when its stored id is event-scoped", () => {
    const hit = replacedSessions(
      [existing("sat-am~1a2b3c4d", "Sat", "AM")],
      [parsed("sat-am", "Sat", "AM")]
    );
    expect(hit.map((s) => s.id)).toEqual(["sat-am~1a2b3c4d"]);
  });

  it("ignores case and surrounding whitespace in labels", () => {
    expect(replacedSessions([existing("sat-am", "Sat", "AM")], [parsed("x", " sat ", "am ")])).toHaveLength(1);
  });

  it("reports nothing for a session the event does not have yet", () => {
    expect(replacedSessions([existing("fri-pm", "Fri", "PM")], [parsed("sat-am", "Sat", "AM")])).toEqual([]);
  });
});

describe("importedSessionChoices", () => {
  it("returns stored ids in file order with per-session item counts", () => {
    const choices = importedSessionChoices(
      { "sat-am": "sat-am~1a2b3c4d", "sat-pm": "sat-pm" },
      [parsed("sat-am", "Sat", "AM"), parsed("sat-pm", "Sat", "PM")],
      [{ session_id: "sat-am" }, { session_id: "sat-am" }, { session_id: "sat-pm" }]
    );
    expect(choices).toEqual([
      { storedId: "sat-am~1a2b3c4d", dayLabel: "Sat", sessionLabel: "AM", itemCount: 2 },
      { storedId: "sat-pm", dayLabel: "Sat", sessionLabel: "PM", itemCount: 1 },
    ]);
  });

  it("skips a parsed session the server did not report", () => {
    expect(importedSessionChoices({}, [parsed("sat-am", "Sat", "AM")], [])).toEqual([]);
  });
});
