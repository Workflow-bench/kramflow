# B004 Batch Report

Scope: `KRAMFLOW_CLAUDE_B004_PROMPT.md` (verbatim copy in `../../REVIEWS/2026-09-30_KRAMFLOW_CLAUDE_B004_PROMPT.md`), responding to `KRAMFLOW_CODEX_B003_REVIEW.md` (verbatim copy in `../../REVIEWS/2026-09-30_KRAMFLOW_CODEX_B003_REVIEW.md`), which returned **HOLD/PARTIAL** on B003. Four numbered correction items, no Phase 2, no deployment. Checked for intervening work before editing: `git log`/`git status` at session start showed HEAD exactly at the reviewed SHA `c6f3b9002ef5fcc825548f5493ee5b4bd2536ad4` with a clean tree — nothing to reconcile.

## Item 1 — Make the privileged fixture safe before running it (B003-S1/S2)

**Status: DONE at the code layer. Not executed — no remote fixture run, account creation, or data deletion was performed.**

Rewrote `fixtures/owner_floor_live_matrix.mjs` end to end:

- **`assertAllowedProjectUrl`** (B003-S1, P1): replaced the `.includes()` substring check with `new URL()` parsing that requires an exact match on scheme (`https:`), hostname, no userinfo, no non-default port, no path beyond `/`, no query, no fragment — and fails before any service-role key is read or client created. 12 unit tests cover the exact lookalikes the review named (suffix host, host embedded in an unrelated path/query, userinfo, wrong port, malformed URL).
- **Resumable state machine** (B003-S2, P2): `setup` now progresses `event_created -> collaborators_created -> broadcast_created -> complete`, persisting state atomically (write-to-temp-then-rename) after every single remote write — never after a batch of them. A malformed or wrong-run-id state file is now a hard error requiring manual recovery, never silently treated as "nothing here." Re-running `setup` resumes from wherever it left off instead of creating a second event.
- **Ownership re-verification before delete**: `cleanup` re-reads the event row from the database and checks its `owner_id` and a `[fixture:...]` name-marker prefix against the state file's claims *before* deleting anything — a tampered or stale state file cannot be used to delete an unrelated event.
- **Checked results everywhere**: every insert/delete now checks its own error, not just the final step. A partial cleanup failure (e.g. the collaborators delete failing) leaves the state file in place for a clean retry rather than discarding recovery state.
- **Bounded test-owned prerequisites**: `setup` now also creates a real `display_type_state` row and a real `display_broadcasts` row — the actual objects the hold/timer/dismiss matrix needs — instead of stopping at an event/collaborator shell that the matrix couldn't yet exercise.
- **`run`**: implemented as real, bounded `fetch()` assertions against a caller-provided base URL, with an injectable `getSessionCookie` seam. The default `getSessionCookie` throws a named, honest error rather than fabricate a login flow — obtaining a real session without resetting any account's password requires translating a Supabase `generateLink`+`verifyOtp` exchange into this app's exact `@supabase/ssr` cookie contract, which was not implemented without first confirming that contract (documented in the file's own header, not glossed over as "drive the matrix").
- **New test file** `owner_floor_live_matrix.test.ts` (33 tests, all against fake in-memory `db`/`fs` seams — no real network or credentials): covers the URL-guard cases above, state-file missing/malformed/wrong-run-id handling, setup idempotency and mid-phase resume, the distinct "remote write succeeded but state-save failed" error path, ownership-verification refusal on a tampered/foreign event row, and a cleanup partial-failure-then-successful-retry sequence.

**No remote execution, account creation/access change, or data deletion is authorized by this correction** — unchanged from B003's boundary, restated per the B004 prompt's explicit instruction.

## Item 2 — Finish Dismiss keyboard/failure UX (B003-S3)

**Status: DONE at the code layer; rendered/runtime evidence remains open (see Remaining gaps).**

- **`components/display-engine/broadcast-overlay.tsx`**: the non-owner Dismiss state is no longer a `disabled` `<button>` wrapped in a hover/focus-triggered tooltip — a disabled element is removed from the tab order and never fires a focus event, so the tooltip's reason was undiscoverable to a sighted keyboard user (exactly the review's finding). Replaced with always-visible plain text ("Only the owner can dismiss"), legible to sighted keyboard users and screen readers alike without pretending a control is operable. The owner's enabled Dismiss button gained the repository's canonical `focus-visible` ring (`docs/COMPONENT_GUIDE.md:65`), which it was missing.
- **`components/ui/toast.tsx`**: added `role="status" aria-live="polite" aria-atomic="true"` to the toast container — a shared-component fix, since no toast anywhere in the app previously had live-region semantics; a failed-dismiss toast is now actually announced to assistive tech, not just visually shown.
- Verified `tsc --noEmit` and `npm run lint` clean on both files; `MaybeTooltip`'s now-unused import removed from `broadcast-overlay.tsx` rather than left dangling.

## Item 3 — Correct semantic source coverage; don't expand cosmetic bookkeeping (B003-F1/F2/F3)

**Status: DONE.**

- **B003-F1 fixed**: `LH-DESKTOP` was wrongly claiming the desktop report's 27 `color-contrast` items were "all passing" and mapping them to **KF-038** (structured data/schema — unrelated). Independently re-read the raw JSON directly (`audits['color-contrast'].score === 0`, `.details.items.length === 27`) and split the entry in two: `LH-DESKTOP-CONTRAST` -> **KF-019** (same criterion as the mobile contrast failures) and `LH-DESKTOP-PERFORMANCE` -> **KF-033** (the actually-passing desktop Lighthouse-100/LCP-0.6s fact, already one of KF-033's named preserve items). Two stale free-text `KF-049` mentions (an id retired during B003's own dedup pass, never present in the ledger) corrected to `KF-023`.
- **B003-F2 fixed (three parts)**:
  1. Added **22 new prose-paragraph entries** to `SOURCE_COVERAGE.json` (`prose_paragraph_entry_count: 22`), one per `KRAMFLOW_FIX_GUIDE.md` section, carrying the actual Wrong/Why/Fix/Acceptance-criteria prose text with exact line ranges — the heading/list/table extraction pass structurally cannot see a plain, unbulleted paragraph (e.g. `FG-L31-33`'s own acceptance-criteria text, the exact gap the review named).
  2. `FG-L220` ("backup restore drill **and** monitored test exception") was a compound source mapped only to `KF-014`. Now maps to both `KF-014` and `KF-010`, and both ledger entries gained an explicit cross-reference acceptance criterion stating the two are tested together, not independently satisfiable.
  3. `KF-006`'s acceptance criteria were expanded from the parent-heading-level subset to the full obligation set from master-prompt item 13 and the full `FIX_GUIDE` paragraph: explicit multi-session choice (never silently starting a show), one-transaction event scope, authorization/`search_path` confirmed *inside* the database operation, generic client errors, foreign-session-id rejection, induced-failure rollback, and the additive-migration/staging-verification requirement. Ledger correction only — import itself is not implemented in this batch.
- **B003-F3 fixed**: `KF-004`'s `desired_behavior`/`acceptance_criteria` now explicitly carry the master prompt's own limit — "show only metrics actually tracked, not invented holds/overruns" — rather than listing concrete metrics (holds/alerts/elapsed/overrun) unqualified.
- **B003-F4 fixed**: the session-identity realtime first-connect gap now has its own stable, independently checkable ledger row — added as child **`KF-036.9`** (not a new top-level parent, preserving the accepted 42-parent/28-child structure the B004 prompt asked to keep; a 29th child was added where the B004 prompt itself allowed "adding child criteria only where a concrete requirement needs one"), `implementation_state: OPEN`, `evidence_class: INFERENCE` until independently reproduced against the real code path — not asserted as a confirmed root cause from the B003 narrative alone.
- **Validator extended** (`validate_ledger.mjs`) with six new real checks run against the real data, not a manufactured clean sample: duplicate `source_key`s in `SOURCE_COVERAGE.json`; parent/child id collisions across the *whole* ledger (not just children against each other); **resolvable locators** — every line-based locator is checked against the actual vendored source file and line count; **raw Lighthouse value agreement** — the validator independently re-reads the three raw Lighthouse JSON files and cross-checks the `color-contrast` score/count and LCP `numericValue` against what `SOURCE_COVERAGE.json`'s own entry text claims (this check would have caught B003-F1 itself had it existed then); empty/placeholder acceptance criteria on an open leaf item; and reverse-map (`by_kf_index`) regeneration consistency.
- **New `docs/audit-remediation/source-package/`**: vendored copies of the 7 original Markdown reports and the 3 raw Lighthouse JSON reports (sha256-verified against `PACKAGE_MANIFEST.json` before and after copying — see `source-package/README.md`), plus the now-portable generator pipeline (`extract.mjs` -> `classify.mjs` -> `build_coverage.mjs` -> `add_prose_entries.mjs` -> `build_coverage_md.mjs`), so the "resolvable locator" and "raw audit agreement" validator checks above work from a clean checkout without needing the original zip on hand. Regeneration reproduces the same 540-entry `SOURCE_COVERAGE.json` from only files now committed to this repo.

Run `node docs/audit-remediation/validate_ledger.mjs` to reproduce: exits 0, prints the full list of what it checked.

## Item 4 — Flagged-account permission remains pending

**Status: not executed. Updated, more precise authorization request below, superseding B003's draft.**

The B003-blocked provisioning was not retried through any tool, encoding, or path. This continuation is not interpreted as permission. No already-authorized local emulator exists that could prove this runtime criterion without new remote access (this project has no Supabase emulator configured — confirmed by checking for one before concluding this), so `KF-002`'s live-runtime sub-criterion remains `UNVERIFIED`.

**Updated pending authorization request:**

- **Project:** `qofggbarsdiovzqwgkpz.supabase.co` only — the single project every other live check in this project has used.
- **Account:** exactly one new, named, disposable account — `phase1-flagged-test@kramflow.test` — created via the Supabase admin API with `app_metadata.must_change_password = true` set directly. No real email is sent. The throwaway initial password is generated by the setup script itself (not typed by me into chat, not requested from the user, not displayed in any log or evidence file) and is a value with no significance outside this disposable test account — consistent with the applicable credential-handling rule that this kind of operation must go through an approved, non-plaintext-in-chat path.
- **Invite:** one pending `event_collaborators` row for that account on a disposable test event (reusing the `fixtures/owner_floor_live_matrix.mjs` event-creation pattern), `status: "pending"`.
- **Test procedure, in order:**
  1. **Denied-while-flagged checks**: from the flagged account's real session, call `POST /api/invites/[token]/accept` and 2-3 representative authenticated endpoints (an event read, a cue-sheet edit) and confirm every one fails — before-state of the `event_collaborators` row (`status: "pending"`, `user_id` unset) is captured and compared byte-for-byte against its after-state to prove zero mutation.
  2. **Password replacement / flag clearing**: drive the real `/set-password` flow for that account to completion, then independently re-read `app_metadata.must_change_password` from the database afterward (not assumed from a 200 status) to confirm it actually cleared.
  3. **Safe invitation continuation**: after the flag clears, retry step 1's invite-accept call from the same now-unflagged session and confirm it now succeeds, with the `event_collaborators` row transitioning to `accepted` and `user_id` set — proving the whole boundary end to end, not just the denial half.
- **Cleanup preference (must be stated explicitly, not left implicit):** the user's choice — either (a) delete the `event_collaborators` row, the disposable event, and the one new auth account entirely, or (b) delete the row/event but leave the account in place as a reusable fixture (matching the existing precedent for the viewer/editor accounts). Whichever is chosen will be stated as fact in the batch report that reports this test's results, not left to be inferred.
- **No real email delivery, no existing-user password reset, no production project involved, no unbounded deletion** (only the specific row/event/account named above, nothing matched by a broader query).

Until explicitly authorized, `KF-002`'s live-runtime sub-criterion remains `UNVERIFIED`/open — not claimed, not skipped-and-marked-PASS. Items 1-3 above did not wait on this and are complete regardless of this authorization's outcome.

## Verification sweep

| Check | Result |
|---|---|
| `npx vitest run` | 341/341 pass (30 files; was 308/29 at end of B003, +33 new fixture-script tests) |
| `npx tsc --noEmit` | clean |
| `npm run lint` | 0 errors, 6 warnings (unchanged pre-existing baseline — one new warning introduced and then removed during this batch, see history) |
| `npm run build` (standard Turbopack) | **clean**, reproduced twice in this session — B003's EPERM failure did not reproduce here either, consistent with the Codex B003 review's own finding that it's a transient/host-state issue, not a code defect. No build/Next config was changed to chase it, per the B004 prompt's explicit instruction. |
| `npx tsc --noEmit --incremental false` (sequential, post-build) | clean |
| `node docs/audit-remediation/validate_ledger.mjs` | PASS (6 new checks, all real — see item 3) |

Code/unit-test evidence above is independently reproducible from this repo. No rendered browser screenshots, no live Supabase session, and no production/runtime evidence were captured in this batch — all remain honestly open, listed below.

## Remaining gaps (explicit, not deferred silently)

- Rendered desktop/mobile/keyboard evidence for the three Dismiss states and the toast live-region announcement — not captured this batch. A controlled-fixture/component-harness capture would need to be explicitly labeled as harness evidence, not authenticated end-to-end proof, per the B004 prompt's own instruction.
- Owner/editor/viewer/token runtime verification across all 5 shared display surfaces plus Remote/External API — still UNVERIFIED; no authorized runtime setup was exercised this batch.
- `fixtures/owner_floor_live_matrix.mjs` has not been executed against the real dev project — only unit-tested against fakes.
- `KF-002` live-runtime sub-criterion — pending item 4's authorization.
- `KF-031` (hold/timer persistence) and `KF-036.9` (session-identity realtime first-connect gap) — both remain OPEN, neither touched this batch.

## Rollback

- Item 1: revert the commit touching `fixtures/owner_floor_live_matrix.mjs` and its new test file. Nothing was ever executed against the real project, so there is no remote state to roll back.
- Item 2: revert the commit touching `components/display-engine/broadcast-overlay.tsx` and `components/ui/toast.tsx`. No migration involved.
- Item 3: revert the commit touching `docs/audit-remediation/{TASK_LEDGER.json, SOURCE_COVERAGE.json, SOURCE_COVERAGE.md, validate_ledger.mjs, BASELINE.md, source-package/}` and the two new `REVIEWS/` copies. Purely additive/corrective documentation.

## Pause

This completes B004's authorized scope. **Pausing here for independent review — not starting Phase 2, not deploying to production, not self-approving, not retrying the flagged-account provisioning.** Final revision SHA and copy-ready handoff are in the top-level response that accompanies this report.
