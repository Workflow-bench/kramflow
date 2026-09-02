import { describe, it, expect } from "vitest";
import { programRowSchema, programInputSchema, toProgramRow } from "./program";

function validProgramRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    sort_order: 1,
    session_id: "day1-morning",
    section_label: null,
    partition_id: null,
    type: "item",
    name: "Opening Remarks",
    description: null,
    presenter: null,
    presenter_requirement: null,
    presenter_contact: null,
    duration: 10,
    start_time: "9:00 AM",
    end_time: "9:10 AM",
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

describe("programRowSchema", () => {
  it("accepts a valid row shaped like the cue-sheet parser's output", () => {
    const result = programRowSchema.safeParse(validProgramRow());
    expect(result.success).toBe(true);
  });

  it("rejects a negative duration", () => {
    const result = programRowSchema.safeParse(validProgramRow({ duration: -5 }));
    expect(result.success).toBe(false);
  });

  it("rejects an empty name", () => {
    const result = programRowSchema.safeParse(validProgramRow({ name: "" }));
    expect(result.success).toBe(false);
  });

  it("rejects a name that's only whitespace (trimmed to empty)", () => {
    const result = programRowSchema.safeParse(validProgramRow({ name: "   " }));
    expect(result.success).toBe(false);
  });

  it("rejects an invalid type value", () => {
    const result = programRowSchema.safeParse(validProgramRow({ type: "banana" }));
    expect(result.success).toBe(false);
  });

  it("rejects an invalid video_sidescreen value", () => {
    const result = programRowSchema.safeParse(validProgramRow({ video_sidescreen: "hologram" }));
    expect(result.success).toBe(false);
  });

  it("rejects a non-uuid partition_id", () => {
    const result = programRowSchema.safeParse(validProgramRow({ partition_id: "not-a-uuid" }));
    expect(result.success).toBe(false);
  });

  it("accepts a null partition_id", () => {
    const result = programRowSchema.safeParse(validProgramRow({ partition_id: null }));
    expect(result.success).toBe(true);
  });

  it("rejects an unknown color_tag value", () => {
    const result = programRowSchema.safeParse(validProgramRow({ color_tag: "not-a-real-tag" }));
    expect(result.success).toBe(false);
  });
});

describe("programInputSchema defaults", () => {
  it("defaults type to 'item' and status to 'confirmed' when omitted", () => {
    const result = programInputSchema.safeParse({ sessionId: "s1", name: "Item" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.type).toBe("item");
      expect(result.data.status).toBe("confirmed");
      expect(result.data.duration).toBe(0);
    }
  });

  it("rejects a missing sessionId", () => {
    const result = programInputSchema.safeParse({ name: "Item" });
    expect(result.success).toBe(false);
  });

  it("rejects a missing name", () => {
    const result = programInputSchema.safeParse({ sessionId: "s1" });
    expect(result.success).toBe(false);
  });
});

describe("toProgramRow", () => {
  it("maps camelCase input keys to snake_case DB columns", () => {
    const row = toProgramRow({
      sessionId: "s1",
      sectionLabel: "Section A",
      presenterRequirement: "wireless mic",
      videoSidescreen: "slides",
      colorTag: "vip",
    });
    expect(row).toMatchObject({
      session_id: "s1",
      section_label: "Section A",
      presenter_requirement: "wireless mic",
      video_sidescreen: "slides",
      color_tag: "vip",
    });
  });

  it("only includes keys that were actually present on the input", () => {
    const row = toProgramRow({ name: "Only Name" });
    expect(Object.keys(row)).toEqual(["name"]);
  });

  it("passes through an explicit null (distinct from omitted)", () => {
    const row = toProgramRow({ sectionLabel: null });
    expect(row).toHaveProperty("section_label", null);
  });
});
