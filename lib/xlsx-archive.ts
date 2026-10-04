import { Unzip, UnzipInflate, UnzipPassThrough } from "fflate";
import { DOMParser, type Element } from "@xmldom/xmldom";

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
const CELL_REF = /^([A-Z]{1,3})([1-9][0-9]*)$/;
const RANGE_REF = /^([A-Z]{1,3})([1-9][0-9]*)(?::([A-Z]{1,3})([1-9][0-9]*))?$/;

export interface XlsxInspection {
  sheetParts: number;
  maxRow: number;
  members: number;
  actualBytes: number;
}

const REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const PKG_REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships";
const CT_NS = "http://schemas.openxmlformats.org/package/2006/content-types";
const WORKSHEET_CT = "application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml";
const WORKBOOK_CT = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml";

function xmlOf(parts: Map<string, Uint8Array>, name: string): Element {
  const bytes = parts.get(name);
  if (!bytes) throw fail("This workbook is missing a required part.");
  const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  const doc = new DOMParser({
    onError(level: string) {
      if (level !== "warning") throw fail("This workbook could not be inspected.");
    },
  }).parseFromString(text, "text/xml");
  if (!doc.documentElement) throw fail("This workbook could not be inspected.");
  return doc.documentElement;
}

// Resolves a relationship Target against the part that owns it, rejecting any
// path that leaves the package. Absolute and backslash targets are refused.
// `baseDir` is the directory the relationship is relative to: "" for the package
// root, "xl/" for relationships of xl/workbook.xml.
function resolveTarget(baseDir: string, target: string): string {
  if (target.includes("\\") || target.includes("\u0000")) throw fail("This workbook has an unsupported part path.");
  const segments = target.startsWith("/") ? [] : baseDir.split("/").filter((x) => x !== "");
  for (const seg of target.replace(/^\//, "").split("/")) {
    if (seg === "" || seg === ".") continue;
    if (seg === "..") {
      if (segments.length === 0) throw fail("This workbook has a part path that leaves the package.");
      segments.pop();
    } else {
      segments.push(seg);
    }
  }
  return segments.join("/");
}

// The worksheet parts the workbook declares, in workbook order. Every sheet must
// resolve to exactly one worksheet part with the worksheet content type, and every
// worksheet part in the package must be one of them. Anything else is refused.
export function resolveWorksheetParts(parts: Map<string, Uint8Array>): string[] {
  const rootRels = parts.has("_rels/.rels") ? xmlOf(parts, "_rels/.rels") : null;
  let workbookPath: string | null = null;
  if (rootRels) {
    for (const rel of Array.from(rootRels.getElementsByTagNameNS(PKG_REL_NS, "Relationship"))) {
      if (rel.getAttribute("Type") === `${REL_NS}/officeDocument`) {
        if (workbookPath !== null) throw fail("This workbook declares more than one main part.");
        workbookPath = resolveTarget("", rel.getAttribute("Target") ?? "");
      }
    }
  }
  if (workbookPath === null) workbookPath = "xl/workbook.xml";
  if (!parts.has(workbookPath)) throw fail("This workbook is missing its workbook part.");

  const contentTypes = new Map<string, string>();
  if (parts.has("[Content_Types].xml")) {
    const ct = xmlOf(parts, "[Content_Types].xml");
    for (const o of Array.from(ct.getElementsByTagNameNS(CT_NS, "Override"))) {
      const part = o.getAttribute("PartName") ?? "";
      if (contentTypes.has(part.replace(/^\//, ""))) throw fail("This workbook declares a part type twice.");
      contentTypes.set(part.replace(/^\//, ""), o.getAttribute("ContentType") ?? "");
    }
  }

  const workbookDir = workbookPath.includes("/") ? workbookPath.slice(0, workbookPath.lastIndexOf("/") + 1) : "";
  const relsPath = `${workbookDir}_rels/${workbookPath.slice(workbookDir.length)}.rels`;
  const rels = new Map<string, string>();
  if (parts.has(relsPath)) {
    for (const rel of Array.from(xmlOf(parts, relsPath).getElementsByTagNameNS(PKG_REL_NS, "Relationship"))) {
      const id = rel.getAttribute("Id") ?? "";
      if (rels.has(id)) throw fail("This workbook declares a relationship twice.");
      rels.set(id, resolveTarget(workbookDir, rel.getAttribute("Target") ?? ""));
    }
  }

  const sheetPaths: string[] = [];
  const workbook = xmlOf(parts, workbookPath);
  for (const sheet of Array.from(workbook.getElementsByTagNameNS("*", "sheet"))) {
    const rid = sheet.getAttributeNS(REL_NS, "id") ?? sheet.getAttribute("r:id");
    const target = rid ? rels.get(rid) : undefined;
    if (!target || !parts.has(target)) throw fail("This workbook has a sheet that cannot be found.");
    if (contentTypes.get(target) !== WORKSHEET_CT) throw fail("This workbook has a sheet with an unexpected part type.");
    if (sheetPaths.includes(target)) throw fail("This workbook has two sheets that share a part.");
    sheetPaths.push(target);
  }
  if (contentTypes.get(workbookPath) !== WORKBOOK_CT && contentTypes.size > 0) {
    throw fail("This workbook's main part has an unexpected type.");
  }

  // Any other worksheet-typed part is unreferenced and ambiguous: refuse it.
  for (const [part, type] of contentTypes) {
    if (type === WORKSHEET_CT && !sheetPaths.includes(part)) {
      throw fail("This workbook has a worksheet that no sheet refers to.");
    }
  }
  return sheetPaths;
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

  // Worksheets are whatever the package relationships say they are, not whatever
  // a filename looks like. SheetJS reads through the same relationships.
  const worksheetNames = resolveWorksheetParts(parts);
  if (worksheetNames.length > b.maxSheetParts) {
    throw fail(`Too many sheets (${worksheetNames.length}). The limit is ${b.maxSheetParts}.`);
  }
  let maxRow = 0;
  for (const name of worksheetNames) {
    maxRow = Math.max(maxRow, worksheetExtent(parts.get(name)!));
  }
  const sheetParts = worksheetNames.length;

  return { sheetParts, maxRow, members: parts.size, actualBytes: actualTotal };
}
