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
    onError() {
      throw fail("This workbook could not be inspected.");
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
    onError() {
      // Every parser message refuses the workbook, warnings included. A warning
      // such as an unquoted attribute is a repair the parser makes silently, so
      // it cannot be read as the author's content (ARCHIVE-S2).
      throw fail("This workbook could not be inspected.");
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
const LOCAL_SIG = 0x04034b50;
const DESCRIPTOR_FLAG = 0x0008;
const ENCRYPTED_FLAG = 0x0001;

interface ZipRecord {
  name: string;
  flags: number;
  method: number;
  crc: number;
  compressed: number;
  uncompressed: number;
  localOffset: number;
}

const zipError = () => fail("This workbook could not be read. Check that it is a valid .xlsx file.");

// Path rules for member names. Aliases that normalise to the same path, backslash
// or absolute paths, and names that leave the package are refused before any
// member is read.
function checkMemberName(name: string): string {
  if (name === "" || name.includes("\\") || name.includes("\u0000") || name.startsWith("/")) {
    throw fail("This workbook has a part path that is not allowed.");
  }
  for (const seg of name.split("/")) {
    if (seg === "" || seg === "." || seg === "..") throw fail("This workbook has a part path that is not allowed.");
  }
  return name.toLowerCase();
}

// Walks the central directory and returns every record. Encryption and Zip64 are
// refused here, from the header itself.
function readCentralDirectory(bytes: Uint8Array): ZipRecord[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const floor = Math.max(0, bytes.length - 22 - 0xffff);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= floor; i--) {
    if (view.getUint32(i, true) === EOCD_SIG) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw zipError();
  const count = view.getUint16(eocd + 10, true);
  const offset = view.getUint32(eocd + 16, true);
  if (count === 0xffff || offset === 0xffffffff) throw fail("This workbook uses a format that is not supported.");
  const records: ZipRecord[] = [];
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let at = offset;
  for (let n = 0; n < count; n++) {
    if (at + 46 > bytes.length || view.getUint32(at, true) !== CENTRAL_SIG) throw zipError();
    const nameLen = view.getUint16(at + 28, true);
    if (at + 46 + nameLen > bytes.length) throw zipError();
    let name: string;
    try {
      name = decoder.decode(bytes.subarray(at + 46, at + 46 + nameLen));
    } catch {
      throw zipError();
    }
    const flags = view.getUint16(at + 8, true);
    if (flags & ENCRYPTED_FLAG) throw fail("This workbook is password protected and cannot be read.");
    records.push({
      name,
      flags,
      method: view.getUint16(at + 10, true),
      crc: view.getUint32(at + 16, true),
      compressed: view.getUint32(at + 20, true),
      uncompressed: view.getUint32(at + 24, true),
      localOffset: view.getUint32(at + 42, true),
    });
    at += 46 + nameLen + view.getUint16(at + 30, true) + view.getUint16(at + 32, true);
  }
  return records;
}

// Every central record must match the local header it points to: same name,
// method and flags, and the same sizes and CRC unless the data descriptor flag
// moves them after the data. A local header that disagrees is an ambiguous view,
// and different readers could disagree about it (ARCHIVE-F2).
function checkLocalRecords(bytes: Uint8Array, records: ZipRecord[]): void {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const decoder = new TextDecoder("utf-8", { fatal: true });
  for (const r of records) {
    const at = r.localOffset;
    if (at + 30 > bytes.length || view.getUint32(at, true) !== LOCAL_SIG) throw zipError();
    const nameLen = view.getUint16(at + 26, true);
    if (at + 30 + nameLen > bytes.length) throw zipError();
    let localName: string;
    try {
      localName = decoder.decode(bytes.subarray(at + 30, at + 30 + nameLen));
    } catch {
      throw zipError();
    }
    if (localName !== r.name) throw fail("This workbook's directory does not match its parts.");
    if (view.getUint16(at + 8, true) !== r.method) throw fail("This workbook's directory does not match its parts.");
    if (view.getUint16(at + 6, true) !== r.flags) throw fail("This workbook's directory does not match its parts.");
    if (!(r.flags & DESCRIPTOR_FLAG)) {
      if (view.getUint32(at + 14, true) !== r.crc) throw fail("This workbook's directory does not match its parts.");
      if (view.getUint32(at + 18, true) !== r.compressed) throw fail("This workbook's directory does not match its parts.");
      if (view.getUint32(at + 22, true) !== r.uncompressed) throw fail("This workbook's directory does not match its parts.");
    }
  }
}

// `overrides` exists so tests can cross a budget with small fixtures; the app
// always calls it with the default budget.
// Optional probe, for tests only: `fed` counts compressed input handed to the
// decoder, `retained` counts output bytes kept. Production callers omit it.
export interface XlsxProbe {
  fed: number;
  retained: number;
  // Output bytes the decoder delivered to ondata, counted before any check.
  produced: number;
  refusedProduced?: number;
  // Snapshot taken when the first refusal is recorded.
  refusedFed?: number;
  refusedRetained?: number;
}

export function inspectXlsxArchive(
  bytes: Uint8Array,
  overrides: Partial<typeof XLSX_ARCHIVE_BUDGET> = {},
  probe?: XlsxProbe
): XlsxInspection {
  const b = { ...XLSX_ARCHIVE_BUDGET, ...overrides };
  if (bytes.length < 4 || ZIP_MAGIC.some((v, i) => bytes[i] !== v)) {
    throw fail("This file is not a supported .xlsx workbook.");
  }

  const records = readCentralDirectory(bytes);
  if (records.length > b.maxEntries) throw fail("This workbook has too many parts.");
  const byName = new Map<string, ZipRecord>();
  for (const r of records) {
    const key = checkMemberName(r.name);
    if (byName.has(key)) throw fail("This workbook has duplicate or aliased part names.");
    byName.set(key, r);
    if (r.method !== 0 && r.method !== 8) {
      throw fail("This workbook uses a compression method that is not supported.");
    }
  }
  checkLocalRecords(bytes, records);

  let declaredTotal = 0;
  for (const r of records) declaredTotal += r.uncompressed;
  if (declaredTotal > b.maxDeclaredBytes) throw fail("This workbook expands to more data than is allowed.");

  const parts = new Map<string, Uint8Array>();
  const seen = new Set<string>();
  let actualTotal = 0;
  // fflate can deliver an error thrown inside ondata as a generic decode error.
  // The specific refusal is kept here and rethrown after push, so the reason is
  // reported as it happened, not as "could not be read".
  let pending: XlsxArchiveError | null = null;
  const refuse = (message: string): never => {
    // The first refusal wins: fflate may call ondata again with its own error.
    if (!pending) {
      pending = fail(message);
      if (probe) {
        probe.refusedFed = probe.fed;
        probe.refusedRetained = probe.retained;
        probe.refusedProduced = probe.produced;
      }
    }
    throw pending;
  };
  const unzip = new Unzip();
  unzip.register(UnzipInflate);
  unzip.register(UnzipPassThrough);
  unzip.onfile = (file) => {
    const key = checkMemberName(file.name);
    const rec = byName.get(key);
    if (!rec || seen.has(key)) throw fail("This workbook's directory does not match its parts.");
    seen.add(key);
    // The streaming decoder's view must agree with the central record it was
    // paired with. Any difference means the two views of the package disagree.
    if (file.compression !== rec.method || file.originalSize !== rec.uncompressed || file.size !== rec.compressed) {
      throw fail("This workbook's directory does not match its parts.");
    }
    const declaredSize = rec.uncompressed;
    if (declaredSize > b.maxMemberBytes) throw fail("This workbook has a part that is too large.");
    if (declaredSize > MiB && rec.compressed > 0 && declaredSize / rec.compressed > b.maxRatio) {
      throw fail("This workbook is compressed more than is allowed.");
    }

    const chunks: Uint8Array[] = [];
    let actual = 0;
    file.ondata = (err, chunk, final) => {
      if (probe && chunk) probe.produced += chunk.length;
      // fflate catches exceptions thrown here and keeps streaming, so a refusal
      // must stop the work itself: once one is recorded, no more output is kept.
      if (pending) return;
      if (err) refuse("This workbook could not be read.");
      actual += chunk.length;
      actualTotal += chunk.length;
      // Actual output is checked as it is produced. Feeding is in small pieces
      // (below), so the output between two checks is bounded.
      if (actual > b.maxMemberBytes || actualTotal > b.maxActualBytes) {
        refuse("This workbook expands to more data than is allowed.");
      }
      if (actual > MiB && rec.compressed > 0 && actual / rec.compressed > b.maxRatio) {
        refuse("This workbook is compressed more than is allowed.");
      }
      chunks.push(chunk.slice());
      if (probe) probe.retained += chunk.length;
      if (final) {
        if (actual !== declaredSize) refuse("This workbook's declared sizes do not match its content.");
        parts.set(file.name, concat(chunks, actual));
      }
    };
    file.start();
  };

  // Bounded peak output. Deflate expands a byte by at most about 1032 times, so
  // a 1 KiB feed produces at most about 1 MiB before the next check. Feeding the
  // whole archive at once would let the decoder allocate for every member before
  // any actual-size check runs (ARCHIVE-S1). The overshoot past the member or
  // aggregate budget is therefore at most one feed's worth of output.
  const FEED = 1024;
  try {
    for (let at = 0; at < bytes.length && !pending; at += FEED) {
      const piece = bytes.subarray(at, Math.min(bytes.length, at + FEED));
      if (probe) probe.fed += piece.length;
      unzip.push(piece, at + FEED >= bytes.length);
    }
    if (bytes.length === 0) unzip.push(bytes, true);
  } catch (err) {
    if (pending) throw pending;
    if (err instanceof XlsxArchiveError) throw err;
    throw zipError();
  }
  if (pending) throw pending;

  if (seen.size !== records.length) throw fail("This workbook's directory does not match its parts.");

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
  return { sheetParts: worksheetNames.length, maxRow, members: parts.size, actualBytes: actualTotal };
}
