import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(__dirname, "..");
const files = [
  ["FA", "KRAMFLOW_FULL_AUDIT.md"],
  ["FS", "KRAMFLOW_FIX_SUMMARY.md"],
  ["FG", "KRAMFLOW_FIX_GUIDE.md"],
  ["TM", "KRAMFLOW_TEST_MATRIX.md"],
  ["EI", "KRAMFLOW_EVIDENCE_INDEX.md"],
  ["SP", "KRAMFLOW_SECOND_PASS_ADDENDUM.md"],
  ["CL", "KRAMFLOW_AUDIT_CHECKLIST.md"],
];

const out = [];
let currentHeading = "";
for (const [prefix, fname] of files) {
  const text = fs.readFileSync(`${dir}/${fname}`, "utf8");
  const lines = text.split("\n");
  currentHeading = "";
  for (let i = 0; i < lines.length; i++) {
    const ln = i + 1;
    const line = lines[i];
    const trimmed = line.trim();
    if (/^#{1,3}\s/.test(trimmed)) {
      currentHeading = trimmed.replace(/^#+\s*/, "");
      out.push({ key: `${prefix}-L${ln}`, file: fname, line: ln, kind: "heading", heading: currentHeading, text: currentHeading });
      continue;
    }
    // table row (skip separator rows of ---)
    if (/^\|/.test(trimmed) && !/^\|[\s:|-]+\|$/.test(trimmed)) {
      out.push({ key: `${prefix}-L${ln}`, file: fname, line: ln, kind: "table_row", heading: currentHeading, text: trimmed });
      continue;
    }
    // bullet or numbered list item
    if (/^[-*]\s+/.test(trimmed) || /^\d+\.\s+/.test(trimmed) || /^\[[ x]\]/.test(trimmed) || /^- \[[ x]\]/.test(trimmed)) {
      out.push({ key: `${prefix}-L${ln}`, file: fname, line: ln, kind: "list_item", heading: currentHeading, text: trimmed });
      continue;
    }
  }
}
fs.writeFileSync(path.join(__dirname, "extracted.json"), JSON.stringify(out, null, 2));
console.log("total entries:", out.length);
const byFile = {};
for (const o of out) byFile[o.file] = (byFile[o.file]||0)+1;
console.log(byFile);
