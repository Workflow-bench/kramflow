import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { parseCueSheet } from "./parse-cuesheet";

// Parser limits, tested on real workbooks written by SheetJS itself (no mocks).
// The header row matches the Excel template that parseSheet expects.
const HEADER = ["Day", "Session", "Start", "Item", "Duration", "Presenter"];

function workbook(sheets: Record<string, string[][]>): Buffer {
  const wb = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(sheets)) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), name);
  }
  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}

function rows(count: number): string[][] {
  const out: string[][] = [HEADER];
  for (let i = 0; i < count; i++) out.push(["Friday", "Evening", "18:00", `Item ${i}`, "5", "Alex"]);
  return out;
}

describe("cue-sheet parser limits (SheetJS sheetRows)", () => {
  it("rejects a sheet one row past the limit, naming the sheet", () => {
    expect(() => parseCueSheet(workbook({ Sheet1: rows(5000) }))).toThrow(/has too many rows/);
  });

  it("accepts the limit itself: the row cap is inclusive of the header", () => {
    // 4999 item rows plus the header is exactly 5000 rows, the cap.
    expect(() => parseCueSheet(workbook({ Sheet1: rows(4999) }))).not.toThrow();
  });

  it("rejects more sheets than the limit", () => {
    const sheets: Record<string, string[][]> = {};
    for (let i = 0; i < 51; i++) sheets[`S${i}`] = [HEADER];
    expect(() => parseCueSheet(workbook(sheets))).toThrow(/Too many sheets/);
  });
});
