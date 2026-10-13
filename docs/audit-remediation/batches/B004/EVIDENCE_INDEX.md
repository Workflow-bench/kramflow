# B004 Evidence Index

| Claim | Evidence class | Where |
|---|---|---|
| Fixture URL guard rejects every lookalike the review named (suffix host, host embedded in path/query, userinfo, wrong port, malformed URL) before reading any secret | TEST (pure function, no I/O) | `fixtures/owner_floor_live_matrix.test.ts` — `assertAllowedProjectUrl` describe block, 12 cases |
| Fixture setup is resumable and idempotent — re-running after 'complete' creates no second event; resuming from a partial 'event_created' state reuses the existing event | TEST (fake db/fs) | `fixtures/owner_floor_live_matrix.test.ts` — `runSetup` describe block |
| A remote write that succeeds but whose state-save fails is reported as its own distinct, recoverable error — not hidden, not rolled back | TEST (fake fs throwing mid-write) | `fixtures/owner_floor_live_matrix.test.ts` — "reports a distinct recoverable error..." |
| Cleanup re-validates ownership against the database row itself, refusing to delete a tampered/foreign event | TEST (fake db with a mismatched row) | `fixtures/owner_floor_live_matrix.test.ts` — `verifyFixtureOwnership` + `runCleanup` describe blocks |
| Cleanup survives a partial failure and successfully retries once the issue is resolved | TEST (fake db failing once on command) | `fixtures/owner_floor_live_matrix.test.ts` — "retries cleanly..." |
| Non-owner Dismiss explanation is now always-visible text, not a disabled-button+tooltip pattern unreachable by keyboard focus | SOURCE (code) | `components/display-engine/broadcast-overlay.tsx` |
| Owner's enabled Dismiss button carries the canonical focus-visible ring | SOURCE (code) | `components/display-engine/broadcast-overlay.tsx` |
| Toast container has live-region semantics (`role="status" aria-live="polite"`) | SOURCE (code) | `components/ui/toast.tsx` |
| Desktop color-contrast is correctly classified as FAILING (score 0, 27 items), not passing | TEST (validator re-reads the raw vendored JSON directly) | `docs/audit-remediation/source-package/kramflow-lighthouse-desktop.report.json#audits.color-contrast`; `validate_ledger.mjs`'s raw-audit-agreement check (section 10) passes against this exact file |
| Desktop contrast maps to KF-019; desktop performance (the fact that actually passes) maps to KF-033 | SOURCE (ledger) | `SOURCE_COVERAGE.json#LH-DESKTOP-CONTRAST,LH-DESKTOP-PERFORMANCE` |
| No stale `KF-049` references remain in `SOURCE_COVERAGE.json` | TEST (grep) | `grep -n "KF-049" docs/audit-remediation/SOURCE_COVERAGE.json` returns only the corrective explanatory text naming the retired id, never a live mapping |
| FIX_GUIDE's prose Wrong/Why/Fix/Acceptance paragraphs are now represented, with exact line ranges | SOURCE (ledger) | `SOURCE_COVERAGE.json` — 22 entries, `kind: "prose_paragraph"`, `source_file: "KRAMFLOW_FIX_GUIDE.md"` |
| `FG-L220`'s compound obligation (backup drill + monitored test exception) maps to both KF-014 and KF-010 | SOURCE (ledger) | `SOURCE_COVERAGE.json` reverification-step-8 entry; `TASK_LEDGER.json#KF-014,KF-010` cross-reference acceptance criteria |
| `KF-006`'s acceptance criteria retain every obligation from master#13 (multi-session choice, transactional scope, RPC authorization/search_path, generic errors, foreign-id rejection, rollback) | SOURCE (ledger) | `TASK_LEDGER.json#KF-006` |
| `KF-004` no longer implies inventable hold/alert/overrun metrics | SOURCE (ledger) | `TASK_LEDGER.json#KF-004` |
| Session-identity realtime first-connect gap has its own stable, checkable, OPEN ledger row | SOURCE (ledger) | `TASK_LEDGER.json#KF-036` — child `KF-036.9` |
| Every line-based `SOURCE_COVERAGE.json` locator resolves against a real, vendored, checksum-verified source file | TEST (validator reads the vendored files directly) | `validate_ledger.mjs` section 9; `docs/audit-remediation/source-package/*.md` |
| The vendored source-package files are byte-identical to the original package | TEST (sha256) | `shasum -a 256 docs/audit-remediation/source-package/*.md docs/audit-remediation/source-package/*.json` matches `PACKAGE_MANIFEST.json`'s recorded hashes exactly |
| No duplicate source keys, no parent/child id collisions, no empty acceptance criteria on an open item, `by_kf_index` matches a fresh recomputation | TEST (self-check) | `validate_ledger.mjs` sections 8, 2, 11, 12 — all pass |
| Repository quality gates | TEST | `TEST_RESULTS.json#repository_checks` — 341/341 tests, tsc clean, lint 0 errors/6 warnings, standard Turbopack build clean (reproduced twice), sequential post-build typecheck clean |

No `.env`, cookie, secret-credential, production export, or private event data is included anywhere in this directory or referenced files. No live Supabase session, account, or data was created, read, or deleted in this batch.
