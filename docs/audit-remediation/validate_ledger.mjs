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

// 2. Duplicate child ids (across the whole ledger, not just within one parent)
{
  const seen = new Map();
  for (const item of ledger.items) {
    for (const c of item.children || []) {
      seen.set(c.id, (seen.get(c.id) || 0) + 1);
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

if (findings.length === 0) {
  console.log("validate_ledger: PASS — no duplicate ids, no missing required fields, totals match items[], no dangling or unmapped source keys.");
  process.exit(0);
} else {
  console.log(`validate_ledger: ${findings.length} finding(s):`);
  for (const f of findings) console.log(" -", f);
  process.exit(1);
}
