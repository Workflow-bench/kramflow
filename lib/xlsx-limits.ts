import * as XLSX from "xlsx";

// Limits shared by every XLSX reader in the app. Decoding is bounded with
// `sheetRows`, which stops SheetJS at the row cap. A bounded read is not a
// complete one: SheetJS then reports the sheet's full extent in `!fullref`
// and leaves `!ref` at the rows it decoded. A check on `!ref` alone accepts a
// sheet with data past the cap (B007-F1), so the full extent is what counts.
export const MAX_SHEETS = 50;
export const MAX_ROWS_PER_SHEET = 5000;

// Options for every XLSX read: one row past the cap, so an oversized sheet is
// detected without decoding the whole sheet.
export const XLSX_READ_OPTIONS = { type: "buffer" as const, sheetRows: MAX_ROWS_PER_SHEET + 1 };

// Full-extent row count of a sheet, including rows a bounded read did not decode.
export function declaredRowCount(sheet: XLSX.WorkSheet): number {
  const ref = sheet["!fullref"] ?? sheet["!ref"];
  if (!ref) return 0;
  const range = XLSX.utils.decode_range(ref);
  return range.e.r - range.s.r + 1;
}

// Returns a message for the first limit a workbook breaks, or null.
export function workbookLimitViolation(wb: XLSX.WorkBook): string | null {
  if (wb.SheetNames.length > MAX_SHEETS) {
    return `Too many sheets (${wb.SheetNames.length}). The limit is ${MAX_SHEETS}.`;
  }
  for (const name of wb.SheetNames) {
    const rows = declaredRowCount(wb.Sheets[name]);
    if (rows > MAX_ROWS_PER_SHEET) {
      return `Sheet "${name}" has too many rows (${rows}). The limit is ${MAX_ROWS_PER_SHEET}.`;
    }
  }
  return null;
}
