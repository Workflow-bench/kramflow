import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { parseCueSheet } from "./parse-cuesheet";
import { extractDocumentText } from "@/lib/server/document-text";
import { MAX_ROWS_PER_SHEET, XLSX_READ_OPTIONS, workbookLimitViolation } from "./xlsx-limits";

// Real workbooks written by SheetJS, read through the same options as the app.
// B007-F1: a bounded read keeps !ref at the decoded rows, so a sparse sheet
// with data past the cap must be rejected from !fullref, not accepted.

const HEADER = ["Day", "Session", "Start", "Item", "Duration", "Presenter"];

function xlsx(cells: Record<string, string | number>, sheetName = "Sheet1"): Buffer {
  const wb = XLSX.utils.book_new();
  const ws: XLSX.WorkSheet = {};
  let maxRow = 1;
  let maxCol = "A";
  for (const [addr, v] of Object.entries(cells)) {
    ws[addr] = typeof v === "number" ? { t: "n", v } : { t: "s", v };
    const m = addr.match(/^([A-Z]+)(\d+)$/)!;
    maxRow = Math.max(maxRow, Number(m[2]));
    if (m[1] > maxCol) maxCol = m[1];
  }
  ws["!ref"] = `A1:${maxCol}${maxRow}`;
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}

function denseRows(count: number): Record<string, string | number> {
  const cells: Record<string, string | number> = {};
  HEADER.forEach((h, c) => (cells[`${String.fromCharCode(65 + c)}1`] = h));
  for (let r = 2; r <= count + 1; r++) {
    cells[`A${r}`] = "Friday";
    cells[`B${r}`] = "Evening";
    cells[`C${r}`] = "18:00";
    cells[`D${r}`] = `Item ${r}`;
    cells[`E${r}`] = 5;
    cells[`F${r}`] = "Alex";
  }
  return cells;
}

describe("sparse oversized XLSX (B007-F1)", () => {
  // A1 plus a late row past the cap: the file a bounded read used to accept.
  const sparseLate = () => xlsx({ A1: "Day", A6000: "Late item" });

  it("bounded read exposes the full extent in !fullref, not in !ref", () => {
    const wb = XLSX.read(sparseLate(), XLSX_READ_OPTIONS);
    const ws = wb.Sheets.Sheet1;
    expect(ws["!ref"]).toBe("A1");
    expect(ws["!fullref"]).toBe("A1:A6000");
  });

  it("the shared checker rejects the sparse late-row sheet", () => {
    const wb = XLSX.read(sparseLate(), XLSX_READ_OPTIONS);
    expect(workbookLimitViolation(wb)).toMatch(/has too many rows \(6000\)/);
  });

  it("parseCueSheet rejects the sparse late-row sheet instead of dropping A6000", () => {
    expect(() => parseCueSheet(sparseLate())).toThrow(/has too many rows \(6000\)/);
  });

  it("a sparse sheet inside the cap is accepted and keeps its data", () => {
    const buf = xlsx({ ...denseRows(3), Z3: "far column" });
    expect(() => parseCueSheet(buf)).not.toThrow();
  });
});

describe("dense exact boundaries (real workbooks)", () => {
  it("accepts exactly the cap: header plus MAX-1 items", () => {
    expect(() => parseCueSheet(xlsx(denseRows(MAX_ROWS_PER_SHEET - 1)))).not.toThrow();
  });

  it("rejects one row past the cap", () => {
    expect(() => parseCueSheet(xlsx(denseRows(MAX_ROWS_PER_SHEET)))).toThrow(/has too many rows/);
  });
});

describe("document-text reader on the same files (B007-F1)", () => {
  it("rejects the sparse late-row sheet instead of extracting A1 alone", async () => {
    const file = new File([new Uint8Array(xlsx({ A1: "Day", A6000: "Late item" }))], "run.xlsx");
    await expect(extractDocumentText(file)).rejects.toThrow(/has too many rows \(6000\)/);
  });

  it("extracts a normal sheet", async () => {
    const file = new File([new Uint8Array(xlsx({ A1: "Day", B1: "Item", A2: "Friday", B2: "Doors" }))], "run.xlsx");
    expect(await extractDocumentText(file)).toContain("Doors");
  });
});
