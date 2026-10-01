#!/usr/bin/env node
// Validates TASK_LEDGER.json against itself and against SOURCE_COVERAGE.json.
// Run: node docs/audit-remediation/validate_ledger.mjs
// Exit code 0 = clean, 1 = findings printed below.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const ledger = JSON.parse(fs.readFileSync(path.join(dir, "TASK_LEDGER.json"), "utf8"));
const coverage = JSON.parse(fs.readFileSync(path.join(dir, "SOURCE_COVERAGE.json"), "utf8"));

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
  const sourcePkgDir = path.join(dir, "source-package");
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
  const sourcePkgDir = path.join(dir, "source-package");
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

if (findings.length === 0) {
  console.log(
    "validate_ledger: PASS — no duplicate parent/child/source-key ids or collisions, no missing required fields, " +
    "totals match items[], no dangling or unmapped source keys, every line-based locator resolves against the " +
    "vendored source-package files, raw Lighthouse contrast/LCP values agree with SOURCE_COVERAGE.json's own text, " +
    "no empty acceptance criteria on an open item, and by_kf_index matches a fresh recomputation from entries[]."
  );
  process.exit(0);
} else {
  console.log(`validate_ledger: ${findings.length} finding(s):`);
  for (const f of findings) console.log(" -", f);
  process.exit(1);
}
