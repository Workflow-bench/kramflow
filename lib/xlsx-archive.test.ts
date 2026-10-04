import { describe, expect, it } from "vitest";
import { zipSync, strToU8 } from "fflate";
import { parseCueSheet } from "./parse-cuesheet";
import { extractDocumentText } from "@/lib/server/document-text";
import { inspectXlsxArchive } from "./xlsx-archive";

// Hostile and transformed .xlsx packages, written by hand so every byte is ours.
// Each case must be refused, or read with all populated source data, through
// BOTH readers (parseCueSheet and extractDocumentText). Silent loss is the failure
// these tests guard against (XLSX-R1, B008-F1).

const NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const RNS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const PKG = "http://schemas.openxmlformats.org/package/2006/relationships";
const CT = "http://schemas.openxmlformats.org/package/2006/content-types";
const DECL = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`;

// A minimal, valid package around one worksheet part.
function pkg(sheetXml: string, extra: Record<string, string> = {}): Buffer {
  const files: Record<string, Uint8Array> = {
    "[Content_Types].xml": strToU8(`${DECL}<Types xmlns="${CT}"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`),
    "_rels/.rels": strToU8(`${DECL}<Relationships xmlns="${PKG}"><Relationship Id="rId1" Type="${RNS}/officeDocument" Target="xl/workbook.xml"/></Relationships>`),
    "xl/workbook.xml": strToU8(`${DECL}<workbook xmlns="${NS}" xmlns:r="${RNS}"><sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets></workbook>`),
    "xl/_rels/workbook.xml.rels": strToU8(`${DECL}<Relationships xmlns="${PKG}"><Relationship Id="rId1" Type="${RNS}/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`),
    "xl/worksheets/sheet1.xml": strToU8(sheetXml),
    ...Object.fromEntries(Object.entries(extra).map(([k, v]) => [k, strToU8(v)])),
  };
  return Buffer.from(zipSync(files));
}

const HEADER = ["Day", "Session", "Start", "Item", "Duration", "Presenter"];

// Sheet XML in a chosen quoting and namespace style. `cells` maps addresses to text.
function sheet(opts: {
  q?: "\"" | "'";
  prefix?: string;
  dimension?: string | null;
  cells: Record<string, string>;
}): string {
  const q = opts.q ?? "\"";
  const p = opts.prefix ? `${opts.prefix}:` : "";
  const ns = opts.prefix ? ` xmlns:${opts.prefix}="${NS}"` : ` xmlns="${NS}"`;
  const rows = new Map<number, string[]>();
  for (const [addr, text] of Object.entries(opts.cells)) {
    const row = Number(addr.replace(/^[A-Z]+/, ""));
    const numeric = /^-?\d+(\.\d+)?$/.test(text);
    // Numbers are stored as numbers, as Excel does, so the cue parser sees them as values.
    const cell = numeric
      ? `<${p}c r=${q}${addr}${q}><${p}v>${text}</${p}v></${p}c>`
      : `<${p}c r=${q}${addr}${q} t=${q}inlineStr${q}><${p}is><${p}t>${text}</${p}t></${p}is></${p}c>`;
    rows.set(row, [...(rows.get(row) ?? []), cell]);
  }
  const body = [...rows.keys()]
    .sort((a, b) => a - b)
    .map((r) => `<${p}row r=${q}${r}${q}>${rows.get(r)!.join("")}</${p}row>`)
    .join("");
  const dim = opts.dimension === null ? "" : `<${p}dimension ref=${q}${opts.dimension}${q}/>`;
  return `${DECL}<${p}worksheet${ns}>${dim}<${p}sheetData>${body}</${p}sheetData></${p}worksheet>`;
}

async function readBoth(buf: Buffer) {
  // parseCueSheet is synchronous; both readers' failures must come back as values.
  const cue = ((): { ok: true; r: ReturnType<typeof parseCueSheet> } | { ok: false; msg: string } => {
    try {
      return { ok: true, r: parseCueSheet(buf) };
    } catch (e) {
      return { ok: false, msg: (e as Error).message };
    }
  })();
  const text = await extractDocumentText(new File([new Uint8Array(buf)], "run.xlsx")).then(
    (t) => ({ ok: true as const, t }),
    (e: Error) => ({ ok: false as const, msg: e.message })
  );
  return { cue, text };
}

describe("XML quoting and namespace forms of an A6000-only sheet (XLSX-R1)", () => {
  const cells = { A6000: "Late required cue" };

  it("double-quoted, unprefixed: refused (control case)", async () => {
    const out = await readBoth(pkg(sheet({ cells, dimension: "A6000:A6000" })));
    expect(out.text.ok).toBe(false);
    expect(out.cue.ok).toBe(false);
  });

  it("single-quoted attributes: refused, not read as empty", async () => {
    const out = await readBoth(pkg(sheet({ q: "'", cells, dimension: "A6000:A6000" })));
    expect(out.text.ok).toBe(false);
    expect(out.cue.ok).toBe(false);
  });

  it("namespace-prefixed elements and attributes: refused", async () => {
    const out = await readBoth(pkg(sheet({ prefix: "x", cells, dimension: "A6000:A6000" })));
    expect(out.text.ok).toBe(false);
    expect(out.cue.ok).toBe(false);
  });

  it("no dimension element, row/cell extents only: refused", async () => {
    const out = await readBoth(pkg(sheet({ cells, dimension: null })));
    expect(out.text.ok).toBe(false);
    expect(out.cue.ok).toBe(false);
  });

  it("single-quoted, prefixed, no dimension: refused", async () => {
    const out = await readBoth(pkg(sheet({ q: "'", prefix: "x", cells, dimension: null })));
    expect(out.text.ok).toBe(false);
    expect(out.cue.ok).toBe(false);
  });

  it("dimension says A6000 but no row is populated: refused (extent unverifiable)", async () => {
    const out = await readBoth(pkg(sheet({ cells: {}, dimension: "A1:A6000" })));
    expect(out.text.ok).toBe(false);
  });

  it("malformed worksheet XML: refused generically", async () => {
    const broken = `${DECL}<worksheet xmlns="${NS}"><sheetData><row r="6000"><c r="A6000"`;
    const out = await readBoth(pkg(broken));
    expect(out.text.ok).toBe(false);
    expect(out.cue.ok).toBe(false);
  });

  it("non-numeric row number: refused as uninspectable", async () => {
    const bad = `${DECL}<worksheet xmlns="${NS}"><sheetData><row r="six"><c r="A1"><v>1</v></c></row></sheetData></worksheet>`;
    const out = await readBoth(pkg(bad));
    expect(out.text.ok).toBe(false);
  });
});

describe("ordinary valid packages keep all data (no over-rejection)", () => {
  it("single-quoted, prefixed, in-cap sheet is read completely by both readers", async () => {
    const cells: Record<string, string> = {};
    HEADER.forEach((h, c) => (cells[`${String.fromCharCode(65 + c)}1`] = h));
    cells["A2"] = "Friday";
    cells["B2"] = "Evening";
    cells["C2"] = "18:00";
    cells["D2"] = "Opening";
    cells["E2"] = "5";
    cells["F2"] = "Alex";
    cells["D40"] = "Last cue of the day";
    const buf = pkg(sheet({ q: "'", prefix: "x", cells, dimension: "A1:F40" }));
    const out = await readBoth(buf);
    expect(out.text.ok).toBe(true);
    if (out.text.ok) expect(out.text.t).toContain("Last cue of the day");
  });

  it("sparse columns inside the cap keep their far-column data", async () => {
    const buf = pkg(sheet({ cells: { A1: "Day", Z3: "far column" }, dimension: "A1:Z3" }));
    const out = await readBoth(buf);
    expect(out.text.ok).toBe(true);
    if (out.text.ok) expect(out.text.t).toContain("far column");
  });
});

// ---------------------------------------------------------------------------
// Hostile archives, built by patching real zip bytes.
// ---------------------------------------------------------------------------

function patchAll(buf: Buffer, sig: number, offset: number, width: 2 | 4, value: number) {
  const out = Buffer.from(buf);
  for (let i = 0; i + 4 <= out.length; i++) {
    if (out.readUInt32LE(i) === sig) {
      if (width === 2) out.writeUInt16LE(value, i + offset);
      else out.writeUInt32LE(value, i + offset);
    }
  }
  return out;
}

const LOCAL = 0x04034b50;
const CENTRAL = 0x02014b50;

describe("hostile archives are refused before or during inflation (actual-byte budgets)", () => {
  it("declared size lowered below the real content (forged declaration): refused", async () => {
    const bigText = "x".repeat(200_000);
    const base = Buffer.from(zipSync({ "xl/sharedStrings.xml": strToU8(bigText), "xl/worksheets/sheet1.xml": strToU8(sheet({ cells: { A1: "Day" }, dimension: "A1" })) }));
    const forged = patchAll(patchAll(base, LOCAL, 22, 4, 10), CENTRAL, 24, 4, 10);
    const out = await readBoth(forged);
    expect(out.text).toMatchObject({ ok: false });
    // fflate detects the overrun while inflating; the refusal is generic on purpose.
    if (!out.text.ok) expect(out.text.msg).toMatch(/could not be read|do not match/);
  });

  it("ten-megabyte zero member (ratio bomb): refused without inflating it", async () => {
    const zeros = new Uint8Array(10 * 1024 * 1024);
    const bomb = Buffer.from(zipSync({ "xl/sharedStrings.xml": zeros, "xl/worksheets/sheet1.xml": strToU8(sheet({ cells: { A1: "Day" }, dimension: "A1" })) }));
    expect(bomb.length).toBeLessThan(200_000);
    const out = await readBoth(bomb);
    expect(out.text).toMatchObject({ ok: false });
    if (!out.text.ok) expect(out.text.msg).toMatch(/compressed more than is allowed/);
  });

  it("member count over the budget: refused", async () => {
    const files: Record<string, Uint8Array> = { "xl/worksheets/sheet1.xml": strToU8(sheet({ cells: { A1: "Day" }, dimension: "A1" })) };
    for (let i = 0; i < 600; i++) files[`extra/${i}.txt`] = strToU8("y");
    const out = await readBoth(Buffer.from(zipSync(files)));
    expect(out.text).toMatchObject({ ok: false });
    if (!out.text.ok) expect(out.text.msg).toMatch(/too many parts/);
  });

  it("encrypted-flag member: refused generically", async () => {
    const base = Buffer.from(zipSync({ "xl/worksheets/sheet1.xml": strToU8(sheet({ cells: { A1: "Day" }, dimension: "A1" })) }));
    const enc = patchAll(patchAll(base, LOCAL, 6, 2, 1), CENTRAL, 8, 2, 1);
    const out = await readBoth(enc);
    expect(out.text).toMatchObject({ ok: false });
    if (!out.text.ok) expect(out.text.msg).toMatch(/password protected/);
  });

  it("not a zip at all: refused", async () => {
    await expect(readBoth(Buffer.from("PK\u0003\u0004 not really a workbook")).then((o) => o.text)).resolves.toMatchObject({ ok: false });
  });

  it("truncated zip: refused", async () => {
    const base = pkg(sheet({ cells: { A1: "Day" }, dimension: "A1" }));
    await expect(readBoth(base.subarray(0, base.length - 30)).then((o) => o.text)).resolves.toMatchObject({ ok: false });
  });
});

// A package whose worksheet lives at a chosen part path, referenced by a chosen
// relationship target. Used to test relocated and mis-referenced worksheets.
function relocated(opts: { partPath: string; target: string; sheetXml: string; declare?: boolean; extraWorksheet?: string }): Buffer {
  const declare = opts.declare ?? true;
  const ct = `${DECL}<Types xmlns="${CT}"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${declare ? `<Override PartName="/${opts.partPath}" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>` : ""}${opts.extraWorksheet ? `<Override PartName="/${opts.extraWorksheet}" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>` : ""}</Types>`;
  const files: Record<string, Uint8Array> = {
    "[Content_Types].xml": strToU8(ct),
    "_rels/.rels": strToU8(`${DECL}<Relationships xmlns="${PKG}"><Relationship Id="rId1" Type="${RNS}/officeDocument" Target="xl/workbook.xml"/></Relationships>`),
    "xl/workbook.xml": strToU8(`${DECL}<workbook xmlns="${NS}" xmlns:r="${RNS}"><sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets></workbook>`),
    "xl/_rels/workbook.xml.rels": strToU8(`${DECL}<Relationships xmlns="${PKG}"><Relationship Id="rId1" Type="${RNS}/worksheet" Target="${opts.target}"/></Relationships>`),
    [opts.partPath]: strToU8(opts.sheetXml),
  };
  if (opts.extraWorksheet) files[opts.extraWorksheet] = strToU8(opts.sheetXml);
  return Buffer.from(zipSync(files));
}

describe("worksheets are the ones the package relationships declare (XLSX-R2)", () => {
  const late = sheet({ cells: { A6000: "Late required cue" }, dimension: "A6000:A6000" });
  const inCap = sheet({ cells: { A1: "Day", B2: "Relocated item" }, dimension: "A1:B2" });

  it("late data in a relocated worksheet (xl/data/sheet1.xml) is refused by both readers", async () => {
    const out = await readBoth(relocated({ partPath: "xl/data/sheet1.xml", target: "data/sheet1.xml", sheetXml: late }));
    expect(out.text.ok).toBe(false);
    expect(out.cue.ok).toBe(false);
  });

  it("an in-cap relocated worksheet keeps all its data through extraction", async () => {
    const out = await readBoth(relocated({ partPath: "xl/data/sheet1.xml", target: "data/sheet1.xml", sheetXml: inCap }));
    expect(out.text.ok).toBe(true);
    if (out.text.ok) expect(out.text.t).toContain("Relocated item");
  });

  it("a sheet whose relationship target does not exist is refused", async () => {
    const out = await readBoth(relocated({ partPath: "xl/data/sheet1.xml", target: "missing/sheet9.xml", sheetXml: late, declare: true }));
    expect(out.text.ok).toBe(false);
  });

  it("a worksheet no sheet refers to is refused as ambiguous", async () => {
    const out = await readBoth(relocated({ partPath: "xl/data/sheet1.xml", target: "data/sheet1.xml", sheetXml: inCap, extraWorksheet: "xl/worksheets/orphan.xml" }));
    expect(out.text.ok).toBe(false);
  });

  it("a relationship target that escapes the package is refused", async () => {
    const out = await readBoth(relocated({ partPath: "xl/data/sheet1.xml", target: "../../../etc/sheet1.xml", sheetXml: inCap }));
    expect(out.text.ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Central/local consistency, aliases, duplicates (ARCHIVE-F2) and strict XML
// (ARCHIVE-S2). Each fixture is a real zip with one byte-level change, so the
// refusal can only come from the check named in the expectation.
// ---------------------------------------------------------------------------

// Rewrites every occurrence of `from` with `to` (equal length) in the zip bytes.
function renameEverywhere(buf: Buffer, from: string, to: string): Buffer {
  expect(from.length).toBe(to.length);
  const out = Buffer.from(buf);
  const needle = Buffer.from(from);
  const repl = Buffer.from(to);
  let at = out.indexOf(needle);
  while (at >= 0) {
    repl.copy(out, at);
    at = out.indexOf(needle, at + 1);
  }
  return out;
}

const SHEET_XML = sheet({ cells: { A1: "Day", B2: "Kept item" }, dimension: "A1:B2" });

describe("central and local records agree (ARCHIVE-F2)", () => {
  it("local filename changed while the central record is unchanged: refused", async () => {
    const base = Buffer.from(zipSync({ "xl/worksheets/sheet1.xml": strToU8(SHEET_XML) }));
    const tampered = renameEverywhere(base, "xl/worksheets/sheet1.xml", "xl/worksheets/sheet2.xml");
    // Patch only the local copy back: write the central name back but leave the local name changed.
    const local = Buffer.from(base);
    const central = base.indexOf(Buffer.from("PK\u0001\u0002"));
    expect(central).toBeGreaterThan(0);
    const localName = Buffer.from("xl/worksheets/sheet1.xml");
    const idx = local.indexOf(localName);
    Buffer.from("xl/worksheets/sheet2.xml").copy(local, idx, 0, localName.length);
    const out = await readBoth(local);
    expect(out.text.ok).toBe(false);
    if (!out.text.ok) expect(out.text.msg).toMatch(/does not match its parts/);
    expect(tampered.length).toBe(local.length);
  });

  it("two members with the same name (duplicate fixture): refused", async () => {
    // Two real members, then the second one renamed to the first's name in both
    // its local header and its central record: two records, one name.
    const base = Buffer.from(zipSync({ "xl/sheet.xmx": strToU8(SHEET_XML), "xl/sheet.xmy": strToU8("ab") }));
    const dup = renameEverywhere(base, "xl/sheet.xmy", "xl/sheet.xmx");
    const out = await readBoth(dup);
    expect(out.text.ok).toBe(false);
    if (!out.text.ok) expect(out.text.msg).toMatch(/duplicate or aliased|does not match|not allowed/);
  });

  it("a path alias with an empty segment (xl//worksheets) is refused, not normalised", async () => {
    const base = Buffer.from(zipSync({ "ab/cdefg": strToU8(SHEET_XML) }));
    const alias = renameEverywhere(base, "ab/cdefg", "ab//defg");
    expect(() => inspectXlsxArchive(new Uint8Array(alias))).toThrow(/not allowed|does not match/);
  });

  it("names that differ only by case are one part to the reader and are refused", async () => {
    const base = Buffer.from(zipSync({ "xl/Sheet.xml": strToU8("a"), "xl/sheet.xml": strToU8("b") }));
    expect(() => inspectXlsxArchive(new Uint8Array(base))).toThrow(/duplicate or aliased/);
  });
});

describe("XML warnings refuse the workbook through both readers (ARCHIVE-S2)", () => {
  it("unquoted attribute in an in-cap sheet is refused, not silently repaired, by both readers", async () => {
    // xmldom reports <c r=B2> as a warning and repairs it. The warning alone refuses.
    const unquoted = `${DECL}<worksheet xmlns="${NS}"><sheetData><row r="2"><c r=B2 t="inlineStr"><is><t>Kept item</t></is></c></row></sheetData></worksheet>`;
    const out = await readBoth(pkg(unquoted));
    expect(out.text.ok).toBe(false);
    expect(out.cue.ok).toBe(false);
  });

  it("ordinary quoted, prefixed sheet keeps its actual cue content through the cue parser", async () => {
    // Real cue layout: title row "Event / Day | Session", a group row, the header row, then items.
    const cells: Record<string, string> = {
      A1: "Test Event\nFriday | Evening",
      A3: "#",
      B3: "Start Time",
      C3: "End Time",
      D3: "Duration (Min)",
      E3: "Item",
      F3: "Presenter",
      A4: "1",
      B4: "18:00",
      C4: "18:05",
      D4: "5",
      E4: "Opening keynote",
      F4: "Alex",
    };
    const out = await readBoth(pkg(sheet({ q: "'", prefix: "x", cells, dimension: "A1:F4" })));
    expect(out.cue.ok).toBe(true);
    if (out.cue.ok) expect(out.cue.r.programs.map((p) => p.name)).toContain("Opening keynote");
    expect(out.text.ok).toBe(true);
    if (out.text.ok) expect(out.text.t).toContain("Opening keynote");
  });
});

describe("bounded peak output (ARCHIVE-S1), exercised with small budgets", () => {
  it("a member that inflates past the member budget is stopped, though its declaration is forged small", () => {
    const big = new Uint8Array(200 * 1024); // 200 KiB of zeros: tiny compressed, large inflated
    const base = Buffer.from(zipSync({ "xl/worksheets/sheet1.xml": strToU8(SHEET_XML), "xl/sharedStrings.xml": big }));
    const forged = patchAll(patchAll(base, LOCAL, 22, 4, 1000), CENTRAL, 24, 4, 1000);
    expect(() => inspectXlsxArchive(new Uint8Array(forged), { maxMemberBytes: 64 * 1024 })).toThrow(/could not be read|expands to more data|do not match/);
  });

  it("the aggregate actual budget stops two members that together exceed it", () => {
    const part = new Uint8Array(40 * 1024);
    const buf = pkg(SHEET_XML, { "xl/a.xml": "", "xl/b.xml": "" });
    void part;
    const big = Buffer.from(zipSync({ "xl/worksheets/sheet1.xml": strToU8(SHEET_XML), "xl/a.xml": part, "xl/b.xml": part }));
    void buf;
    expect(() => inspectXlsxArchive(new Uint8Array(big), { maxActualBytes: 60 * 1024 })).toThrow(/expands to more data/);
  });

  it("an honest archive under the same small budgets is accepted", () => {
    const buf = pkg(SHEET_XML);
    expect(inspectXlsxArchive(new Uint8Array(buf), { maxMemberBytes: 64 * 1024, maxActualBytes: 64 * 1024 }).maxRow).toBe(2);
  });
});

// Production budget, no overrides. Declared checks refuse an accurately declared
// oversize member before any inflation, so the actual-byte path is exercised by a
// forged small declaration whose real output (17 MiB) crosses the 16 MiB member
// budget mid-stream. Overshoot bound: feeds are 1 KiB of compressed input, and
// deflate expands a byte by at most about 1032 times, so the output produced
// before the check fires is at most about 1 MiB past the member budget.
// Rewrites the declared uncompressed size only in the local and central headers of
// the member with this name, so the other members keep honest declarations.
function patchMemberSize(buf: Buffer, name: string, value: number): Buffer {
  const out = Buffer.from(buf);
  const needle = Buffer.from(name);
  for (let i = 0; i + 4 <= out.length; i++) {
    const sig = out.readUInt32LE(i);
    if (sig === LOCAL) {
      const nameLen = out.readUInt16LE(i + 26);
      if (out.subarray(i + 30, i + 30 + nameLen).equals(needle)) out.writeUInt32LE(value, i + 22);
    } else if (sig === CENTRAL) {
      const nameLen = out.readUInt16LE(i + 28);
      if (out.subarray(i + 46, i + 46 + nameLen).equals(needle)) out.writeUInt32LE(value, i + 24);
    }
  }
  return out;
}

describe("production output budget with a forged declaration (ARCHIVE-S1)", () => {
  it("accurately declared oversize member is refused by the declared check, before inflation", () => {
    const huge = new Uint8Array(17 * 1024 * 1024);
    const buf = Buffer.from(zipSync({ "xl/worksheets/sheet1.xml": strToU8(SHEET_XML), "xl/sharedStrings.xml": huge }));
    expect(() => inspectXlsxArchive(new Uint8Array(buf))).toThrow(/too large/);
  });

  it("forged small declaration with 17 MiB real output is stopped by the actual-byte check", () => {
    // Incompressible content keeps the actual ratio near 1, so the member budget
    // (not the ratio rule) is what stops the stream. Filled in 64 KiB blocks, the
    // getRandomValues limit.
    const huge = new Uint8Array(17 * 1024 * 1024);
    for (let at = 0; at < huge.length; at += 65536) crypto.getRandomValues(huge.subarray(at, Math.min(huge.length, at + 65536)));
    const base = Buffer.from(zipSync({ "xl/worksheets/sheet1.xml": strToU8(SHEET_XML), "xl/sharedStrings.xml": huge }));
    const forged = patchMemberSize(base, "xl/sharedStrings.xml", 4096);
    // The actual-byte budget must be the reason, not the final size mismatch that
    // follows a full inflation. A refusal stops further output (fflate swallows
    // exceptions thrown in ondata, so the stop is recorded, not thrown).
    expect(() => inspectXlsxArchive(new Uint8Array(forged))).toThrow(/expands to more data/);
  }, 60_000);
});
