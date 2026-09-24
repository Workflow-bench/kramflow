import { describe, expect, it } from "vitest";
import { alertDraftInputSchema, buildAlertPrompt, PRIORITY_VALUE } from "./alert-draft";
import { buildReportPrompt, reportInputSchema, type ReportInput } from "./session-report";
import { buildReviewPrompt, type ReviewItem } from "./readiness-review";
import { buildImportPrompt } from "./cue-sheet-import";

describe("alert draft input", () => {
  it("requires a real instruction and caps its length", () => {
    expect(alertDraftInputSchema.safeParse({ eventId: "e", instruction: "hi" }).success).toBe(false);
    expect(alertDraftInputSchema.safeParse({ eventId: "e", instruction: "x".repeat(1001) }).success).toBe(false);
    expect(alertDraftInputSchema.safeParse({ eventId: "e", instruction: "Running 10 min late" }).success).toBe(true);
  });

  it("puts the request and show context in separate tagged blocks", () => {
    const prompt = buildAlertPrompt({ eventId: "e", instruction: "Delay", context: { session: "Fri • AM", current: "Keynote", next: null } });
    expect(prompt).toContain("<request>\nDelay\n</request>");
    expect(prompt).toContain("Session: Fri • AM");
    expect(prompt).toContain("Now: Keynote");
    expect(prompt).not.toContain("Next:");
  });

  it("says so when there is no context", () => {
    expect(buildAlertPrompt({ eventId: "e", instruction: "Delay" })).toContain("<context>\nnone\n</context>");
  });

  it("maps priority words to the numeric levels broadcasts use", () => {
    expect(PRIORITY_VALUE).toEqual({ low: 1, normal: 2, high: 3 });
  });
});

function reportInput(items: ReportInput["sessions"][number]["items"]): ReportInput {
  return {
    eventId: "e",
    eventName: "Gala",
    sessions: [{ label: "Fri • AM", isFinished: true, plannedMinutes: 120, actualMinutes: 130, startVarianceMinutes: 2, finishVarianceMinutes: 12, items }],
  };
}

describe("report prompt", () => {
  const item = (name: string, variance: number | null, exception: "none" | "skipped" | "interrupted" = "none") => ({
    name,
    plannedMinutes: 10,
    actualMinutes: variance === null ? null : 10 + variance,
    varianceMinutes: variance,
    exception,
  });

  it("sends the largest variances, not every item, and skips on-time items", () => {
    const items = Array.from({ length: 30 }, (_, i) => item(`Item ${i}`, i === 0 ? 0 : i));
    const prompt = buildReportPrompt(reportInput(items));
    const timing = JSON.parse(prompt.split("<timing>")[1].split("</timing>")[0]);
    const variances = timing[0].largest_variances;
    expect(variances).toHaveLength(12);
    expect(variances[0].item).toBe("Item 29");
    expect(variances.some((v: { item: string }) => v.item === "Item 0")).toBe(false);
    expect(timing[0].item_count).toBe(30);
  });

  it("always lists skipped and interrupted items", () => {
    const prompt = buildReportPrompt(reportInput([item("Band", null, "skipped"), item("Skit", null, "interrupted"), item("Talk", 3)]));
    const timing = JSON.parse(prompt.split("<timing>")[1].split("</timing>")[0]);
    expect(timing[0].skipped_or_interrupted).toEqual([
      { item: "Band", status: "skipped" },
      { item: "Skit", status: "interrupted" },
    ]);
  });

  it("rejects an empty report or an invented exception value", () => {
    expect(reportInputSchema.safeParse({ ...reportInput([]), sessions: [] }).success).toBe(false);
    const bad = reportInput([{ ...item("X", 1), exception: "exploded" as "none" }]);
    expect(reportInputSchema.safeParse(bad).success).toBe(false);
  });
});

describe("readiness review prompt", () => {
  it("lists items as JSON lines inside the data tags", () => {
    const items: ReviewItem[] = [
      { order: 1, type: "item", name: "Welcome", section: null, presenter: "Alex", has_presenter_contact: true, duration: 5, start_time: null, end_time: null, audio_mics: true, audio_track: false, video_sidescreen: "none", video_ppt_needed: false, backdrop: false, remarks: null, presenter_requirement: null, status: "confirmed" },
    ];
    const prompt = buildReviewPrompt("Fri • AM", items);
    expect(prompt.startsWith("Session: Fri • AM\n<cue_sheet>\n")).toBe(true);
    expect(JSON.parse(prompt.split("<cue_sheet>\n")[1].split("\n</cue_sheet>")[0]).name).toBe("Welcome");
    expect(prompt).not.toContain('"presenter_contact"');
  });
});

describe("import prompt", () => {
  it("wraps the document in tags", () => {
    expect(buildImportPrompt("6pm doors")).toBe("<document>\n6pm doors\n</document>");
  });
});
