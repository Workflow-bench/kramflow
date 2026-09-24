import { describe, expect, it } from "vitest";
import type { ParsedCueSheet, ParsedProgram } from "@/lib/parse-cuesheet";
import { checkCueSheetIntegrity, MAX_PROGRAMS, parsedCueSheetSchema } from "./cue-sheet-commit";

const PARTITION_ID = "3f1c2b8e-8f6e-4b1e-9d55-0d3a1c2b4e5f";

function program(overrides: Partial<ParsedProgram> = {}): ParsedProgram {
  return {
    sort_order: 1,
    session_id: "fri-am",
    section_label: null,
    partition_id: null,
    type: "item",
    name: "Welcome",
    description: null,
    presenter: null,
    presenter_requirement: null,
    presenter_contact: null,
    duration: 5,
    start_time: null,
    end_time: null,
    audio_mics: false,
    audio_track: false,
    video_sidescreen: "none",
    backdrop: false,
    video_ppt_needed: false,
    hall_lights: null,
    stage_lights: null,
    camera_angle: null,
    props: null,
    curtains: null,
    remarks: null,
    status: "confirmed",
    color_tag: null,
    ...overrides,
  };
}

function sheet(overrides: Partial<ParsedCueSheet> = {}): ParsedCueSheet {
  return {
    sessions: [{ id: "fri-am", sheet_name: "Fri AM", event_name: "", day_label: "Fri", session_label: "AM", sort_order: 0 }],
    partitions: [{ id: PARTITION_ID, session_id: "fri-am", label: "Opening", sort_order: 1, start_time: null }],
    programs: [program({ partition_id: PARTITION_ID })],
    ...overrides,
  };
}

describe("checkCueSheetIntegrity", () => {
  it("accepts a consistent sheet", () => {
    expect(checkCueSheetIntegrity(sheet())).toBeNull();
  });

  it("rejects an item pointing at a session that isn't in the payload", () => {
    expect(checkCueSheetIntegrity(sheet({ programs: [program({ session_id: "other" })] }))).toMatch(/unknown session/);
  });

  it("rejects a section pointing at an unknown session", () => {
    const s = sheet();
    s.partitions[0].session_id = "other";
    expect(checkCueSheetIntegrity(s)).toMatch(/unknown session/);
  });

  it("rejects an item using a section from another session", () => {
    const s = sheet({
      sessions: [
        { id: "fri-am", sheet_name: "", event_name: "", day_label: "Fri", session_label: "AM", sort_order: 0 },
        { id: "fri-pm", sheet_name: "", event_name: "", day_label: "Fri", session_label: "PM", sort_order: 1 },
      ],
      programs: [program({ session_id: "fri-pm", partition_id: PARTITION_ID })],
    });
    expect(checkCueSheetIntegrity(s)).toMatch(/different session/);
  });

  it("rejects an item pointing at a section that doesn't exist", () => {
    const s = sheet({ programs: [program({ partition_id: "8c0b7c0e-1d5b-4f0f-8a53-2f2f6a0a9d11" })] });
    expect(checkCueSheetIntegrity(s)).toMatch(/different session/);
  });

  it("rejects two items with the same position in a session", () => {
    expect(checkCueSheetIntegrity(sheet({ programs: [program(), program({ name: "Again" })] }))).toMatch(/same position/);
  });

  it("rejects duplicate session ids", () => {
    const s = sheet();
    s.sessions.push({ ...s.sessions[0] });
    expect(checkCueSheetIntegrity(s)).toMatch(/Duplicate session/);
  });
});

describe("parsedCueSheetSchema", () => {
  it("accepts a well-formed payload", () => {
    expect(parsedCueSheetSchema.safeParse(sheet()).success).toBe(true);
  });

  it("rejects a program that fails the row rules", () => {
    expect(parsedCueSheetSchema.safeParse(sheet({ programs: [program({ name: "" })] })).success).toBe(false);
    expect(parsedCueSheetSchema.safeParse(sheet({ programs: [program({ duration: -1 })] })).success).toBe(false);
  });

  it("rejects a section id that isn't a UUID", () => {
    const s = sheet();
    s.partitions[0].id = "not-a-uuid";
    expect(parsedCueSheetSchema.safeParse(s).success).toBe(false);
  });

  it("rejects more items than the ceiling", () => {
    const programs = Array.from({ length: MAX_PROGRAMS + 1 }, (_, i) => program({ sort_order: i + 1 }));
    expect(parsedCueSheetSchema.safeParse(sheet({ programs })).success).toBe(false);
  });

  it("drops fields that aren't part of the row", () => {
    const parsed = parsedCueSheetSchema.parse({ ...sheet(), programs: [{ ...program(), event_id: "someone-elses" }] });
    expect("event_id" in parsed.programs[0]).toBe(false);
  });
});
