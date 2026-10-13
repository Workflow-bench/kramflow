import * as XLSX from "xlsx";

// Limits shared by every XLSX reader. Two layers:
//  1. preparse inspection of the package (lib/xlsx-archive.ts) reads the
//     absolute extent from the sheet XML and enforces decompression budgets
//     before SheetJS decodes anything;
//  2. a bounded SheetJS read (sheetRows) keeps decoding per sheet to the cap.
// Layer 2 cannot prove a sheet is within the cap on its own: a bounded read
// can drop populated cells below the cap and report no data. Layer 1 is the
// check that counts (B008-F1).
export const MAX_SHEETS = 50;
export const MAX_ROWS_PER_SHEET = 5000;

export const XLSX_READ_OPTIONS = { type: "buffer" as const, sheetRows: MAX_ROWS_PER_SHEET + 1 };

export function rowsLimitMessage(rows: number): string {
  return `Sheet has too many rows (${rows}). The limit is ${MAX_ROWS_PER_SHEET}.`;
}

// Full-extent row count of a sheet in a decoded workbook.
export function declaredRowCount(sheet: XLSX.WorkSheet): number {
  const ref = sheet["!fullref"] ?? sheet["!ref"];
  if (!ref) return 0;
  const range = XLSX.utils.decode_range(ref);
  return range.e.r - range.s.r + 1;
}

// First limit a decoded workbook breaks, or null. Used after the preparse check.
export function workbookLimitViolation(wb: XLSX.WorkBook): string | null {
  if (wb.SheetNames.length > MAX_SHEETS) {
    return `Too many sheets (${wb.SheetNames.length}). The limit is ${MAX_SHEETS}.`;
  }
  for (const name of wb.SheetNames) {
    const rows = declaredRowCount(wb.Sheets[name]);
    if (rows > MAX_ROWS_PER_SHEET) return rowsLimitMessage(rows);
  }
  return null;
}
