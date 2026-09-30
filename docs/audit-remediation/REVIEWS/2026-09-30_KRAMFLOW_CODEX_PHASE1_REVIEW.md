# KramFlow Phase 1 — independent Codex review

Decision: **HOLD / NEEDS_REWORK. Do not start Phase 2 yet.**

Reviewed September 30, 2026 (America/Phoenix). Source: `/Users/deeppatel/Documents/AI/Shibir/stageflow`, branch `fix/audit-remediation-phase1`, base `e39cc830c83f6bf4e2a5afe499bf32e009721260`, head `b72f0dd1780051bf99423cf353b90c61af0b2f33`. The actual checkout matches Claude’s reported head. Review authority: original audit package and `KRAMFLOW_CLAUDE_MASTER_PROMPT.md`. Pasted Claude output is a claim, not independent evidence.

## Independent checks

| Check | Result | Boundary |
|---|---|---|
| Full unit/route test suite | PASS: 262 tests, 26 files | Real local run; database/auth mocks do not prove live authorization or RLS |
| TypeScript | PASS | Ran `npx tsc --noEmit --incremental false` |
| ESLint | PASS: 0 errors, 6 warnings | Current warnings observed; consistent with handoff, including an unrelated untracked file |
| Production build | PASS | Next 16.3.5 build succeeded; this is not a deployment |
| Independent diff/code inspection | COMPLETE | Four commits, 14 changed files; separate standards/spec review lenses |
| Live owner/editor/viewer/flagged-account matrix | UNVERIFIED | No independent runtime account/fixture test performed |
| External API browser rendering/responsive/accessibility | UNVERIFIED | Source inspected; Claude’s browser observation was not independently reproduced |
| Production deployment identity/configuration | UNVERIFIED | Local revision only |

No application fixes, commits, pushes, deployments, migrations, account provisioning or event mutations were performed. The build generated local ignored outputs. Tracked working tree remained unchanged. The existing golden-path E2E suite was not run: its setup deletes **all** events owned by the test account before creating an event; it is not a safe read-only check against an environment whose disposability has not been established. Browser inventory showed no available authenticated browser tab for this review. No production performance claim is made for this security batch.

## Standards

No substantive new architectural violation was found. The implementation uses the existing components/tokens/icons and shared authorization boundaries; the extracted password-check helper is reasonable. No baseline code smell warrants a redesign.

Evidence/documentation corrections:

- Tracker lines 36 and 67 overstate role coverage. `lib/server/require-event-access.test.ts:69` onward tests owner success, editor resolution at viewer floor, viewer denial at owner floor, unrelated and anonymous denial. It lacks editor denial at owner floor and viewer positive resolution. Route tests mock the authorization result, so they prove required-role wiring rather than an actual end-to-end denial matrix.
- `components/forms/integration-credentials-panel.tsx:19` retains an inherited comment claiming API routes/token-reveal behavior are unchanged even though this patch changes both. Revise that stale comment; it is a documentation maintenance issue, not an architectural defect.

Standards summary: no substantive architectural findings; two evidence/documentation corrections. The most material is overstated test coverage.

## Spec

### R1 — P1: speaker-ready still permits a read-only viewer to write

`app/api/display-engine/speaker-ready/route.ts:26` still calls `verifySessionAccess` without an owner floor; lines 45–49 write `display_state` through the privileged client. Remote copy explicitly permits this, but Settings promises viewers can only look. The audit already recognized that contradiction. The master prompt requires “viewer reads only” and includes speaker-ready in its mutation inventory. Existing inconsistent copy does not authorize an exception to that requirement.

**Required:** enforce owner for this operational mutation, align Remote UI/copy with server truth, and test owner/editor/viewer/token/anonymous/unrelated requests with unchanged-state proof on denial. Do not introduce a backstage role or approve a viewer-write exception unilaterally.

### R2 — P1: invitation acceptance bypasses forced password replacement

`app/api/invites/[token]/accept/route.ts:13` authenticates directly without the new password check, then lines 47–54 accept membership through the privileged client. The new `lib/server/require-auth.ts:49` comment intentionally treats acceptance as an exception. The original Fix Guide and master prompt explicitly require invitation acceptance to fail until the flag clears. Matching the email to the invite does not satisfy that password-replacement requirement.

**Required:** invoke the shared flag check before resolving/accepting the invite, test that denied requests do not change membership, and prove acceptance succeeds after legitimate password replacement. Preserve login/logout/set-password reachability and safe continuation to the invite.

### R3 — P1: existing credentials retain live-control paths despite Coming Soon

Credential creation is correctly denied and its form removed. However, `app/api/v1/events/[eventId]/actions/[action]/route.ts:11` remains enabled for existing credentials. Its line 16 can return 200 for hold/resume no-ops without checking a lease. More substantially, line 17 uses `integration:<credentialId>`, while owner-authorized `/api/live` accepts arbitrary client IDs at line 167 and claims them at lines 188–194. An owner can claim that exact synthetic ID, allowing the credential’s subsequent live action to meet the lease check. This is a **source-derived execution path**, not a reproduced live exploit or evidence of anonymous privilege escalation.

Therefore “every action returns 423 unconditionally” is false. Lack of a supported integration claim endpoint is not a release-disable mechanism. The master requires direct requests cannot use the unavailable control capability.

**Required:** explicitly gate recognized integration control actions in the Coming Soon release policy, preserving authentication/anti-enumeration conventions and deliberately retained state-read/list/revoke paths. Test all four actions with existing valid credentials, both no-op conditions and a matching active lease; prove no live handler/state mutation occurs. Do not delete credentials or bypass leases.

### R4 — P2: exhaustive intake and structured loop records are missing

The Markdown tracker contains useful narrative, but it does not fulfill the manifest, machine-readable ledger, baseline, source-row mapping and batch-artifact contract. It omits separate coverage for dependency/SheetJS review, rate limits, build secret checks, authenticated performance, offline/reconnect/controller/burst/soak, staging/rollback parity, footer/state/print sweeps and passing/conditional checklist rows. Contrast remains summarized as approximately ten labels despite the master’s desktop inventory correction. No independent-approved source mapping supports its assertion that every applicable finding is present.

**Required:** preserve KF IDs/history, complete source-to-criterion mappings from every report/checklist/raw run, and generate the structured artifacts before continuing. Passing anchors are PASS/regression-preservation items, not simultaneously N/A. N/A/deferral must remain distinct from verification.

Spec summary: four actionable gaps; worst are the three P1 incomplete security/release boundaries. They are unresolved baseline/spec issues, not a claim that this patch introduced new unauthorized access.

## Disposition by Claude task

| Task | Independent disposition |
|---|---|
| KF-001 | PARTIAL / NEEDS_REWORK: hold/timer owner-floor wiring is sound and local tests pass; speaker-ready criterion fails; live denials and persisted owner success remain unverified |
| KF-002 | PARTIAL / NEEDS_REWORK: both shared guards now block flagged users; invitation acceptance remains a bypass; flagged runtime matrix unverified |
| KF-003 | PARTIAL / NEEDS_REWORK: create endpoint/UI unavailable; existing live-control adapter still enabled; browser and revoke/read regression evidence unverified |
| Intake/ledger | NEEDS_REWORK: incomplete source-row and acceptance mapping |

## Hold missing-row finding

`app/api/display-engine/hold/route.ts:46–75` activation/deactivation logic is unchanged from the base except for authorization/comments. Missing-row activation uses an update that can match zero rows and still return 200; deactivation requires `.single()` and can fail. Thus the reported symptom is consistent with **pre-existing source behavior**. The specific database row absence/PGRST116 report was not independently queried or reproduced.

Add a stable open finding for missing-row behavior and false-success reporting. Do not count activation 200 as persisted owner-success evidence. A future scoped fix must choose deterministic initialization or actionable missing-state failure and verify database/display readback. Preserve the server scope `(event_id, display_type)`. This finding need not be quietly folded into Phase 1 code, but it must not disappear from the loop.

## Next step

Return `KRAMFLOW_CLAUDE_PHASE1_REWORK_PROMPT.md` to Claude alongside the original ZIP and master prompt. Rework only this security batch and its ledger/evidence. Independent approval remains pending; Phase 2 has not been authorized by this review.
