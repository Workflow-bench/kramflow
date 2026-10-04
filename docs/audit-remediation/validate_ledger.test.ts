import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { runValidation } from "./validate_ledger.mjs";

// Negative tests for the coverage-integrity checks (B005 item 4). Each case
// copies the real committed audit artifacts into a temp dir, breaks exactly
// one thing, and asserts the validator names it. The real repo must pass.

const DOCS = path.dirname(fileURLToPath(import.meta.url));

interface Coverage {
  entries: Array<{ source_key: string; locator: string; source_excerpt?: string; source_excerpt_sha256?: string }>;
}

let tmp: string;

function copyArtifacts(dest: string) {
  fs.mkdirSync(path.join(dest, "source-package"), { recursive: true });
  for (const f of ["TASK_LEDGER.json", "SOURCE_COVERAGE.json", "PACKAGE_MANIFEST.json"]) {
    fs.copyFileSync(path.join(DOCS, f), path.join(dest, f));
  }
  for (const f of fs.readdirSync(path.join(DOCS, "source-package"))) {
    if (f.endsWith(".md") || f.endsWith(".json")) {
      fs.copyFileSync(path.join(DOCS, "source-package", f), path.join(dest, "source-package", f));
    }
  }
}

function readCoverage(dir: string): Coverage {
  return JSON.parse(fs.readFileSync(path.join(dir, "SOURCE_COVERAGE.json"), "utf8"));
}
function writeCoverage(dir: string, cov: Coverage) {
  fs.writeFileSync(path.join(dir, "SOURCE_COVERAGE.json"), JSON.stringify(cov, null, 2));
}

function findEntry(cov: Coverage, key: string) {
  const e = cov.entries.find((x) => x.source_key === key);
  if (!e) throw new Error(`fixture entry ${key} missing`);
  return e;
}

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(process.env.TMPDIR ?? os.tmpdir(), "validate-ledger-"));
  copyArtifacts(tmp);
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe("validate_ledger coverage-integrity checks", () => {
  it("passes on an untouched copy of the committed artifacts", () => {
    expect(runValidation({ dir: tmp })).toEqual([]);
  });

  it("fails when a vendored member's bytes change (manifest hash binding)", () => {
    fs.appendFileSync(path.join(tmp, "source-package", "KRAMFLOW_FIX_GUIDE.md"), "\nTAMPERED\n");
    const findings = runValidation({ dir: tmp });
    expect(findings.some((f) => f.startsWith("MANIFEST_HASH_MISMATCH: KRAMFLOW_FIX_GUIDE.md"))).toBe(true);
  });

  it("fails when a stored excerpt is altered without updating its digest", () => {
    const cov = readCoverage(tmp);
    const e = findEntry(cov, "FG-PROSE-01");
    e.source_excerpt = (e.source_excerpt ?? "") + " ALTERED";
    writeCoverage(tmp, cov);
    const findings = runValidation({ dir: tmp });
    expect(findings.some((f) => f.startsWith("EXCERPT_DIGEST_MISMATCH: FG-PROSE-01"))).toBe(true);
  });

  it("fails when the excerpt AND its digest are both rewritten but the text no longer matches the source file", () => {
    const cov = readCoverage(tmp);
    const e = findEntry(cov, "FG-PROSE-01");
    const forged = "a completely different paragraph";
    e.source_excerpt = forged;
    e.source_excerpt_sha256 = crypto.createHash("sha256").update(forged, "utf8").digest("hex");
    writeCoverage(tmp, cov);
    const findings = runValidation({ dir: tmp });
    expect(findings.some((f) => f.startsWith("EXCERPT_CONTENT_MISMATCH: FG-PROSE-01"))).toBe(true);
  });

  it("fails a valid-but-wrong locator: an in-range line range whose real content differs from the stored excerpt", () => {
    const cov = readCoverage(tmp);
    const e = findEntry(cov, "FG-PROSE-01");
    e.locator = "KRAMFLOW_FIX_GUIDE.md:L15-L21"; // real lines, wrong content
    writeCoverage(tmp, cov);
    const findings = runValidation({ dir: tmp });
    expect(findings.some((f) => f.startsWith("EXCERPT_CONTENT_MISMATCH: FG-PROSE-01"))).toBe(true);
  });

  it("fails a bad Lighthouse JSON pointer that does not resolve in the vendored raw report", () => {
    const cov = readCoverage(tmp);
    const e = findEntry(cov, "LH-DESKTOP-CONTRAST");
    e.locator = e.locator.replace("#audits.color-contrast", "#audits.does-not-exist");
    writeCoverage(tmp, cov);
    const findings = runValidation({ dir: tmp });
    expect(findings.some((f) => f.includes("BAD_POINTER: LH-DESKTOP-CONTRAST") && f.includes("does-not-exist"))).toBe(true);
  });

  it("fails an entry that lost its bound excerpt entirely", () => {
    const cov = readCoverage(tmp);
    const e = findEntry(cov, "FG-PROSE-02");
    delete e.source_excerpt;
    delete e.source_excerpt_sha256;
    writeCoverage(tmp, cov);
    const findings = runValidation({ dir: tmp });
    expect(findings.some((f) => f.startsWith("EXCERPT_MISSING: FG-PROSE-02"))).toBe(true);
  });
});
