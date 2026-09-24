import { describe, expect, it } from "vitest";
import { programRowSchema } from "@/lib/validation/program";
import { mapAiCueSheet, type AiCueSheet } from "./cue-sheet-import";

type AiItem = AiCueSheet["sessions"][number]["sections"][number]["items"][number];

function item(overrides: Partial<AiItem> = {}): AiItem {
  return {
    name: "Welcome",
    type: "item",
    presenter: null,
    description: null,
    duration_minutes: 10,
    start_time: null,
    end_time: null,
    presenter_requirement: null,
    presenter_contact: null,
    remarks: null,
    audio_mics: false,
    audio_track: false,
    video_sidescreen: "none",
    backdrop: false,
    video_ppt_needed: false,
    hall_lights: null,
    stage_lights: null,
    camera_angle: null,
    props: null,
    status: "confirmed",
    ...overrides,
  };
}

function sheet(items: AiItem[], extra: Partial<AiCueSheet["sessions"][number]> = {}): AiCueSheet {
  return { sessions: [{ day_label: "Friday", session_label: "Evening", sections: [{ label: "Opening", start_time: "6:00 PM", items }], ...extra }] };
}

describe("mapAiCueSheet", () => {
  it("builds session, section and programs shaped like the Excel parser's output", () => {
    const out = mapAiCueSheet(sheet([item({ name: "Welcome" }), item({ name: "Keynote", duration_minutes: 30 })]));

    expect(out.sessions).toHaveLength(1);
    expect(out.sessions[0]).toMatchObject({ id: "friday-evening", day_label: "Friday", session_label: "Evening", sort_order: 0 });
    expect(out.partitions).toHaveLength(1);
    expect(out.partitions[0]).toMatchObject({ session_id: "friday-evening", label: "Opening", sort_order: 1, start_time: "6:00 PM" });
    expect(out.programs.map((p) => [p.name, p.sort_order])).toEqual([["Welcome", 1], ["Keynote", 2]]);
    expect(out.programs.every((p) => p.partition_id === out.partitions[0].id && p.session_id === "friday-evening")).toBe(true);
  });

  it("produces rows the commit path's row schema accepts", () => {
    const out = mapAiCueSheet(sheet([item({ presenter: "Alex", start_time: "6:00 PM", end_time: "6:10 PM" }), item({ name: "Lunch", type: "break", duration_minutes: null })]));
    for (const row of out.programs) expect(programRowSchema.safeParse(row).success).toBe(true);
  });

  it("numbers items continuously across sections within a session", () => {
    const ai = sheet([item({ name: "A" })]);
    ai.sessions[0].sections.push({ label: "Second", start_time: null, items: [item({ name: "B" })] });
    const out = mapAiCueSheet(ai);
    expect(out.programs.map((p) => p.sort_order)).toEqual([1, 2]);
    expect(out.partitions.map((p) => p.sort_order)).toEqual([1, 2]);
  });

  it("restarts positions for each session", () => {
    const ai: AiCueSheet = {
      sessions: [
        { day_label: "Fri", session_label: "AM", sections: [{ label: null, start_time: null, items: [item(), item()] }] },
        { day_label: "Fri", session_label: "PM", sections: [{ label: null, start_time: null, items: [item()] }] },
      ],
    };
    const out = mapAiCueSheet(ai);
    expect(out.programs.map((p) => [p.session_id, p.sort_order])).toEqual([["fri-am", 1], ["fri-am", 2], ["fri-pm", 1]]);
    expect(out.partitions).toHaveLength(0);
    expect(out.programs.every((p) => p.partition_id === null && p.section_label === null)).toBe(true);
  });

  it("derives duration from start and end when the model gave none", () => {
    const out = mapAiCueSheet(sheet([item({ duration_minutes: null, start_time: "9:30 AM", end_time: "10:15 AM" })]));
    expect(out.programs[0].duration).toBe(45);
  });

  it("wraps a start/end pair that crosses midnight", () => {
    const out = mapAiCueSheet(sheet([item({ duration_minutes: null, start_time: "11:30 PM", end_time: "12:15 AM" })]));
    expect(out.programs[0].duration).toBe(45);
  });

  it("warns about a missing duration on an item but not on a break", () => {
    const out = mapAiCueSheet(sheet([item({ name: "Talk", duration_minutes: null }), item({ name: "Lunch", type: "break", duration_minutes: null })]));
    expect(out.warnings.filter((w) => w.message.includes("no duration")).map((w) => w.item)).toEqual([1]);
    expect(out.programs.map((p) => p.duration)).toEqual([0, 0]);
  });

  it("drops an unparseable time with a warning instead of passing it through", () => {
    const out = mapAiCueSheet(sheet([item({ start_time: "around nine" })]));
    expect(out.programs[0].start_time).toBeNull();
    expect(out.warnings.some((w) => w.item === 1 && w.message.includes("around nine"))).toBe(true);
  });

  it("treats a negative or fractional duration sensibly", () => {
    const out = mapAiCueSheet(sheet([item({ duration_minutes: -5 }), item({ duration_minutes: 7.6 })]));
    expect(out.programs.map((p) => p.duration)).toEqual([0, 8]);
  });

  it("disambiguates two sessions with the same label", () => {
    const one = sheet([item()]).sessions[0];
    const out = mapAiCueSheet({ sessions: [one, one] });
    expect(out.sessions.map((s) => s.id)).toEqual(["friday-evening", "friday-evening-2"]);
    expect(out.warnings.length).toBeGreaterThan(0);
  });

  it("trims whitespace and turns blank text into null", () => {
    const out = mapAiCueSheet(sheet([item({ name: "  Welcome  ", presenter: "   ", remarks: "" })]));
    expect(out.programs[0]).toMatchObject({ name: "Welcome", presenter: null, remarks: null });
  });

  it("flags an empty session", () => {
    const out = mapAiCueSheet({ sessions: [{ day_label: "Sat", session_label: "AM", sections: [] }] });
    expect(out.programs).toHaveLength(0);
    expect(out.warnings[0].message).toContain("no items");
  });
});
