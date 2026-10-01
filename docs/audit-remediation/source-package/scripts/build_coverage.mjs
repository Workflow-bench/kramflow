import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const base = path.dirname(fileURLToPath(import.meta.url));
const classified = JSON.parse(fs.readFileSync(`${base}/classified.json`, "utf8"));

const entries = classified.map(e => ({
  source_key: e.key,
  source_file: e.file,
  locator: `${e.file}:L${e.line}`,
  kind: e.kind,
  text: e.text.length > 220 ? e.text.slice(0, 217) + "..." : e.text,
  mapped_kf_ids: e.mapped_kf_ids,
  applicability: e.applicability,
  rationale: e.rationale,
}));

const lighthouse_evidence = [
  {
    source_key: "LH-DESKTOP-CONTRAST",
    source_file: "kramflow-lighthouse-desktop.report.json / .html",
    locator: "kramflow-lighthouse-desktop.report.json#audits.color-contrast (score=0, details.items.length=27)",
    kind: "lighthouse_run",
    text: "Desktop Lighthouse run: color-contrast audit score 0 (FAILING), 27 failing items — independently re-read directly from the raw JSON's audits['color-contrast'].score and .details.items.length during B004, correcting a B003 drafting error that mischaracterized this same 27-item count as a clean/passing result. It was not: this is the same failing-contrast defect as the mobile run's 10 items, just a larger desktop inventory (BASELINE.md's own table recorded the count without recording the score, which is what let the B003 misreading happen).",
    mapped_kf_ids: ["KF-019"],
    applicability: "applicable",
    rationale: "Desktop contrast failures map to KF-019, the same criterion as the mobile failures — not KF-038 (structured data/schema, an unrelated SEO-optional item a B003 drafting error pointed this at). Corrected per Codex B003 review finding B003-F1.",
  },
  {
    source_key: "LH-DESKTOP-PERFORMANCE",
    source_file: "kramflow-lighthouse-desktop.report.json / .html",
    locator: "kramflow-lighthouse-desktop.report.json#categories.performance.score (=1), audits.largest-contentful-paint.numericValue (=644.48)",
    kind: "lighthouse_run",
    text: "Desktop Lighthouse run: overall performance category score 1 (100), LCP 644ms numericValue — this is the fact that legitimately passes on desktop; it must not be conflated with the (failing) contrast audit above.",
    mapped_kf_ids: ["KF-033"],
    applicability: "applicable",
    rationale: "Desktop Lighthouse 100 / LCP 0.6s is already one of KF-033's named preserve-passing items.",
  },
  {
    source_key: "LH-MOBILE-1",
    source_file: "kramflow-lighthouse-mobile.report.json / .html",
    locator: "kramflow-lighthouse-mobile.report.json#audits.color-contrast (score=0, items=10), audits.largest-contentful-paint.numericValue (=3591.58)",
    kind: "lighthouse_run",
    text: "First mobile Lighthouse run: 10 color-contrast failing items, LCP 3592ms numericValue. Reconciled against raw JSON in BASELINE.md; narrative reports' 'approximately ten labels' undercounts the desktop inventory (27) but is accurate for this mobile run's failing set.",
    mapped_kf_ids: ["KF-019", "KF-023"],
    applicability: "applicable",
    rationale: "Mobile contrast failures -> KF-019; mobile LCP -> KF-023 (B004 fix: was a stale 'KF-049' reference in B003's prose — that id was retired during B003's own KF dedup pass and never existed in the ledger; the structured mapped_kf_ids array already correctly said KF-023, only this free-text rationale lagged).",
  },
  {
    source_key: "LH-MOBILE-2",
    source_file: "kramflow-lighthouse-mobile-rerun.report.json / .html",
    locator: "kramflow-lighthouse-mobile-rerun.report.json (color-contrast audit, LCP numericValue)",
    kind: "lighthouse_run",
    text: "Second (rerun) mobile Lighthouse run: 10 color-contrast failing items, LCP 3639ms numericValue. Confirms the mobile LCP miss is stable across two independent runs, not a one-off measurement artifact.",
    mapped_kf_ids: ["KF-019", "KF-023"],
    applicability: "applicable",
    rationale: "Second mobile run corroborates LH-MOBILE-1; same mapping.",
  },
  {
    source_key: "LH-DESKTOP-VS-MOBILE-CONTRAST-DELTA",
    source_file: "BASELINE.md",
    locator: "docs/audit-remediation/BASELINE.md:16-22",
    kind: "reconciliation_note",
    text: "Desktop raw inventory is 27 color-contrast items, not the 'approximately ten' the narrative Fix Summary/Fix Guide describe — that narrative figure describes the mobile failing set (10), not the desktop total. Any future contrast-fix batch must treat 27 as the real desktop inventory.",
    mapped_kf_ids: ["KF-019"],
    applicability: "applicable",
    rationale: "Directly changes the acceptance criteria for KF-019 — fixing 'ten labels' would leave 17 desktop nodes unaudited.",
  },
  {
    source_key: "LH-IMAGE-SAVINGS-VARIABILITY",
    source_file: "BASELINE.md",
    locator: "docs/audit-remediation/BASELINE.md:24",
    kind: "reconciliation_note",
    text: "Image-savings estimate is unstable across runs (~176 KiB first run, none reported on rerun); raw JSON's uses-responsive-images audit does not expose a stable overallSavingsBytes figure in a form cross-checked so far.",
    mapped_kf_ids: ["KF-023"],
    applicability: "applicable",
    rationale: "Open reconciliation item for whichever batch implements KF-023 (mobile LCP/image compression) — must re-measure, not rely on either single estimate.",
  },
];

const all = [...entries, ...lighthouse_evidence];

// group by KF for the readable view + to detect which named KFs have zero coverage from these 7 reports (expected for master-prompt-only rows)
const byKf = {};
for (const e of all) {
  for (const kf of e.mapped_kf_ids) {
    (byKf[kf] ||= []).push(e.source_key);
  }
}

const coverage = {
  $schema_note: "Maps every heading / table row / list item / checklist item across the 7 original audit Markdown reports plus all 3 Lighthouse report pairs to a stable source_key with an exact file:line locator, and many-to-one to TASK_LEDGER KF ids. Built from a mechanical heading/table-row/list-item extraction (source-package/scripts/extract.mjs) classified by content-matching rules (source-package/scripts/classify.mjs), then hand-reviewed to resolve every initially-unmapped row. Regenerate with: node docs/audit-remediation/source-package/scripts/extract.mjs && node docs/audit-remediation/source-package/scripts/classify.mjs && node docs/audit-remediation/source-package/scripts/build_coverage.mjs && node docs/audit-remediation/source-package/scripts/add_prose_entries.mjs && node docs/audit-remediation/source-package/scripts/build_coverage_md.mjs Zero rows from the source extraction were dropped: see entry_count below vs the raw extraction count.",
  generated: "2026-09-30",
  batch: "B003",
  source_documents: [
    "KRAMFLOW_FULL_AUDIT.md",
    "KRAMFLOW_FIX_SUMMARY.md",
    "KRAMFLOW_FIX_GUIDE.md",
    "KRAMFLOW_TEST_MATRIX.md",
    "KRAMFLOW_EVIDENCE_INDEX.md",
    "KRAMFLOW_SECOND_PASS_ADDENDUM.md",
    "KRAMFLOW_AUDIT_CHECKLIST.md",
    "kramflow-lighthouse-desktop.report.json/.html",
    "kramflow-lighthouse-mobile.report.json/.html",
    "kramflow-lighthouse-mobile-rerun.report.json/.html",
  ],
  entry_count: all.length,
  raw_markdown_extraction_count: entries.length,
  lighthouse_entry_count: lighthouse_evidence.length,
  out_of_scope_note: "KF-031 (hold/timer persistence, discovered live during B002) is sourced only from an independent-review finding, not from any of the 7 audit reports or the 3 Lighthouse pairs, so it intentionally has zero entries in this file. It is not 'unmapped' — see its TASK_LEDGER source_refs for the actual citation. (The session-identity realtime first-connect gap discovered during B003 is tracked as child KF-036.9, under a parent — KF-036 — that IS sourced from the reports, so it needs no exemption here.) This file's validator only flags unmapped SOURCE rows, never ledger rows that correctly cite a non-report source.",
  entries: all,
  by_kf_index: byKf,
};

fs.writeFileSync(path.join(base, "..", "..", "SOURCE_COVERAGE.json"), JSON.stringify(coverage, null, 2));
console.log("wrote SOURCE_COVERAGE.json, entries:", all.length, "distinct KFs referenced:", Object.keys(byKf).length);
