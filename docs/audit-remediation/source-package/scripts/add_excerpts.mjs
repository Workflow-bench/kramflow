// Binds every line-based SOURCE_COVERAGE entry to its exact source text.
// Writes source_excerpt (exact lines, verbatim) and source_excerpt_sha256 —
// immutable evidence kept separate from the editorial `text`/`rationale`
// summaries. validate_ledger.mjs re-derives both from the vendored file.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const docsDir = path.join(here, "..", "..");
const covPath = path.join(docsDir, "SOURCE_COVERAGE.json");
const cov = JSON.parse(fs.readFileSync(covPath, "utf8"));

const cache = new Map();
function linesOf(file) {
  if (!cache.has(file)) cache.set(file, fs.readFileSync(path.join(docsDir, "source-package", file), "utf8").split("\n"));
  return cache.get(file);
}

let bound = 0;
for (const e of cov.entries) {
  const m = /^([^:]+):L(\d+)(?:-L?(\d+))?$/.exec(e.locator);
  if (!m) continue;
  const start = parseInt(m[2], 10);
  const end = m[3] ? parseInt(m[3], 10) : start;
  const excerpt = linesOf(m[1]).slice(start - 1, end).join("\n");
  e.source_excerpt = excerpt;
  e.source_excerpt_sha256 = crypto.createHash("sha256").update(excerpt, "utf8").digest("hex");
  bound++;
}
fs.writeFileSync(covPath, JSON.stringify(cov, null, 2));
console.log("bound excerpts:", bound);
