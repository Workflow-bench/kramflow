import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const docsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const cov = JSON.parse(fs.readFileSync(path.join(docsDir, "SOURCE_COVERAGE.json"), "utf8"));
const ledger = JSON.parse(fs.readFileSync(path.join(docsDir, "TASK_LEDGER.json"), "utf8"));

const kfTitle = {};
for (const item of ledger.items) {
  kfTitle[item.id] = item.desired_behavior ? item.desired_behavior.slice(0, 70) : item.id;
}

let md = `# Source Coverage — readable view\n\n`;
md += `Machine-readable source lives in \`SOURCE_COVERAGE.json\` (${cov.entry_count} entries: ${cov.raw_markdown_extraction_count} headings/table-rows/list-items from the 7 Markdown reports + ${cov.lighthouse_entry_count} from the 3 Lighthouse report pairs / BASELINE.md reconciliation notes${cov.prose_paragraph_entry_count ? ` + ${cov.prose_paragraph_entry_count} prose Wrong/Why/Fix/Acceptance paragraphs from KRAMFLOW_FIX_GUIDE.md` : ""}). This file is the human-readable index into it, grouped by KF id.\n\n`;
md += `${cov.out_of_scope_note}\n\n`;
md += `## Coverage by KF id\n\n`;

const byKf = cov.by_kf_index;
const kfIds = Object.keys(byKf).sort((a, b) => {
  const [pa, ca] = a.split(".");
  const [pb, cb] = b.split(".");
  const na = parseInt(pa.split("-")[1]), nb = parseInt(pb.split("-")[1]);
  if (na !== nb) return na - nb;
  return (parseInt(ca || 0)) - (parseInt(cb || 0));
});

for (const kf of kfIds) {
  const keys = byKf[kf];
  md += `### ${kf}\n\n`;
  md += `${keys.length} source key(s): ${keys.slice(0, 40).join(", ")}${keys.length > 40 ? ", ..." : ""}\n\n`;
}

md += `## Entries with zero KF mapping (structural rows only — headings, legends, document titles, methodology bullets)\n\n`;
const structural = cov.entries.filter(e => e.mapped_kf_ids.length === 0);
md += `${structural.length} such entries exist, all validated by \`validate_ledger.mjs\` to carry an exempting rationale (section heading / table header / legend / methodology / document title / process checkbox). Full list in \`SOURCE_COVERAGE.json\`.\n\n`;

fs.writeFileSync(path.join(docsDir, "SOURCE_COVERAGE.md"), md);
console.log("wrote SOURCE_COVERAGE.md");
