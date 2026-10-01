# Baseline

## Environment

- Repository: `/Users/deeppatel/Documents/AI/Shibir/stageflow`
- Branch: `fix/audit-remediation-phase1`
- Base commit (before any remediation work): `e39cc830c83f6bf4e2a5afe499bf32e009721260` (was `main`/`origin/main` at the time; confirmed `git merge-base --is-ancestor` both directions)
- Audited baseline commit (from the ZIP): `02669143dcd7677efb7c6ed83bc7b23d056780a6` — 24 commits behind the base above; none of those 24 touch any file this project's batches change (checked via `git log --oneline 0266914..e39cc83 -- <files>` before editing anything, both in B001 and again for B002)
- Dev Supabase project: `qofggbarsdiovzqwgkpz.supabase.co` — a non-production dev/test project (seed scripts, `.test`-TLD demo accounts, "Northwind Summit 2026" placeholder event data). Used for live verification in both B001 and B002 with the user's prior explicit engagement (password reset on `demo1@kramflow.test` was requested and performed in the conversation immediately preceding B001).
- Package: `KRAMFLOW_AUDIT_PACKAGE.zip`, sha256 `0cee90139ca628b05baaae31f066f811344db71cb4a11e8544ea6d9198f42ad7` — see `PACKAGE_MANIFEST.json`.

## Reconciling the audit's Lighthouse evidence (per master prompt §1)

Verified directly against the raw JSON in the package, not assumed from the summary reports:

| Run | `color-contrast` item count | LCP (numericValue) |
|---|---|---|
| Desktop | **27** | 644 ms |
| Mobile (first) | 10 | 3592 ms |
| Mobile (rerun) | 10 | 3639 ms |

The Fix Summary/Fix Guide's "approximately ten labels" undercounts the desktop raw inventory by 17 nodes. Any future contrast-fix batch (Phase 4, not this batch) must treat the desktop 27 as the real inventory, not the ten repeated across the narrative docs. Recorded here per the master prompt's explicit instruction; **not fixed in B002** — out of this batch's scope (Phase 1 security only).

Image-savings variability (first mobile run ≈176 KiB estimated hero savings; rerun reported none) is real per the narrative reports; the raw JSON's `uses-responsive-images` audit does not expose a stable `overallSavingsBytes` figure in either run in a form this batch cross-checked further. Recorded as an open reconciliation item for whichever future batch does mobile performance (master prompt item 23) — not investigated further here, since it is unrelated to Phase 1 security scope.

## Batch history

- **B001** (this repo's first remediation pass; implemented before this project's own `TASK_LEDGER`/`BASELINE`/`DECISIONS` artifacts existed — corrected in B003, see `DECISIONS.md` §"B001/contract timeline correction": the master prompt document itself predates B001, it just hadn't yet been turned into these tracking files at that point): implemented KF-001 (hold/timer owner floor — speaker-ready deliberately left at viewer), KF-002 (must_change_password on the two shared guards — invite-accept left unchecked, incorrectly reasoned as an exception), KF-003 (External API credential creation disabled; the v1 actions/[action] route itself was left unchanged). Self-verified only (262 tests, tsc, lint, build; one live browser check per KF). No independent review existed yet at that point.
- **Independent review** (`REVIEWS/2026-09-30_KRAMFLOW_CODEX_PHASE1_REVIEW.md`): HOLD / NEEDS_REWORK. Confirmed B001's automated checks pass, found B001's disposition claims plausible in scope but incomplete: speaker-ready still viewer-writable (R1), invite-accept still bypassable (R2), existing credentials still reach the v1 actions route despite "Coming Soon" framing, with a real (if owner-gated) path to satisfy the lease via a caller-supplied `clientId` (R3), and the ledger/evidence contract from the newly-introduced master prompt wasn't in place yet (R4).
- **B002** (this batch): reworks R1/R2/R3 per the review, plus the R4 ledger/evidence contract this file is part of. Detailed below and in `TASK_LEDGER.md`/`TASK_LEDGER.json`.

## Known open, not-fixed-here findings

### Hold/timer missing-row false-success / deactivation failure

Reproduced live in B001 against the dev Supabase project (event `0fe1ce24-5cae-4365-9489-540cf385a87b`, display_type `presenter`): `PATCH /api/display-engine/hold {active:true}` → `200 {ok:true}`; the immediately following `{active:false}` → `500`, Postgres `PGRST116` ("The result contains 0 rows"). The independent review (per its "Hold missing-row finding" section) confirms this is **consistent with pre-existing source behavior**, not something either remediation batch introduced: activation is a plain `.update().eq().eq()` with no `.select()` (can silently match zero rows and still report success), while deactivation requires an existing row via `.single()` (fails loudly if none exists). The review notes the exact database row absence was not independently queried — it is corroborated by source-code reading, not a confirmed live database query from the reviewer's side.

**Status: OPEN, not fixed in B001 or B002.** Priority: P2 (data-integrity correctness bug, not an authorization gap — both B001 and B002's live owner/viewer/editor matrix tests for hold prove the *authorization* boundary is correct regardless of this issue; this bug affects whether a legitimately-authorized owner's action actually persists). Dependency: none blocking B002; should be scheduled before Hold/Timer ever gets real UI wiring (currently zero call sites in `app/`/`components/` — grep-confirmed in B001 and re-confirmed unchanged in B002), since a UI that trusts this endpoint's `200` as ground truth would show a false "Hold activated" state. A future fix must choose one of: (a) deterministic initialization of `display_type_state` rows for all four display types at event-creation time, or (b) make both activate and deactivate fail loudly (return an error, not `200`) when no row exists, and verify via a database readback after write rather than trusting the write call's own reported success. Out of scope for B002 per the review's explicit instruction not to fold this into Phase 1 security code.

## Master-prompt scope rows not started by any batch yet

Tracked as their own ledger rows (`TASK_LEDGER.md`) rather than silently omitted — dependency/SheetJS direct-version review, rate-limit/secrets/build-artifact scanning, authenticated app performance and offline/reconnect/controller/burst/soak testing, staging/rollback parity, footer/loading/error/print-output sweeps, and every remaining PASS/conditional checklist row the original seven reports and both Lighthouse runs contain. None of these were investigated in B002 — this batch's authorized scope is the Phase 1 security rework (R1–R3) plus the R4 ledger/evidence contract itself.
