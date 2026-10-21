# KramFlow B004 independent review

**Decision: HOLD / PARTIAL.** Reviewed `c8e855ee05ae0415252c160a52a25543907f23ae` against base `c6f3b9002ef5fcc825548f5493ee5b4bd2536ad4`. Review-only: no application changes, remote fixture operations, account provisioning or deployment.

## Independent verification

At the stated HEAD: Vitest **341/341**, lint **0 errors / 6 existing warnings**, standard Turbopack production build **PASS**, sequential `tsc --noEmit --incremental false` **PASS**, ledger validator **PASS**. Ten vendored report files match their manifest SHA-256 values. These checks prove the tested code/build and current archive integrity; they do not prove browser behavior or remote authorization/persistence. Two independent review lenses examined standards and specification coverage.

## Standards findings

**B004-S1 — P2: broadcast fixture cannot satisfy the checked-in schema.** `docs/audit-remediation/fixtures/owner_floor_live_matrix.mjs:253` inserts event/title/type/status but omits `message` and `target`. Both are NOT NULL with no default in `supabase/migrations/20260909091731_schema_base.sql:402`; subsequent migrations add event scope but no defaults for those columns. On that schema, setup fails after creating the display row. The fake insert at `owner_floor_live_matrix.test.ts:208` accepts any fields, masking the failure. Supply a valid bounded broadcast payload and validate fixture tests against relevant real schema constraints. Remote schema drift was not inspected; an undocumented remote default must not be assumed.

**B004-S2 — P2: recovery is not resumable after intermediate successful writes.** Fixture lines 248–257 create display and broadcast before persisting either ID. A broadcast failure leaves state at `collaborators_created`; retry reinserts a display and violates UNIQUE(event_id,display_type). Collaborator insertion followed by state-save failure at 229–238 similarly retries a plain insert. Save/reconcile individual resource progress, including the window between remote success and local save. The report's claim of a save after every single write is false. Tests must enforce relevant uniqueness and inject failures after each successful write, not just the first event save. `display_type_state.id` itself is valid: its migration declares an identity primary key.

**B004-S3 — P2: runtime procedure remains incomplete.** `runMatrix` at 322–349 samples Hold status for owner/editor/viewer only; no timer, speaker-ready, real-broadcast dismiss or independent persistence readback. CLI `run` cannot supply the session seam and always hits the default throw. Failed expectations merely produce `pass:false` and would still exit successfully. Either finish a concrete securely supplied runner or provide the executable bounded alternative allowed by the previous prompt. Require failing exit on failed assertions, complete fixture state, approved destination validation before sending cookies, and sanitized before/after proof. No remote execution is requested by this review.

## Specification findings

**B004-F1 — P2: source-content integrity safeguard is incomplete.** `validate_ledger.mjs:158–192` verifies file existence and line bounds only. It does not check manifest hashes or bind source excerpts to referenced lines. Current vendored files match independently, so this is not observed corruption. Add immutable exact excerpt/digest evidence separate from editorial summaries and validate that evidence plus member hashes. Deliberate altered content at a valid line range must fail.

**B004-F2 — P2: new acceptance criteria invent an operational dependency.** `TASK_LEDGER.json:469,628` says monitoring/backup criteria cannot be independently satisfied and requires an injected/observed restore failure to be monitored. Original Fix Guide line 220 asks for a backup restore drill **and** a monitored test exception. Require both independently; a combined exercise may be optional, not an invented launch gate.

## Item verdicts and accepted progress

| B004 item | Verdict | Evidence and remaining work |
|---|---|---|
| 1 fixture safety | PARTIAL | Parsed exact Supabase allowlist and checked cleanup/recovery retention accepted at source/unit level. S1–S3 prevent completion. No remote run. |
| 2 Dismiss accessibility | PARTIAL | Visible nonowner explanation, owner focus ring and polite toast live-region markup accepted at source level. No rendered desktop/mobile/keyboard or assistive-tech evidence. Markup alone cannot prove announcement behavior. |
| 3 coverage/ledger | PARTIAL | Lighthouse desktop FAIL/27 mapping, prose coverage additions, KF-006 obligations, KF-004 metric qualification and KF-036.9 tracking accepted. F1–F2 remain. Current validator passes but lacks required content-integrity protection. |
| 4 flagged-account runtime | UNVERIFIED | Permission remains pending; no retry authorized or performed. |

KF-002 live-runtime, KF-031 hold/timer persistence and KF-036.9 first-connect remain open. No new application regression was established by source/build checks; browser, security runtime and performance behavior were not independently exercised. No whole-item CODEX_VERIFIED promotion is granted. Accept the listed narrow source corrections without repeating them in subsequent batches.

Next action: use `KRAMFLOW_CLAUDE_B005_PROMPT.md`; finish the remaining local correction/evidence work, preserve remote permission boundaries, and pause again for independent review.
