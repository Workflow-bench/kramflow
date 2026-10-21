#!/usr/bin/env node
// Validates TASK_LEDGER.json against itself, SOURCE_COVERAGE.json, the vendored
// source-package files, and PACKAGE_MANIFEST.json. Exported as runValidation()
// so negative tests can point it at altered copies; the CLI runs it on the repo.
// Run: node docs/audit-remediation/validate_ledger.mjs
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const defaultDir = path.dirname(fileURLToPath(import.meta.url));

export function runValidation({
  dir = defaultDir,
  ledgerPath = path.join(dir, "TASK_LEDGER.json"),
  coveragePath = path.join(dir, "SOURCE_COVERAGE.json"),
  sourcePkgDir = path.join(dir, "source-package"),
  manifestPath = path.join(dir, "PACKAGE_MANIFEST.json"),
} = {}) {
const ledger = JSON.parse(fs.readFileSync(ledgerPath, "utf8"));
const coverage = JSON.parse(fs.readFileSync(coveragePath, "utf8"));

const REQUIRED_FIELDS = [
  "id", "category", "source_refs", "evidence_class", "observation", "priority",
  "applicability", "desired_behavior", "dependencies", "acceptance_criteria",
  "affected_files", "risk_rollback", "implementation_state", "self_test",
  "independent_review", "evidence_links", "environment", "reviewer",
  "blockers_owner", "next_action", "history",
];
const VALID_STATES = new Set([
  "OPEN", "INVESTIGATING", "IN_PROGRESS", "READY_FOR_CODEX", "NEEDS_REWORK",
  "BLOCKED_EXTERNAL", "CODEX_VERIFIED", "NOT_APPLICABLE", "PRESERVE_PENDING_REVIEW",
]);


const findings = [];
function fail(msg) { findings.push(msg); }

// 1. Duplicate top-level ids
{
  const seen = new Map();
  for (const item of ledger.items) {
    seen.set(item.id, (seen.get(item.id) || 0) + 1);
  }
  for (const [id, n] of seen) if (n > 1) fail(`DUPLICATE_ID: ${id} appears ${n} times in items[]`);
}

// 2. Duplicate child ids (across the whole ledger, not just within one parent),
//    AND any collision between a child id and a parent id (B004: the B003
//    review asked for "parent/child ID collisions" explicitly — the prior
//    version only checked children against each other, never against parents).
{
  const parentIds = new Set(ledger.items.map((i) => i.id));
  const seen = new Map();
  for (const item of ledger.items) {
    for (const c of item.children || []) {
      seen.set(c.id, (seen.get(c.id) || 0) + 1);
      if (parentIds.has(c.id)) fail(`PARENT_CHILD_ID_COLLISION: '${c.id}' is used both as a top-level parent id and as a child id under ${item.id}`);
    }
  }
  for (const [id, n] of seen) if (n > 1) fail(`DUPLICATE_CHILD_ID: ${id} appears ${n} times`);
}

// 3. Required fields present (not undefined) on every parent item
for (const item of ledger.items) {
  for (const field of REQUIRED_FIELDS) {
    if (!(field in item)) fail(`MISSING_FIELD: ${item.id} is missing required field '${field}'`);
  }
  if (!VALID_STATES.has(item.implementation_state)) {
    fail(`INVALID_STATE: ${item.id} has implementation_state '${item.implementation_state}', not in the allowed vocabulary`);
  }
  if (item.implementation_state === "CODEX_VERIFIED" && !item.independent_review) {
    fail(`UNEARNED_VERIFIED: ${item.id} is CODEX_VERIFIED but has no independent_review citation`);
  }
  for (const c of item.children || []) {
    if (!VALID_STATES.has(c.implementation_state)) {
      fail(`INVALID_CHILD_STATE: ${c.id} has implementation_state '${c.implementation_state}'`);
    }
  }
}

// 4. Totals drift: recompute from items[] and compare to the stored totals block
{
  const recomputed = {};
  for (const item of ledger.items) {
    recomputed[item.implementation_state] = (recomputed[item.implementation_state] || 0) + 1;
  }
  const stored = ledger.totals || {};
  const keys = new Set([...Object.keys(recomputed), ...Object.keys(stored)]);
  for (const k of keys) {
    if ((recomputed[k] || 0) !== (stored[k] || 0)) {
      fail(`TOTALS_DRIFT: implementation_state '${k}' — stored totals say ${stored[k] || 0}, recomputed from items[] says ${recomputed[k] || 0}`);
    }
  }
  const sumStored = Object.values(stored).reduce((a, b) => a + b, 0);
  if (sumStored !== ledger.items.length) {
    fail(`TOTALS_DRIFT: stored totals sum to ${sumStored}, but items[] has ${ledger.items.length} entries`);
  }
  let childCount = 0;
  const childBreakdown = {};
  for (const item of ledger.items) {
    for (const c of item.children || []) {
      childCount++;
      childBreakdown[c.implementation_state] = (childBreakdown[c.implementation_state] || 0) + 1;
    }
  }
  if ((ledger.child_criteria_count ?? 0) !== childCount) {
    fail(`CHILD_TOTALS_DRIFT: stored child_criteria_count ${ledger.child_criteria_count} != recomputed ${childCount}`);
  }
  for (const k of new Set([...Object.keys(childBreakdown), ...Object.keys(ledger.child_criteria_breakdown || {})])) {
    const stored2 = (ledger.child_criteria_breakdown || {})[k] || 0;
    if (stored2 !== (childBreakdown[k] || 0)) {
      fail(`CHILD_TOTALS_DRIFT: child state '${k}' — stored ${stored2}, recomputed ${childBreakdown[k] || 0}`);
    }
  }
}

// 5. Dangling KF references from SOURCE_COVERAGE.json (a mapped_kf_ids entry that does not exist in the ledger)
{
  const knownIds = new Set();
  for (const item of ledger.items) {
    knownIds.add(item.id);
    for (const c of item.children || []) knownIds.add(c.id);
  }
  const dangling = new Map();
  for (const entry of coverage.entries) {
    for (const kf of entry.mapped_kf_ids) {
      if (!knownIds.has(kf)) {
        if (!dangling.has(kf)) dangling.set(kf, []);
        dangling.get(kf).push(entry.source_key);
      }
    }
  }
  for (const [kf, keys] of dangling) {
    fail(`DANGLING_KF_REF: SOURCE_COVERAGE.json maps ${keys.length} source key(s) (e.g. ${keys[0]}) to '${kf}', which does not exist in TASK_LEDGER.json`);
  }
}

// 6. Unmapped source keys: a data row (table_row/list_item) with zero mapped_kf_ids and no
//    exempting keyword in its rationale (legend / header row / document title / methodology / process checkbox / section heading).
{
  const EXEMPT = /not a finding|header row|legend|document title|methodology|process checkbox|section heading only|reference link|table heading only|classified individually|prioritization narrative/i;
  const unexplained = coverage.entries.filter(
    (e) => e.mapped_kf_ids.length === 0 && !EXEMPT.test(e.rationale || "")
  );
  for (const e of unexplained) {
    fail(`UNMAPPED_SOURCE_KEY: ${e.source_key} (${e.locator}) has no mapped_kf_ids and no exempting rationale: "${e.rationale}"`);
  }
}

// 7. entry_count drift on SOURCE_COVERAGE.json itself
{
  if (coverage.entry_count !== coverage.entries.length) {
    fail(`COVERAGE_COUNT_DRIFT: stored entry_count ${coverage.entry_count} != entries.length ${coverage.entries.length}`);
  }
}

// 8. Duplicate source keys in SOURCE_COVERAGE.json (B004, Codex B003 review:
//    "duplicate source keys" was explicitly named as a meaningful integrity
//    check the validator was missing).
{
  const seen = new Map();
  for (const entry of coverage.entries) {
    seen.set(entry.source_key, (seen.get(entry.source_key) || 0) + 1);
  }
  for (const [key, n] of seen) if (n > 1) fail(`DUPLICATE_SOURCE_KEY: ${key} appears ${n} times in SOURCE_COVERAGE.json`);
}

// 9. Resolvable locators: for every entry whose source_file is one of the
//    vendored source-package files and whose locator names a line number,
//    confirm that line actually exists in the vendored file (B004: "resolvable
//    exact source locators... against the checksum-matched ZIP" — the ZIP's
//    members are vendored into source-package/ specifically so this check can
//    run without external access; see source-package/README.md).
{
  const lineCountCache = new Map();
  function lineCountOf(file) {
    if (lineCountCache.has(file)) return lineCountCache.get(file);
    const p = path.join(sourcePkgDir, file);
    if (!fs.existsSync(p)) {
      lineCountCache.set(file, null);
      return null;
    }
    const n = fs.readFileSync(p, "utf8").split("\n").length;
    lineCountCache.set(file, n);
    return n;
  }
  for (const entry of coverage.entries) {
    const m = /^([^:]+):L(\d+)(?:-L?(\d+))?$/.exec(entry.locator);
    if (!m) continue; // not a line-based locator (e.g. a Lighthouse JSON-pointer-style locator) — checked separately below
    const [, file, startStr, endStr] = m;
    const total = lineCountOf(file);
    if (total == null) {
      fail(`UNRESOLVABLE_LOCATOR: ${entry.source_key} names file '${file}', which is not vendored under source-package/ — cannot resolve against the checksum-matched ZIP`);
      continue;
    }
    const start = parseInt(startStr, 10);
    const end = endStr ? parseInt(endStr, 10) : start;
    if (start < 1 || end < start || end > total) {
      fail(`UNRESOLVABLE_LOCATOR: ${entry.source_key}'s locator '${entry.locator}' is out of range for ${file} (${total} lines)`);
    }
  }
}

// 10. Raw Lighthouse value agreement: re-derive the color-contrast score/count
//     and LCP numericValue directly from the vendored raw JSON reports and
//     compare against the numbers asserted in the LH-* entries' own text,
//     rather than only checking SOURCE_COVERAGE.json's internal consistency
//     with itself (B004, Codex B003 review finding B003-F1's root cause: the
//     B003 drafting pass never re-read the raw JSON it claimed to summarize).
{
  const LH_FILES = {
    "kramflow-lighthouse-desktop.report.json": { prefix: "LH-DESKTOP" },
    "kramflow-lighthouse-mobile.report.json": { prefix: "LH-MOBILE-1" },
    "kramflow-lighthouse-mobile-rerun.report.json": { prefix: "LH-MOBILE-2" },
  };
  for (const [file, { prefix }] of Object.entries(LH_FILES)) {
    const p = path.join(sourcePkgDir, file);
    if (!fs.existsSync(p)) {
      fail(`UNRESOLVABLE_LOCATOR: raw Lighthouse file '${file}' is not vendored under source-package/ — cannot independently re-verify ${prefix}'s claims`);
      continue;
    }
    const raw = JSON.parse(fs.readFileSync(p, "utf8"));
    const contrast = raw.audits?.["color-contrast"];
    const lcp = raw.audits?.["largest-contentful-paint"];
    const realScore = contrast?.score ?? null;
    const realItemCount = contrast?.details?.items?.length ?? null;
    const realLcpMs = lcp?.numericValue != null ? Math.round(lcp.numericValue) : null;

    const relevant = coverage.entries.filter((e) => e.source_key.startsWith(prefix));
    const combinedText = relevant.map((e) => e.text).join(" ");

    if (realScore === 0 && /all passing|all pass\b/i.test(combinedText)) {
      fail(`RAW_AUDIT_MISMATCH: ${prefix}'s SOURCE_COVERAGE text claims passing color-contrast, but the raw audit's score is 0 (failing) in ${file}`);
    }
    const countMatch = /(\d+)\s*(?:color-)?contrast (?:audit )?(?:failing )?items?/i.exec(combinedText);
    if (realItemCount != null && countMatch && parseInt(countMatch[1], 10) !== realItemCount) {
      fail(`RAW_AUDIT_MISMATCH: ${prefix}'s text claims ${countMatch[1]} contrast items, but raw JSON has ${realItemCount} in ${file}`);
    }
    const lcpMatch = /LCP[^0-9]*(\d{2,5})\s*ms/i.exec(combinedText);
    if (realLcpMs != null && lcpMatch) {
      const claimed = parseInt(lcpMatch[1], 10);
      if (Math.abs(claimed - realLcpMs) > 1) {
        fail(`RAW_AUDIT_MISMATCH: ${prefix}'s text claims LCP ${claimed}ms, but raw JSON numericValue rounds to ${realLcpMs}ms in ${file}`);
      }
    }
  }
}

// 11. Empty/invalid acceptance data: an OPEN or READY_FOR_CODEX parent with no
//     children must have a non-empty acceptance_criteria array — an empty
//     array silently closes nothing and proves nothing (B004, Codex B003
//     review: "empty/invalid acceptance data").
{
  const DEFERS_TO_CHILDREN = /see children/i;
  for (const item of ledger.items) {
    const hasChildren = (item.children || []).length > 0;
    if (["OPEN", "READY_FOR_CODEX"].includes(item.implementation_state) && !hasChildren) {
      const ac = item.acceptance_criteria || [];
      const ok = ac.length > 0 && !ac.every((c) => !c || DEFERS_TO_CHILDREN.test(c));
      if (!ok) fail(`EMPTY_ACCEPTANCE_CRITERIA: ${item.id} is ${item.implementation_state} with no children but an empty/placeholder acceptance_criteria array`);
    }
    for (const c of item.children || []) {
      if (c.implementation_state === "OPEN" && (!c.acceptance_criterion || !c.acceptance_criterion.trim())) {
        fail(`EMPTY_ACCEPTANCE_CRITERIA: child ${c.id} is OPEN with no acceptance_criterion`);
      }
    }
  }
}

// 12. Reverse-map regeneration consistency: by_kf_index must exactly match a
//     fresh recomputation from entries[] — catches a hand-edit to one without
//     the other (B004, Codex B003 review: "regenerated reverse-map consistency").
{
  const recomputed = {};
  for (const entry of coverage.entries) {
    for (const kf of entry.mapped_kf_ids) {
      (recomputed[kf] ||= []).push(entry.source_key);
    }
  }
  const stored = coverage.by_kf_index || {};
  const allKeys = new Set([...Object.keys(recomputed), ...Object.keys(stored)]);
  for (const kf of allKeys) {
    const a = (recomputed[kf] || []).slice().sort();
    const b = (stored[kf] || []).slice().sort();
    if (a.length !== b.length || a.some((v, i) => v !== b[i])) {
      fail(`REVERSE_MAP_DRIFT: by_kf_index['${kf}'] does not match a fresh recomputation from entries[] — regenerate with build_coverage_md.mjs's pipeline`);
    }
  }
}


// 13. Manifest binding: every vendored source-package member must match its
//     sha256 in PACKAGE_MANIFEST.json (B004-F1 / B005 item 4). A changed byte
//     in any vendored file fails here even when every line range still exists.
{
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  for (const member of manifest.members) {
    const p = path.join(sourcePkgDir, member.name);
    if (!fs.existsSync(p)) {
      // Vendored subset: HTML duplicates intentionally not copied (see source-package/README.md).
      if (member.name.endsWith(".html")) continue;
      fail(`MANIFEST_MEMBER_MISSING: ${member.name} listed in PACKAGE_MANIFEST.json is not vendored`);
      continue;
    }
    const actual = crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex");
    if (actual !== member.sha256) {
      fail(`MANIFEST_HASH_MISMATCH: ${member.name} sha256 ${actual} != manifest ${member.sha256}`);
    }
  }
}

// 14. Excerpt integrity: each line-based entry's stored source_excerpt must
//     equal the exact text the locator names in the vendored file, and its
//     source_excerpt_sha256 must match that text. A valid-but-wrong locator
//     (a real line range whose content differs) fails here, not just a
//     missing/out-of-range one (B005 item 4 negative cases).
{
  const lineCache = new Map();
  for (const entry of coverage.entries) {
    const m = /^([^:]+):L(\d+)(?:-L?(\d+))?$/.exec(entry.locator);
    if (!m) continue;
    const [, file, s, e] = m;
    if (!fs.existsSync(path.join(sourcePkgDir, file))) continue; // reported by check 9
    if (!lineCache.has(file)) lineCache.set(file, fs.readFileSync(path.join(sourcePkgDir, file), "utf8").split("\n"));
    const start = parseInt(s, 10);
    const end = e ? parseInt(e, 10) : start;
    const actualText = lineCache.get(file).slice(start - 1, end).join("\n");
    if (typeof entry.source_excerpt !== "string" || typeof entry.source_excerpt_sha256 !== "string") {
      fail(`EXCERPT_MISSING: ${entry.source_key} has no bound source_excerpt/source_excerpt_sha256 (run add_excerpts.mjs)`);
      continue;
    }
    const digest = crypto.createHash("sha256").update(entry.source_excerpt, "utf8").digest("hex");
    if (digest !== entry.source_excerpt_sha256) {
      fail(`EXCERPT_DIGEST_MISMATCH: ${entry.source_key} stored excerpt does not hash to its stored source_excerpt_sha256`);
    }
    if (actualText !== entry.source_excerpt) {
      fail(`EXCERPT_CONTENT_MISMATCH: ${entry.source_key} locator '${entry.locator}' now resolves to different text than its stored source_excerpt`);
    }
  }
}

// 15. Lighthouse JSON pointers: every '#audits.<id>' / '#categories.<id>'
//     token in a LH-* locator must resolve inside its vendored raw JSON.
{
  for (const entry of coverage.entries) {
    if (!entry.source_key.startsWith("LH-") || !/\.json\b/.test(entry.locator)) continue;
    const jsonFile = entry.locator.split("#")[0].trim();
    const pointerMatches = [...entry.locator.matchAll(/#((?:audits|categories)\.[A-Za-z0-9_.-]+)/g)].map((m) => m[1]);
    if (pointerMatches.length === 0) {
      fail(`BAD_POINTER: ${entry.source_key} has no '#audits.*' or '#categories.*' pointer in locator '${entry.locator}'`);
      continue;
    }
    const jsonPath = path.join(sourcePkgDir, jsonFile.split(" ")[0]);
    if (!fs.existsSync(jsonPath)) {
      fail(`BAD_POINTER: ${entry.source_key} points into '${jsonFile}', which is not vendored`);
      continue;
    }
    const raw = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
    for (const ptr of pointerMatches) {
      // Pointers stop at the first space/paren in the locator; strip any trailing dot.
      const clean = ptr.replace(/\.$/, "");
      const resolved = clean.split(".").reduce((o, k) => (o == null ? undefined : o[k]), raw);
      if (resolved === undefined) {
        fail(`BAD_POINTER: ${entry.source_key}'s pointer '#${clean}' does not resolve in ${jsonFile}`);
      }
    }
  }
}

return findings;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const findings = runValidation();
  if (findings.length === 0) {
    console.log("validate_ledger: PASS — duplicate/collision checks, required fields, totals, dangling/unmapped keys, locator resolution, excerpt digests, manifest hashes, Lighthouse pointers and raw values, empty acceptance, reverse-map consistency.");
    process.exit(0);
  } else {
    console.log(`validate_ledger: ${findings.length} finding(s):`);
    for (const f of findings) console.log(" -", f);
    process.exit(1);
  }
}
