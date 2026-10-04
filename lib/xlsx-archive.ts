import { unzipSync } from "fflate";

// Preparse inspection of an .xlsx package, run before SheetJS reads it.
//
// Why this exists: a bounded SheetJS read (sheetRows) can drop populated cells
// that sit below the cap, and then report no data at all (B008-F1). The
// decoded output cannot show what was dropped, so the check reads the file's
// own declared extent instead: each worksheet's <dimension ref> and the largest
// <row r> it contains. Budgets are enforced in fflate's filter callback, which
// sees each member's declared sizes before anything is inflated.

const MiB = 1024 * 1024;

export const XLSX_ARCHIVE_BUDGET = {
  maxEntries: 500,
  maxDeclaredBytes: 64 * MiB,
  maxMemberBytes: 16 * MiB,
  // Declared uncompressed/compressed ratio above this, for members over 1 MiB,
  // is treated as a decompression bomb and refused.
  maxRatio: 100,
  maxSheetFiles: 50,
} as const;

export class XlsxArchiveError extends Error {}

const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04];
const SHEET_PART = /^xl\/worksheets\/[^/]+\.xml$/;

export interface XlsxInspection {
  sheetParts: number;
  maxRow: number;
}

export function inspectXlsxArchive(bytes: Uint8Array): XlsxInspection {
  if (bytes.length < 4 || ZIP_MAGIC.some((b, i) => bytes[i] !== b)) {
    throw new XlsxArchiveError("This file is not a supported .xlsx workbook.");
  }

  let entries = 0;
  let declared = 0;
  const sheetNames: string[] = [];
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes, {
      filter(file) {
        entries += 1;
        declared += file.originalSize;
        if (entries > XLSX_ARCHIVE_BUDGET.maxEntries) throw new XlsxArchiveError("This workbook has too many parts.");
        if (declared > XLSX_ARCHIVE_BUDGET.maxDeclaredBytes) {
          throw new XlsxArchiveError("This workbook expands to more data than is allowed.");
        }
        if (file.originalSize > XLSX_ARCHIVE_BUDGET.maxMemberBytes) {
          throw new XlsxArchiveError("This workbook has a part that is too large.");
        }
        if (file.originalSize > MiB && file.size > 0 && file.originalSize / file.size > XLSX_ARCHIVE_BUDGET.maxRatio) {
          throw new XlsxArchiveError("This workbook is compressed more than is allowed.");
        }
        if (SHEET_PART.test(file.name)) {
          sheetNames.push(file.name);
          return true;
        }
        return false;
      },
    });
  } catch (err) {
    if (err instanceof XlsxArchiveError) throw err;
    // Malformed, truncated, or encrypted packages fail inside fflate. The
    // message stays generic so no parser detail reaches the caller.
    throw new XlsxArchiveError("This workbook could not be read. Check that it is a valid .xlsx file.");
  }

  if (sheetNames.length > XLSX_ARCHIVE_BUDGET.maxSheetFiles) {
    throw new XlsxArchiveError(`Too many sheets (${sheetNames.length}). The limit is ${XLSX_ARCHIVE_BUDGET.maxSheetFiles}.`);
  }

  let maxRow = 0;
  const decoder = new TextDecoder("utf-8");
  for (const name of sheetNames) {
    const xml = decoder.decode(files[name]);
    // <dimension ref="A1:F6000"/> — the declared bottom row.
    const dim = xml.match(/<dimension\b[^>]*\bref="([A-Z]+\d+)(?::([A-Z]+\d+))?"/);
    if (dim) {
      for (const ref of [dim[1], dim[2]]) {
        if (!ref) continue;
        maxRow = Math.max(maxRow, Number(ref.replace(/^[A-Z]+/, "")));
      }
    }
    // Populated rows, by absolute row number.
    for (const row of xml.matchAll(/<row\b[^>]*\br="(\d+)"/g)) {
      maxRow = Math.max(maxRow, Number(row[1]));
    }
  }

  return { sheetParts: sheetNames.length, maxRow };
}
