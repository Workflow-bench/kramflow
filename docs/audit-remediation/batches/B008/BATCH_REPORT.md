# B008 Batch Report: grouped correctness repairs (partial, honest)

Input: `REVIEWS/2026-09-30_KRAMFLOW_CODEX_B007_REVIEW.md` (verbatim). Base: `31920c2`. Intervening-work check: tree clean, HEAD matched the base, and no checkpoint was rewritten.

Code revision verified: **`a8ed41c`** (build, typecheck, lint, tests, ledger). This report commit cites that revision and changes no code.

Scope status: this batch closes the P1 and two of the P2 items. It does not complete the B008 bundle. Most items remain open and are listed in section 4 rather than marked done.

## 1. Verification at `a8ed41c`

| Check | Result |
| --- | --- |
| `npm run build` | exit 0 |
| `npx tsc --noEmit` | exit 0 (sequential, after the build) |
| `npm run lint` | exit 0, 0 errors, 6 warnings (the same 6 as B007: five hard-navigation rules, one in untracked `brag-output/`) |
| `npx vitest run` | 42 files, 431 tests, passing |
| `validate_ledger.mjs` | PASS |
| Local SQL, `import_cue_sheet` | not rerun in this batch; the migration was unchanged |

## 2. Criteria addressed

Status key: **FIXED-LOCAL** (code change plus tests that run at the revision above), **PARTIAL**, **OPEN** (not started or not in this batch), **EXTERNAL** (needs a provider, dashboard, live project, or owner).

### B007-F1 (P1): sparse oversized XLSX silently loses data: FIXED-LOCAL
- Cause, measured: `XLSX.read` with `sheetRows` keeps `!ref` at the decoded rows and moves the true extent to `!fullref`. A check on `!ref` alone saw one row for a file with data at A6000.
- Fix: `lib/xlsx-limits.ts` checks `!fullref ?? !ref`. `parseCueSheet` and `extractDocumentText` both use it.
- Tests (real generated workbooks, `lib/xlsx-limits.test.ts`, `lib/parse-cuesheet-limits.test.ts`): sparse A1 + A6000 rejected by both readers, with the message naming 6000 rows; dense cap accepted, one row past rejected; sparse columns inside the cap accepted; the 50-sheet limit enforced.
- Not claimed: that this stops decompression work. `sheetRows` bounds decoded rows, not inflated bytes. See OPEN below.

### B007-S1 (P2): live Start with no current item: FIXED-LOCAL for Start
- `api/live` `start` now requires an item at `sort_order` 1. A session whose orders skip 1 gets 409 and no write (route test).
- Not covered: Next and Previous over gapped order inputs, and the import-boundary normalisation. Both remain OPEN.

### B007-S3 (P2): Timer missing-row initialisation: FIXED-LOCAL
- Timer provisions the four `display_type_state` rows before reading, through the same helper Hold uses.
- Tests (`app/api/display-engine/timer/route.test.ts`, 4 cases): an event with no rows gets its rows and the first action applies; other display types keep their timers; a non-owner gets 403 with no provisioning and no write; an event with no `display_state` row fails loudly.
- Not tested: the version-conflict 409. I wrote a version-conflict test and then removed it, because it did not reach the 409 path. The conflict path is untested.
- Hold behaviour unchanged. Its tests still pass.

### B007-F3 (P2): reproducible evidence: PARTIAL
- Done: the 13 raw Lighthouse JSON files are copied unmodified into `docs/audit-remediation/evidence/B007/lighthouse/`, with hashes and a served-quality index (`LIGHTHOUSE_INDEX.md`). Served quality is read from each report's console image URLs, not from build notes.
- Corrected in the index and the evidence doc: the `lh-mobile-q90-*` scratch files were served at quality 75, not 90. The desktop runs were served at quality 90 (the earlier draft wrongly said 75).
- Not done: the trace files, the contrast node inventory as a separate file, and the viewport captures. The trace and inventory files were in scratch and were not regenerated.
- Not done: duplicate-heading verification against the true accessibility tree with hidden flags. The tool used earlier does not filter `display:none`. This item stays open, as the review said.

### Source-integrity, redirect, logout, OG and ordinary import fixes: not reopened
- Accepted by the review list: not touched in this batch. The redirect fix (`d786fb0`), logout, OG (`57785ca`), and ordinary import paths are unchanged.

## 3. Not in this batch (OPEN or EXTERNAL)

Section 1 of the prompt:
- B007-F1 second part: a decompressed-size budget for XLSX (ZIP member count, declared and actual inflated bytes, malformed ZIP, encrypted and legacy formats) before `XLSX.read`. OPEN. `sheetRows` alone does not bound decompression, and no hostile compressed fixture exists yet.
- B007-S1 second part: Next, Previous, and Finish over gapped order inputs, Excel and AI. OPEN.
- Import UI browser evidence: imported-session selection, active-show protection, empty-session action, request failure, refresh coherence. OPEN. The synthetic seam is not built.
- B007-S2: concurrent first-import identity allocation. OPEN. The SQL migration still uses a free-ID read before insert, and the 8-character hash is still the scoped suffix. No concurrent Postgres tests were written.

Section 2 of the prompt:
- B007-S4: owner-floor matrix reconciliation, exact intended-state assertions, already-ready and already-selected states. OPEN.
- KF-036.9: a deterministic first-connect race reproduction and a fix. OPEN. Root cause located in B007; no reproduction was built.

Section 3 of the prompt:
- B007-F2: recovery callback, expired and reused link, safe `next` through fallback login, set-password reauthentication fallback, and synthetic recovery evidence. OPEN.
- Login product context copy. OPEN.

Section 4 of the prompt:
- Desktop unused preload (117 KB). OPEN. Needs a measured `priority` or `sizes` change.
- Mobile JS opportunity (about 61 KiB unused). OPEN.
- Hero overlay contrast and animation or reduced-motion states. OPEN.
- Bounded exception and SheetJS-rejection reporting, injectable sink, redaction, tests. OPEN. No provider is chosen, so only the local interface and tests could be built.
- CSP nonce or hash plan and bounded report handling. OPEN. Report-Only remains broad and partial.
- Invitation crawl and noindex reconciliation. OPEN. The current policy is in `ROUTE_METADATA_POLICY.md`.
- Privacy and terms drafts from verified facts. The outline exists in `docs/legal/DRAFT_OUTLINE_FOR_REVIEW.md`. No review-ready drafts were written.
- DNS, RLS, backup, and operator plans as concrete steps. The plans exist in `SECURITY_OPS_PLAN.md` and are not yet reviewable step by step.

EXTERNAL, not completed and not attempted:
- Migration apply, Supabase advisors and PITR, Resend and DNS changes, Vercel canonical host, Search Console, owner decisions (monitoring provider, CSP report endpoint and enforcement, KF-038 timing, KF-039 default, KF-040 PRD scope, KF-041 pre-show check), counsel review, the remote owner-floor matrix, real-device checks.

## 4. Ledger

No ledger state was changed in this batch. Notes from B007 remain in place. Totals validated.

## 5. Handoff

Stop point for Codex review at `a8ed41c`. The next prompt should start from section 3, OPEN items, in the order the review ranked them: B007-S2 (P2, data integrity), B007-F2 (P2, recovery), B007-S4 (P2, matrix), KF-036.9, then the F3 items.
