# Vendored audit source package

The 7 original Markdown reports and the 3 raw Lighthouse JSON reports from
`KRAMFLOW_AUDIT_PACKAGE.zip` (see `../PACKAGE_MANIFEST.json` for the zip's own
sha256 and each member's sha256), vendored here so `SOURCE_COVERAGE.json`'s
locators and raw-value claims can be independently re-verified by anyone who
clones this repo — not just by someone who still has the original zip.

The 3 Lighthouse `.html` reports are **not** vendored (they're large,
human-viewing-only duplicates of the `.json` reports' data; nothing in this
project's tooling reads them). Verify any of the 10 files here against the
manifest at any time:

```bash
shasum -a 256 docs/audit-remediation/source-package/*.md docs/audit-remediation/source-package/*.json
```

## `scripts/`

The generator pipeline that builds `../SOURCE_COVERAGE.json` and
`../SOURCE_COVERAGE.md` from these vendored files, plus the content-matching
rules that classify every row to a `TASK_LEDGER.json` KF id. Regenerate from
a clean checkout with:

```bash
node docs/audit-remediation/source-package/scripts/extract.mjs
node docs/audit-remediation/source-package/scripts/classify.mjs
node docs/audit-remediation/source-package/scripts/build_coverage.mjs
node docs/audit-remediation/source-package/scripts/add_prose_entries.mjs
node docs/audit-remediation/source-package/scripts/add_excerpts.mjs   # must run after build_coverage.mjs: binds exact excerpts + sha256
node docs/audit-remediation/source-package/scripts/build_coverage_md.mjs
node docs/audit-remediation/validate_ledger.mjs                           # manifest hashes, excerpt digests, Lighthouse pointers, locators, ledger totals
# negative tests for the integrity checks: npx vitest run docs/audit-remediation/validate_ledger.test.ts
```

`extract.mjs`'s and `classify.mjs`'s own intermediate JSON output
(`extracted.json`, `classified.json`, `unmapped.json`) is gitignored — fully
derived from the files above, regenerate rather than diff them.
