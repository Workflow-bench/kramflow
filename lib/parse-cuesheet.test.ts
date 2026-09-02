import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { parseCueSheet } from "./parse-cuesheet";

const HEADER_ROW = [
  "#",
  "Start Time",
  "End Time",
  "Duration (Min)",
  "Item",
  "Description",
  "Presenter",
  "Presenter Requirement",
  "Presenter Contact",
  "Mics (wireless/ stage/podium)",
  "Audio",
  "Sidescreens",
  "Backdrop",
  "Side",
  "Hall Lights",
  "Stage/Speaker Lights",
  "Camera Angle",
  "Props",
  "Curtains",
  "Notes",
];

function buildSheet(rows: unknown[][]) {
  return XLSX.utils.aoa_to_sheet(rows);
}

function buildWorkbook(sheets: { name: string; rows: unknown[][] }[]) {
  const wb = XLSX.utils.book_new();
  for (const { name, rows } of sheets) {
    XLSX.utils.book_append_sheet(wb, buildSheet(rows), name);
  }
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

function basicSheetRows(dataRows: unknown[][]) {
  return [
    ["Sample Conference\nDay 1 | Morning Session"],
    [],
    HEADER_ROW,
    ...dataRows,
  ];
}

describe("parseCueSheet", () => {
  it("parses a real item row into a ParsedProgram", () => {
    const buf = buildWorkbook([
      {
        name: "Sheet1",
        rows: basicSheetRows([
          [1, 0.375, 0.4166666666666667, 0.041666666666666664, "OP-1", "Opening Remarks", "Jane Doe", "", "", "Y", "N", "Y", "N", "", "", "", "", "", "", ""],
        ]),
      },
    ]);

    const result = parseCueSheet(buf);
    expect(result.sessions).toHaveLength(1);
    expect(result.sessions[0]).toMatchObject({ event_name: "Sample Conference", day_label: "Day 1", session_label: "Morning Session" });
    expect(result.programs).toHaveLength(1);
    expect(result.programs[0]).toMatchObject({
      type: "item",
      name: "Opening Remarks",
      presenter: "Jane Doe",
      audio_mics: true,
      audio_track: false,
      video_sidescreen: "slides",
      start_time: "9:00 AM",
      end_time: "10:00 AM",
    });
  });

  it("falls back to a prettified item code when there's no description", () => {
    const buf = buildWorkbook([
      {
        name: "Sheet1",
        rows: basicSheetRows([
          [1, "", "", "", "Emcee-1", "", "", "", "", "N", "N", "N", "N", "", "", "", "", "", "", ""],
        ]),
      },
    ]);
    const result = parseCueSheet(buf);
    expect(result.programs[0].name).toBe("Emcee 1");
  });

  it("classifies a break/meal label row as a break program, not a section", () => {
    const buf = buildWorkbook([
      {
        name: "Sheet1",
        rows: basicSheetRows([["Lunch Break [Main Hall]"]]),
      },
    ]);
    const result = parseCueSheet(buf);
    expect(result.programs).toHaveLength(1);
    expect(result.programs[0]).toMatchObject({ type: "break", name: "Lunch Break", remarks: "Main Hall" });
    expect(result.partitions).toHaveLength(0);
  });

  it("classifies a day/section label row as a partition, not a program", () => {
    const buf = buildWorkbook([
      {
        name: "Sheet1",
        rows: basicSheetRows([
          ["Day 1 Sessions"],
          [1, "", "", "", "OP-1", "Welcome", "", "", "", "N", "N", "N", "N", "", "", "", "", "", "", ""],
        ]),
      },
    ]);
    const result = parseCueSheet(buf);
    expect(result.partitions).toHaveLength(1);
    expect(result.partitions[0].label).toBe("Day 1 Sessions");
    expect(result.programs).toHaveLength(1);
    expect(result.programs[0].partition_id).toBe(result.partitions[0].id);
  });

  it("skips the footer totals row", () => {
    const buf = buildWorkbook([
      {
        name: "Sheet1",
        rows: basicSheetRows([
          [1, "", "", "", "OP-1", "Welcome", "", "", "", "N", "N", "N", "N", "", "", "", "", "", "", ""],
          ["Duration", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
        ]),
      },
    ]);
    const result = parseCueSheet(buf);
    expect(result.programs).toHaveLength(1);
  });

  it("rejects a workbook with more sheets than the sanity cap", () => {
    const sheets = Array.from({ length: 51 }, (_, i) => ({
      name: `Sheet${i}`,
      rows: basicSheetRows([]),
    }));
    const buf = buildWorkbook(sheets);
    expect(() => parseCueSheet(buf)).toThrow(/too many sheets/i);
  });

  it("rejects a sheet with more rows than the per-sheet cap", () => {
    const dataRows = Array.from({ length: 5001 }, (_, i) => [
      i + 1, "", "", "", `Item-${i}`, "", "", "", "", "N", "N", "N", "N", "", "", "", "", "", "", "",
    ]);
    const buf = buildWorkbook([{ name: "Huge", rows: basicSheetRows(dataRows) }]);
    expect(() => parseCueSheet(buf)).toThrow(/too many rows/i);
  });
});
