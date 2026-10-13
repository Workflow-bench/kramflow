# Claude next batch — B003: close B002 review gaps

Read `KRAMFLOW_CODEX_B002_REVIEW.md` and continue under the existing master prompt. Reviewed HEAD is `6d2586f0403668252455987e51a05f6ed204c299` on `fix/audit-remediation-phase1`. Preserve intervening/unrelated work, previous IDs, decisions and review history. Codex independently reran 300 tests, TypeScript, lint (0 errors/6 warnings) and production build, and validated all package-member checksums. The previous P1 code bypasses are corrected; do not reimplement those fixes or add a lease lifecycle.

**B002 decision: HOLD/PARTIAL. Implement only the following focused B003 work and prepare reproducible verification. Do not start rehearsal/import or other Phase 2 work yet.**

## 1. Fix the silent non-owner broadcast Dismiss interaction

Current overlay uses `canDismiss = !identity.token`; non-owner sessions still see Dismiss. The server now denies them, but the response is ignored and only console-logged. This is a batch-induced interaction defect, not an acceptable scope exemption.

- Supply a genuine server-derived dismissal capability/role for the event/display, or a conservative unknown/unavailable state while it loads. Do not read the default-owner context outside its provider or trust client-supplied role data.
- Hide or disable Dismiss for viewer/editor/public-token users with appropriately understandable status/reason; preserve viewing and intentionally scoped acknowledgement. Owner session previews must still dismiss. Check all four display surfaces because this is shared display code.
- For permitted owner clicks, handle non-2xx and transport failures with an accessible visible message. Do not optimistically make the broadcast disappear after failed writes. Avoid leaking existence-sensitive response details to unauthorized users; retain generic server denials.
- Verify keyboard/focus and screen-reader names for the owner control and denied-role state. Do not broadly redesign the display layout or disable acknowledgement/promote merely because those paths use another token guard; analyze their intended semantics separately.

Add the new review/regression ID B002-F1 linked to KF-001. Keep its acceptance separate from unchanged hold/timer persistence under KF-031.

## 2. Test dismissal against a real existing broadcast

The reported nonexistent-ID 404 happens before role authorization; it cannot prove this fix. Extend meaningful real-guard/real-route tests to owner/editor/viewer/unrelated/anonymous/token callers against an existing broadcast owned by the event. Use fixtures with realistic state and assert exact event/broadcast scoping and unchanged dismissed_at/status on every denied request. Owner must persist a dismissal. Separately cover nonexistent IDs, foreign-event IDs and missing/invalid identity without confusing them with role tests.

Use an authorized disposable runtime fixture for live matrix evidence if permission and credentials are available. Do not reuse or dismiss a real event broadcast for testing. A reusable fixture must be explicitly identified and bounded; reading that credentials exist is not authorization to create access. Retain UNVERIFIED when live setup is unavailable, while completing local tests and UI work.

Owner hold/timer success still needs real persistence with an existing display_type_state row; speaker-ready readback is not proof of those routes. Keep KF-031 OPEN and do not solve its broader initialization behavior inside this batch. Ensure test mocks do not turn SQL UPDATE into accidental UPSERT; an absent row remains absent unless the tested operation explicitly inserts it.

## 3. Finish R4 through actual source-row and criterion records

Use the original seven Markdown reports and all three Lighthouse pairs. Create a real `SOURCE_COVERAGE.json` plus readable view, preserving each report heading/table/row or checklist item with a stable source key and exact text locator. Map duplicates many-to-one to stable KF IDs/child criterion IDs. All eleven user checks, original PASS rows, conditional/N/A rows and unverified gates must be represented.

- For every source key provide its mapped IDs, applicability and rationale; distinguish “no new implementation required because existing behavior passes” from “not applicable.” Map narrative defects/acceptance criteria as well as tables. Original schema, AI-search-bot policy, PRD completeness and operator/tool inventory must receive explicit decisions even if they require no implementation.
- Complete the master-required fields for all ledger entries, including not-started ones. Split KF-032/035/036 and other composite entries into independently checkable child criteria with concrete expected behavior and exact source references. Preserve parent KF IDs; do not drop or renumber history.
- KF-022/KF-033 remain applicability=applicable, observation=PASS with pending/proportionate regression review. Add/document a clear preservation state such as PRESERVE_PENDING_REVIEW if necessary; do not use NOT_APPLICABLE for these or mark them independently verified without a review.
- Derive totals from actual records. Current values are 36 entries: READY 3, OPEN 25, BLOCKED 2, NOT_APPLICABLE 6; reported 42 is wrong. After changing the schema, separately count parent tasks, child criteria, applicability, implementation state and evidence/review status. Produce a validator that detects duplicate IDs, dangling mappings, unmapped source keys, missing required fields and totals drift. Test this audit infrastructure with real ledger data rather than manufactured claims.
- Record R1/R2/R3 at the independently accepted **source/unit layer** and leave runtime/UI criteria open. Preserve KF-002’s blocker; do not offer accepting unit proof as if it closes the master’s live criterion.
- Correct historical metadata: the master prompt existed before B001; retrospective ledger creation does not mean B001 predated the contract. Keep original returned reviews verbatim, and put corrections in current decisions/history rather than rewriting reviews.

## 4. Return rendered UI and reproducible evidence

The Remote ready control and External API copy/availability are affected UI, as is Dismiss. Reusing a shared component does not make visual/keyboard verification N/A.

- Capture actual desktop/mobile owner and non-owner Remote state, External API Coming Soon/list/revoke surface, and display dismissal capability. Verify applicable keyboard focus/order, tooltip/disabled explanation and accessible names. Cover all four display surfaces when shared code changes.
- Attach sanitized screenshots/browser traces or reproducible rendered evidence. Record exact SHA/build, origin, viewport, role, fixture ID, procedure, timestamp, expected and observed behavior. Keep UI checks UNVERIFIED if access prevents them.
- Provide a concrete fixture setup/test/cleanup procedure or script, with project/environment guardrails, bounded test-owned objects, secure credential inputs and no passwords/tokens in outputs. Do not embed secret credentials or print service keys. Independent reviewer needs executable steps rather than “use the same pattern.”
- Save sanitized HTTP results and relevant before/after values. Clearly distinguish a comparison of version/paused_at/active_session_id from full live_state byte identity. Show denied broadcast row unchanged and read access preserved; use an existing row, not a nonexistent ID.
- Mark summaries as Claude self-evidence until independently reproduced. Adapter unit tests stub credential verification; separately account for missing/revoked/wrong-event/wrong-scope credentials and read/list/revoke regressions. You need not create redundant artificial lease states if the gate never reads them; its no-dispatch property is the relevant proof.
- Restore fixtures to their actual previous values; changing an originally absent speaker_ready key to false is not exact restoration. Do not delete shared resources to clean a probe. Document any leftover test marker/account/credential and safe future cleanup requirements.

## 5. KF-002 live test and authorization boundary

Source/unit invitation blocking is independently accepted; real flagged-session denial, successful password replacement, safe invitation continuation and fresh/stale-session behavior remain UNVERIFIED. The earlier shared-resource rejection was reported by Claude. Do not retry the rejected operation through another tool/encoding or treat this review as a new permission grant.

Complete unaffected work first. If the user explicitly authorizes the fixture, use only the named non-production project `qofggbarsdiovzqwgkpz`, one clearly named disposable flagged account, its pending test invitation and bounded test event/collaborator rows, with no real email delivery or existing-user reset. Prepare exact setup, state assertions and cleanup first. Otherwise return the smallest pending authorization request with those specifics and preserve the open criterion. An existing authorized local auth emulator/fixture can be used only within its established scope. Do not fabricate live evidence or accept skipped tests as PASS.

## Return and pause

Run targeted behavioral checks, full tests/typecheck/lint/build and required rendered verification. Return B003 report, ledger/source map and validator output, decisions, raw sanitized evidence/index, actual base/head/full patch, remaining blockers and rollback. Separate code PASS from runtime/UI PASS; only Codex can set CODEX_VERIFIED from actual reviewed evidence.

Return one copy-ready handoff for independent review of B003 at the exact final revision. **Pause for that review. Do not start Phase 2 or deploy production.**
