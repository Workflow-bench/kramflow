# CB-DESIGN evidence index

Paths are relative to the repo root. Raw captures are kept as produced. Nothing here is a self-approval.

| Path | Content | Status |
|---|---|---|
| `batches/CB-DESIGN/BATCH_REPORT.md` | Batch report: original matrix 1–15, crosswalk, gates, open items | Current |
| `batches/CB-DESIGN/TEST_RESULTS.json` | Machine-readable gates, performance runs, package statuses | Current |
| `evidence/CB-DESIGN/after-batch3/lighthouse/` | Final mobile and desktop simulated Lighthouse runs (raw JSON) and `summary.json` | Raw, final tree before commit |
| `evidence/CB-DESIGN/after-batch3/browser/` | Screenshots at five viewports (landing, login, signup, reset, set-password), `browser-report.json`, `capture-and-check.cjs` | Raw, production build on port 3959 |
| `evidence/CB-DESIGN/focus-harness/` | Real Modal and ConfirmDialog harness (`harness-entry.tsx`, bundled `harness.js`, `index.html`, `process-shim.js`), scenario runner `run-focus-cleanup.cjs`, output `cleanup-results.json` | Raw; reproduce with `esbuild` bundle then `NODE_PATH=$PWD/node_modules node run-focus-cleanup.cjs` |
| `evidence/CB-DESIGN/perf-probe/` | Controlled LCP diagnostics: rebuild script, throttled timeline script, probes, controls (static HTML, landing copy with and without scripts, truncated document, blocked resources) | Diagnostic only; not the target series |
| `evidence/CB-DESIGN/after-batch2/`, `after-batch1/`, `lighthouse-after-batch1/` | Earlier captures and Lighthouse runs | Historical; not matched to this batch |

External Codex reviews remain in `/Users/deeppatel/Documents/Codex/2026-09-30/referenced-chatgpt-conversation-this-is-an/outputs/` and are not copied here.
