import { describe, expect, it } from "vitest";
import { zipSync, strToU8 } from "fflate";
import { parseCueSheet } from "./parse-cuesheet";
import { extractDocumentText } from "@/lib/server/document-text";

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
    const cell = `<${p}c r=${q}${addr}${q} t=${q}inlineStr${q}><${p}is><${p}t>${text}</${p}t></${p}is></${p}c>`;
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
