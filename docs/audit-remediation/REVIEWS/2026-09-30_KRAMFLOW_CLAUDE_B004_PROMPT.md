# Claude continuation — B004 focused corrections and verification

Continue under the master prompt from reviewed HEAD `c6f3b9002ef5fcc825548f5493ee5b4bd2536ad4`, branch `fix/audit-remediation-phase1`. Read and preserve `KRAMFLOW_CODEX_B003_REVIEW.md` verbatim. Check for intervening work before edits. Do not redo accepted role, invite or integration source fixes. Preserve stable KF IDs and record the new review IDs below.

**Decision: HOLD/PARTIAL. Scope B004 to the following corrections and actual evidence where authorized. No Phase 2 or deployment.** Codex reran 308 tests, lint and ledger validation successfully. Standard Turbopack build succeeded here; standalone TypeScript passed after that build regenerated its types. Its earlier failure on stale webpack output must remain in the evidence history, but the normal build is not currently blocked on the reviewer host. Do not change Next/build configuration or relocate the pre-existing live helper purely to address an unreproduced environment issue.

## 1. Make the privileged fixture safe before running it (B003-S1/S2)

`assertAllowedProject` must not use substring matching. Parse the base URL, require HTTPS and exact hostname `qofggbarsdiovzqwgkpz.supabase.co`, reject userinfo/foreign ports/path/query/fragment variants, and fail before reading the service key/creating a client. Test lookalike suffixes, allowed text embedded in path/query, userinfo, HTTP and malformed URLs with no real network or credentials.

Fix fixture lifecycle without touching remote state during development:

- Decide/reuse a stable fixture run ID before writes. Validate an existing state file, refuse/reuse existing setup safely, and never overwrite the only recovery record for an earlier run.
- Persist the created event ID immediately using atomic state writes, then persist subsequent resources/phase progress. If a remote write succeeds but state saving fails, report the exact safe recovery action; never claim clean setup.
- Check every API/database result, including collaborator creation and deletions. Handle partial setup and repeated cleanup. Preserve recovery state on failure; malformed state is an error requiring recovery, not “nothing to clean up.”
- Validate stored project/run/owner/resource IDs and test-only markers before deletion; do not let a tampered state file delete an unrelated event.
- Use explicit bounded test-owned objects. Prepare the broadcast, display state, session/program or credential prerequisites required by the tests; don't call setup complete when the subsequent matrix cannot run.
- Implement `run` as real bounded HTTP assertions or clearly separate setup from a concrete executable/readable test procedure. Printing “drive the matrix” is not executing a test. Collect sanitized expected/actual results and before/after state. Supply credentials through approved secure inputs; never reset an existing user to get a session.
- Use isolated fake transport/database seams to test repeat setup, partial-write/state-save errors, cleanup failures and retry recovery. Do not expose service keys in errors/logs or fixture files. Keep recovery metadata gitignored/output-scoped where appropriate.

No remote execution, account creation/access changes or data deletion is authorized just because this script is corrected. Complete this local work and provide the precise safe setup/run/cleanup plan before asking for any missing permission.

## 2. Finish Dismiss keyboard/failure UX (B003-S3)

Keep genuine server-derived role propagation across General/AV/Presenter/Green Room/Custom. Server guards remain authoritative.

- Give sighted keyboard/touch users a discoverable non-owner explanation: visible helper text or a properly focusable descriptive wrapper. A tooltip attached only to a native disabled button cannot receive Tab focus. Do not make unavailable controls seem operable.
- Add the repository’s canonical focus-visible ring to the custom owner Dismiss control.
- Verify owner write failures leave the broadcast visible and show a generic, accessible error. The current toast provides visual feedback but its component has no live-region semantics; use an appropriately scoped accessible announcement rather than asserting screen-reader feedback from appearance alone. Preserve provider safety, repeated-click behavior and generic anti-enumeration server errors.
- Exercise these states locally using controlled UI fixture data where needed, and capture rendered desktop/mobile and keyboard evidence. Label controlled component/harness results honestly; they are not authenticated end-to-end proof.
- When an authorized runtime setup exists, verify owner/editor/viewer/token states on all five shared display surfaces and the related Remote/External API surfaces. Return actual screenshots/traces and exact viewport/build/role/procedure; do not defer them simply because the coding task was large. If access prevents runtime proof, retain UNVERIFIED and provide the specific prerequisite.

## 3. Correct semantic source coverage; don't expand cosmetic bookkeeping (B003-F1/F2/F3)

Keep the accepted 42 parent/28 child structure and machine totals, adding child criteria only where a concrete requirement needs one.

- Fix LH-DESKTOP: raw desktop `color-contrast.score = 0`, with 27 failing items, not passing. Map contrast to KF-019 and desktop performance preservation to its correct criterion, not structured data KF-038. Correct stale KF-049 mentions to actual IDs and regenerate accurate reverse mapping/readable output.
- Include substantive prose fix/acceptance paragraphs in source coverage, with exact archive member/heading/line-range or raw JSON pointer and associated independently checkable criteria. The existing heading/list/table count is accepted for that extraction domain; it does not count paragraph requirements.
- Preserve every obligation in multi-topic rows. In particular FG-L220 covers backup restore **and** monitored test exceptions, so map KF-014 and KF-010 criteria. Audit other compound mappings for similarly dropped obligations; do not equate nonempty mapped IDs with complete semantic coverage.
- Complete KF-006’s multi-session explicit choice/no silent start, transactional event scope, privileged-RPC authorization/search_path, generic client errors, empty-session replacement, invalid/duplicate/oversized/foreign IDs, induced mid-operation failure and rollback acceptance. This is ledger correction only; do not implement import yet.
- Qualify KF-004 summary metrics by actual verified tracking; no invented holds/alerts/overruns. Include that limit in acceptance before future implementation.
- Add a stable OPEN/UNVERIFIED verification criterion for the reported session-identity realtime first-connect gap, sourced to the B003 report. Avoid asserting a reproduced root cause solely from the narrative. Keep hold/timer missing-row KF-031 open.
- Extend the validator only with meaningful integrity checks: duplicate source keys, parent/child ID collisions, resolvable exact source locators/content against the checksum-matched ZIP, raw-audit pointer/value agreement for Lighthouse summaries, empty/invalid acceptance data and regenerated reverse-map consistency. A review citation is not proof of approval; CODEX_VERIFIED requires criterion/build-specific returned approval.

Keep counts and statuses generated. Preserve independently accepted source/unit criteria as such; do not retroactively promote any self-reported LIVE summary to independent verification.

## 4. Flagged-account permission remains pending

The user has not yet approved the earlier rejected provisioning operation. Do not retry it through another tool or interpret this continuation as permission. Finish all unaffected local corrections and evidence preparation first.

Prepare one precise approval request for project `qofggbarsdiovzqwgkpz` only, exactly one disposable `phase1-flagged-test@kramflow.test` account, one pending invitation and a test-owned event with bounded setup/assertions/cleanup. No real email, production access, existing-user reset or unbounded deletion. Include denied event/invite/write checks plus successful password replacement/flag clearing and safe invitation continuation. Account cleanup preference must be explicit; do not claim cleanup if test data remains. The exact production-like password replacement is an authentication credential operation and must obey the active tool’s confirmation/handoff rules.

If an already-authorized local emulator/fixture can prove a runtime criterion without new remote access, use it within that scope and identify its environment. Otherwise leave KF-002 UNVERIFIED. Permission delay does not block items 1–3.

## Return and pause

Return the B004 report, exact revision, targeted/full tests, normal build and sequential typecheck results, actual rendered evidence, corrected coverage/ledger/validator results and reproducible safe fixture plan. Report code/tests, local rendered harness, remote runtime and production separately. Keep remaining authorization and environment limitations explicit.

This continuation commissions a bounded correction batch, not a new full-app audit. Do not invent extra phases, implement Phase 2, deploy, merge/push or mark independent approval yourself. Return the review bundle and **pause for Codex’s independent review at the final revision.**
