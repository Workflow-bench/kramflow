# B007 independent review

**Decision: HOLD / PARTIAL; accept narrow supported progress and continue grouped repairs.** Reviewed final HEAD `31920c2fbd2436c765a5aa76a49ee73c68027811`, including checkpoint changes since `c67d0f34097b6635884d1dbcaf1d94b70192d039`. Final documentation commit follows code checkpoint `71b7944`. No app edits, shared migrations, remote account operations, deploy or push.

## Independent verification

- Vitest **418/418, 40 files**, ledger validator, normal production build and sequential nonincremental typecheck PASS at final HEAD.
- Lint **0 errors/6 existing warnings**.
- Supplied nine-scenario SQL suite independently PASS in a freshly initialized disposable Postgres cluster on a temporary Unix socket; cluster stopped afterward. Schema mirror tests are local transactional evidence, not applied Supabase/RLS/trigger proof.
- Independently reproduced the sparse-workbook defect below using installed SheetJS and an in-memory generated workbook.
- No independent authenticated browser, Lighthouse rerun or real-device testing in this review. B007 browser/contrast/LCP numbers remain implementer-reported observations. The checked-in bundle contains narrative measurements but no new raw Lighthouse runs/traces, full contrast inventory or indexed B007 screenshot files; original audit reports and B005 screenshots do not substitute for B007 evidence.

## Standards

**B007-S1 — P2: live Start can still succeed with no current item.** `app/api/live/route.ts:93` only requires some program, then Start writes `currentOrder:1` at line 272. Imported program validation allows zero/noncontiguous sort orders. A session containing only order 0 or 2 passes the new runnable check but has no order-1 item. Normalize/reject invalid ordering at the import boundary or make the actual start/navigation model support it consistently. Test real handler behavior for these inputs and no mutation on refusal.

**B007-S2 — P2: simultaneous first imports can select the same global ID.** Migration at `20260930000000_import_cue_sheet_atomic.sql:74–79` performs a free-ID read before later insert. Two independent events can both choose the same previously unused raw slug; the global PK rejects one. This is a source-established allocation race, not independently reproduced concurrency in this review. Use collision-safe deterministic event identity for new rows or serialize/retry allocation while preserving existing references. The 8-character hash is not a guarantee of uniqueness; ensure distinct source IDs cannot resolve to one destination. Add concurrent first-import tests and deliberate destination collisions.

**B007-S3 — P2, unfinished criterion: Timer misses existing-event initialization.** Timer still reads a missing type-state row with `.single()` before any provisioning. New event creation and Hold calls repair rows, but an older event's first Timer operation still fails. Preserve Hold's accepted repair; complete/test Timer's missing-row behavior before closing combined KF-031. A loud failure is preferable to silent success, but is not automatic initialization.

**B007-S4 — P2, remaining runner defect: retries conflate persistence with change.** `fixtures/owner_floor_live_matrix.mjs:621–624` still requires every owner operation to alter the snapshot. An already-ready speaker or already-selected timer mode can legitimately produce the intended state without changing it. Cookie environment input is now executable, but this does not close repeatable matrix evidence. Reconcile owned fixtures, assert exact intended state, prove denied nonmutation and require readback for full persistence claims. No remote run commissioned by this review.

Accepted at source/test level: ordinary sequential repeated-workbook mapping and partition/session remapping, tenant/payload guards and transaction rollback, confirmed logout helper, strengthened safe redirect parsing, password toggles, generic reset-request API, explicit import choice UI plumbing, Hold missing-row provisioning/row-result validation and new-event type-state provisioning. Actual workflows remain separately unverified. B006-S1 and F1 have materially progressed; retain their remaining concurrency/workflow debt instead of redoing passing work.

## Spec

**B007-F1 — P1: sparse oversized XLSX silently loses data.** Both `lib/parse-cuesheet.ts:344–354` and `lib/server/document-text.ts:39–49` bound decoding with `sheetRows:5001`, then validate truncated `!ref`. Independent input A1 + A6000, original range A1:A6000, yields `!ref=A1`, `!fullref=A1:A6000` and no A6000 after bounded reading. Current range check sees one row and accepts; late data is omitted. Validate original `!fullref ?? !ref` and test both readers with sparse oversized files. Keep bounded decoding and generic rejection; dense boundary tests alone are insufficient.

**B007-F2 — P2: recovery error and continuation paths are incomplete.** Callback failures send users to bare login, dropping safe continuation and explaining neither expired nor reused links. Set-password reauthentication failure likewise discards `next`. Test request → exchange → replacement → reauthentication fallback with fake provider/session seams and controlled rendering. Preserve safe destinations and generic recovery-error/new-link guidance. New request-only tests do not prove completion.

**B007-F3 — P2, evidence gap: reported visual/performance results are not reproducible from the bundle.** Preserve raw new Lighthouse JSON/traces, exact commands/config/build IDs and contrast rows/viewport evidence in an index. Current narrative correctly disclaims timing improvement but cannot independently establish 27→0 contrast failures, excluded text, LCP candidate or preload measurements. Verify accessibility-tree duplicate behavior with the actual accessible tree/hidden flags; computed visibility alone does not settle the original finding. Do not invent missing artifacts or rescore old results.

**Remaining partial scope:** CSP is Report-Only with unsafe-inline/eval and no collection destination; this is preparation, not completed nonce/hash policy, central monitoring or enforcement. Invitation robots disallow prevents crawlers reading its noindex; reconcile policy without claiming access control/index removal. First-connect KF-036.9 is located but lacks a deterministic local reproduction/fix. ZIP decompression budgets, login context, preload waste, measured JS work and hero contrast remain locally actionable. Monitoring/SheetJS reporting can have a provider-neutral tested adapter while external delivery awaits provider choice. Legal outline, operational plans and owner decisions are preparation, not completed provider/legal verification.

No whole-parent CODEX_VERIFIED promotions granted. Record narrow accepted evidence separately from original ZIP row coverage, parent totals and child criteria. The next prompt scopes grouped remaining repairs and reproducible local evidence, preserving all external authorization boundaries.

Standards: four remaining actionable/unfinished criteria. Spec: three findings, highest P1 silent spreadsheet truncation. Whole-app launch status remains HOLD.
