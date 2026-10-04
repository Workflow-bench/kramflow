import { Unzip, UnzipInflate, UnzipPassThrough } from "fflate";
import { DOMParser } from "@xmldom/xmldom";

// Preparse inspection of an .xlsx package, run before SheetJS reads it.
//
// Two problems this addresses (B008-F1, XLSX-R1):
//  1. A bounded SheetJS read can drop populated cells below the row cap and
//     report no data. The decoded output cannot show what was dropped, so the
//     absolute extent is read from the package itself: each worksheet's
//     <dimension> and every <row r>/<c r>, parsed as XML with namespaces, so
//     quoting, prefixes and attribute order do not change the result.
//  2. Declared sizes in a zip are attacker-controlled. Every member is inflated
//     through fflate's streaming decoder and counted as actual bytes against
//     budgets, and a member whose inflated length differs from its declaration
//     is refused. Declared-size checks are a first filter, not the limit.

const MiB = 1024 * 1024;

export const XLSX_ARCHIVE_BUDGET = {
  maxEntries: 500,
  maxDeclaredBytes: 64 * MiB,
  maxActualBytes: 64 * MiB,
  maxMemberBytes: 16 * MiB,
  // Inflated/compressed ratio above this, for members over 1 MiB, is refused.
  maxRatio: 100,
  maxSheetParts: 50,
  maxRowNumber: 1048576,
} as const;

export class XlsxArchiveError extends Error {}

const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04];
const SHEET_PART = /^xl\/worksheets\/[^/]+\.xml$/;
const CELL_REF = /^([A-Z]{1,3})([1-9][0-9]*)$/;
const RANGE_REF = /^([A-Z]{1,3})([1-9][0-9]*)(?::([A-Z]{1,3})([1-9][0-9]*))?$/;

export interface XlsxInspection {
  sheetParts: number;
  maxRow: number;
  members: number;
  actualBytes: number;
}

const fail = (message: string) => new XlsxArchiveError(message);

function concat(chunks: Uint8Array[], length: number): Uint8Array {
  const out = new Uint8Array(length);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}

function parseRow(value: string | null): number {
  if (value === null || !/^[1-9][0-9]*$/.test(value)) throw fail("This workbook could not be inspected.");
  const row = Number(value);
  if (row > XLSX_ARCHIVE_BUDGET.maxRowNumber) throw fail("This workbook could not be inspected.");
  return row;
}

// Largest row a worksheet part declares or populates, read as namespace-aware XML.
function worksheetExtent(bytes: Uint8Array): number {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw fail("This workbook could not be inspected.");
  }
  // Any parse error or fatal error refuses the workbook. Warnings are not
  // refusals, because they do not change which elements exist.
  const parser = new DOMParser({
    onError(level: string) {
      if (level !== "warning") throw fail("This workbook could not be inspected.");
    },
  });
  const doc = parser.parseFromString(text, "text/xml");
  const root = doc.documentElement;
  if (!root || root.localName !== "worksheet") throw fail("This workbook could not be inspected.");

  let maxRow = 0;
  for (const dim of Array.from(doc.getElementsByTagNameNS("*", "dimension"))) {
    const ref = dim.getAttribute("ref");
    const m = ref === null ? null : RANGE_REF.exec(ref);
    if (!m) throw fail("This workbook could not be inspected.");
    maxRow = Math.max(maxRow, Number(m[2]), m[4] ? Number(m[4]) : 0);
  }
  for (const row of Array.from(doc.getElementsByTagNameNS("*", "row"))) {
    maxRow = Math.max(maxRow, parseRow(row.getAttribute("r")));
  }
  for (const cell of Array.from(doc.getElementsByTagNameNS("*", "c"))) {
    const ref = cell.getAttribute("r");
    if (ref === null) {
      // Position comes from the enclosing row when a cell omits its reference.
      const parent = cell.parentNode as Element | null;
      if (!parent || parent.localName !== "row") throw fail("This workbook could not be inspected.");
      maxRow = Math.max(maxRow, parseRow(parent.getAttribute("r")));
      continue;
    }
    const m = CELL_REF.exec(ref);
    if (!m) throw fail("This workbook could not be inspected.");
    maxRow = Math.max(maxRow, Number(m[2]));
  }
  return maxRow;
}

const EOCD_SIG = 0x06054b50;
const CENTRAL_SIG = 0x02014b50;

// Walks the central directory directly. fflate ignores the encryption flag and
// decodes what it can, so encryption is refused here from the header bit, and
// the entry count is cross-checked against the decoder's view. Zip64 archives
// are refused: they are not needed for a workbook and their sizes are not read.
function readCentralDirectory(bytes: Uint8Array): number {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const floor = Math.max(0, bytes.length - 22 - 0xffff);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= floor; i--) {
    if (view.getUint32(i, true) === EOCD_SIG) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw fail("This workbook could not be read. Check that it is a valid .xlsx file.");
  const count = view.getUint16(eocd + 10, true);
  const offset = view.getUint32(eocd + 16, true);
  if (count === 0xffff || offset === 0xffffffff) throw fail("This workbook uses a format that is not supported.");
  let at = offset;
  for (let n = 0; n < count; n++) {
    if (at + 46 > bytes.length || view.getUint32(at, true) !== CENTRAL_SIG) {
      throw fail("This workbook could not be read. Check that it is a valid .xlsx file.");
    }
    const flags = view.getUint16(at + 8, true);
    if (flags & 0x0001) throw fail("This workbook is password protected and cannot be read.");
    at += 46 + view.getUint16(at + 28, true) + view.getUint16(at + 30, true) + view.getUint16(at + 32, true);
  }
  return count;
}

export function inspectXlsxArchive(bytes: Uint8Array): XlsxInspection {
  const b = XLSX_ARCHIVE_BUDGET;
  if (bytes.length < 4 || ZIP_MAGIC.some((v, i) => bytes[i] !== v)) {
    throw fail("This file is not a supported .xlsx workbook.");
  }

  const directoryCount = readCentralDirectory(bytes);
  const parts = new Map<string, Uint8Array>();
  const seen = new Set<string>();
  let entries = 0;
  let declaredTotal = 0;
  let actualTotal = 0;

  const unzip = new Unzip();
  unzip.register(UnzipInflate);
  unzip.register(UnzipPassThrough);
  unzip.onfile = (file) => {
    entries += 1;
    if (entries > b.maxEntries) throw fail("This workbook has too many parts.");
    if (seen.has(file.name)) throw fail("This workbook has duplicate part names.");
    seen.add(file.name);
    if (file.compression !== 0 && file.compression !== 8) {
      throw fail("This workbook uses a compression method that is not supported.");
    }
    // Streaming file info types originalSize as optional. A missing declaration
    // is refused, not treated as zero.
    const declaredSize = file.originalSize;
    const compressedSize = file.size;
    if (declaredSize === undefined || compressedSize === undefined) {
      throw fail("This workbook could not be inspected.");
    }
    declaredTotal += declaredSize;
    if (declaredTotal > b.maxDeclaredBytes) throw fail("This workbook expands to more data than is allowed.");
    if (declaredSize > b.maxMemberBytes) throw fail("This workbook has a part that is too large.");
    if (declaredSize > MiB && compressedSize > 0 && declaredSize / compressedSize > b.maxRatio) {
      throw fail("This workbook is compressed more than is allowed.");
    }

    const chunks: Uint8Array[] = [];
    let actual = 0;
    file.ondata = (err, chunk, final) => {
      if (err) throw fail("This workbook could not be read.");
      actual += chunk.length;
      actualTotal += chunk.length;
      // Actual bytes are checked as they arrive, so a member that inflates past
      // its budget is stopped mid-stream, not after the whole member is decoded.
      if (actual > b.maxMemberBytes || actualTotal > b.maxActualBytes) {
        throw fail("This workbook expands to more data than is allowed.");
      }
      if (actual > MiB && compressedSize > 0 && actual / compressedSize > b.maxRatio) {
        throw fail("This workbook is compressed more than is allowed.");
      }
      chunks.push(chunk.slice());
      if (final) {
        // Declared and actual sizes must agree. A mismatch is a forged or damaged
        // declaration, and the content cannot be trusted.
        if (actual !== declaredSize) throw fail("This workbook's declared sizes do not match its content.");
        parts.set(file.name, concat(chunks, actual));
      }
    };
    file.start();
  };

  try {
    unzip.push(bytes, true);
  } catch (err) {
    if (err instanceof XlsxArchiveError) throw err;
    // Truncated, malformed, or encrypted packages fail inside fflate. The message
    // stays generic so no decoder detail reaches the caller.
    throw fail("This workbook could not be read. Check that it is a valid .xlsx file.");
  }

  if (entries !== directoryCount) throw fail("This workbook's directory does not match its parts.");

  let sheetParts = 0;
  let maxRow = 0;
  for (const [name, content] of parts) {
    if (!SHEET_PART.test(name)) continue;
    sheetParts += 1;
    if (sheetParts > b.maxSheetParts) {
      throw fail(`Too many sheets (${sheetParts}). The limit is ${b.maxSheetParts}.`);
    }
    maxRow = Math.max(maxRow, worksheetExtent(content));
  }

  return { sheetParts, maxRow, members: parts.size, actualBytes: actualTotal };
}
