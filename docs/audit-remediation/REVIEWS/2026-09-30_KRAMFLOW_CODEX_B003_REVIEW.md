# B003 independent review

**Decision: HOLD / PARTIAL.** Earlier role, invitation and integration code corrections stand. B003’s existing-broadcast matrix, server-derived role propagation and ledger counts are improvements. Correct the new fixture safety issues, keyboard behavior and remaining evidence-map errors before running fixtures or moving to Phase 2.

Reviewed September 30, 2026, America/Phoenix. Actual HEAD: `c6f3b9002ef5fcc825548f5493ee5b4bd2536ad4`; base: `6d2586f0403668252455987e51a05f6ed204c299`; branch: `fix/audit-remediation-phase1`; checkout `/Users/deeppatel/Documents/AI/Shibir/stageflow`. Inspected B003 source, tests, reports, fixture, validator and source map against the original ZIP and master/continuation prompts. Separate standards and spec reviewers agreed on the findings.

## Independent checks

| Check | Result |
|---|---|
| Unit/route suite | PASS: 308 tests, 29 files |
| Existing-broadcast matrix | PASS at mocked-database/real-route/guard layer: 23 cases in the file, including five dismissal identities plus three distinct edge cases |
| Lint | PASS: 0 errors, 6 observed baseline warnings |
| Ledger validator | PASS for the checks it actually implements |
| Ledger counts | Independently parsed: 517 coverage entries, 42 parents, 28 children; stored totals match |
| Standard Turbopack production build | **PASS in this review environment** |
| TypeScript | Initial FAIL on leftover webpack-generated `.next/types/app/api/live/route.ts`; **PASS after successful standard build**, with no source edit |
| Live/UI/account/fixture execution | UNVERIFIED; no remote fixture or browser matrix run |

The initial generated-route error identifies `runLiveAction` as an invalid route-module export. It is pre-existing source and follows the prior webpack attempt’s generated artifacts. Running the normal build succeeded and regenerated outputs; a sequential `npx tsc --noEmit --incremental false` then passed. Do not delete the failed observation or claim webpack fully passed. Turbopack EPERM did not reproduce here; the prior reported environment limit is not a current normal-build blocker on this reviewer host. No speculative production-code change is warranted merely to work around that earlier tool result.

No application edits, commits, pushes, deployments, migrations, remote writes, credential/account changes or fixture execution performed. Build outputs only; tracked checkout unchanged. Claude’s live observations from earlier batches remain self-evidence, not independent runtime verification.

## Standards

### B003-S1 — P1: fixture project guard does not enforce the claimed boundary

`fixtures/owner_floor_live_matrix.mjs:42–43` accepts any URL containing the allowed host string. An unrelated HTTPS hostname/path/query can satisfy `includes()`. The script subsequently creates an admin client using the service-role key and makes privileged requests at lines 55–65. This is a source-confirmed unsafe guard; no credential transmission was attempted or observed.

Parse the URL and require exact HTTPS hostname, appropriate port, no userinfo and a clean base path/query/fragment before reading/using the service key. Test authorized and lookalike/path/query/userinfo inputs without real credentials/network. **Do not execute this fixture as currently written.**

### B003-S2 — P2: fixture lifecycle is neither idempotent nor reliably recoverable

Setup inserts a fresh event on every invocation (lines 73–78), ignores the collaborator insertion result (80–83), and writes recovery state only afterward (85–86). Repeated setup overwrites the previous event ID; interruption can orphan a created event. Cleanup ignores both database deletion results and removes state regardless (114–117). A malformed state file is also treated as nothing to clean up. The advertised safe/idempotent commands are unsupported.

Use a stable run identifier and validated atomic recovery record; persist each created resource immediately, check every operation, reuse/refuse existing setup state, verify fixture ownership before deletion, and retain recovery state until cleanup is confirmed. Run currently prints instructions rather than executing an HTTP matrix, and setup creates no broadcast/display-state fixture; make its capabilities and missing prerequisites explicit or implement the bounded test flow.

### B003-S3 — P2: required keyboard/focus behavior remains missing

`broadcast-overlay.tsx:195–208` wraps a disabled button in a tooltip. `tooltip.tsx:30,42–45` exposes the reason on hover or child focus; the wrapper is not focusable and the disabled child cannot receive keyboard focus. The accessible name does not let sighted keyboard users reveal the reason. Provide visible reason text or deliberate focusable explanatory semantics. The enabled custom Dismiss button at overlay lines 182–193 lacks the focus-visible ring required by `docs/COMPONENT_GUIDE.md:65`.

Root `app/layout.tsx:98` supplies ToastProvider, so the new toast hook is supported. No additional architectural redesign is indicated. Standards summary: three actionable issues, worst is the privileged fixture URL guard.

## Spec

### B003-F1 — P2: a raw-evidence coverage entry falsely says desktop contrast passed

`SOURCE_COVERAGE.json:5983` says the desktop report’s 27 contrast entries are “all passing at desktop sizes,” and maps the run to **KF-038 (structured data/schema)**. Independently reading the archive’s desktop `color-contrast` audit gives **score 0, 27 failing entries**. Map contrast to KF-019 and desktop performance preservation to the appropriate passing criterion. The mobile rationale also references nonexistent KF-049, while its structured mapping correctly uses KF-023. Correct stale references/reverse mappings and validate raw audit paths/values rather than just JSON internal consistency.

### B003-F2 — P2: paragraph requirements and semantic mapping remain incomplete

The 512 Markdown entries comprehensively represent the heading/list/table inventory I cross-checked, apart from table separator syntax. That does **not** establish complete requirements extraction: prose acceptance and fix paragraphs are omitted. For example Fix Guide lines 31–33 contain import acceptance/directions, and the master additionally requires explicit multiple-session choice, tenant/RPC security, foreign-ID rejection, induced failure and rollback. KF-006’s ledger criteria at lines 294–299 do not retain that complete scope.

Another composite source, `FG-L220` (“backup restore drill and monitored test exception”), maps only to KF-014, omitting monitoring KF-010. Review many-to-one mappings for all obligations within each source block. Copying a parent heading is insufficient to close every acceptance criterion.

### B003-F3 — P2: rehearsal desired behavior contradicts the master’s metric limit

`TASK_LEDGER.json:215` calls for holds/alerts/elapsed/overrun summary metrics without qualification. The master allows only metrics actually tracked and expressly prohibits invented holds/overruns. Make verified availability a criterion before commissioning Phase 2.

### B003-F4 — rendered and runtime evidence remain open

The lack of screenshots/live validation is honestly disclosed, but those required tasks are incomplete, not “batch fully complete.” No owner/editor/viewer/token Dismiss rendering, failure-toast announcement, touch/keyboard behavior, Remote state or External API surface was independently verified. The fixture script has not run and cannot substitute for evidence. Its setup/run/cleanup also does not exercise the flagged-account procedure.

The reported session-identity realtime first-connect gap must receive a stable OPEN verification item; an “out-of-ledger observation” cannot remain outside the loop. Do not call it reproduced or fixed based only on the handoff narrative. Preserve KF-031 and all pending runtime gates.

Spec summary: four remaining gaps; wrong contrast classification and lost acceptance requirements could misdirect future remediation.

## Updated disposition

| Area | Independent status |
|---|---|
| Role propagation / previous silent Dismiss bug | Source correction accepted across all five actual overlay callsites; keyboard criterion and rendered proof PARTIAL |
| Existing-broadcast authorization matrix | Source/unit criterion PASS; real broadcast runtime matrix UNVERIFIED |
| Invitation boundary | Previous source/unit acceptance stands; flagged account, password replacement and safe continuation runtime remain UNVERIFIED |
| External API Coming Soon | Previous source/unit acceptance stands; runtime/UI approval pending |
| Counts, preservation states and baseline-history correction | PASS for these discrete corrections |
| Complete semantic coverage/validator | PARTIAL: paragraph criteria, false raw-audit entry and validation gaps |
| Fixture safety/reproducibility | FAIL / NEEDS_REWORK; not executed |
| Standard build and post-build TypeScript | PASS on reviewed revision in this environment |

The validator checks required field presence and internal ID/count/state consistency. It does not reconstruct the original archive inventory, validate source locators/raw JSON facts, ensure coverage source keys are unique, or verify that a cited independent review actually approves a criterion. A passing validator is useful but not exhaustive independent verification.

## Next step and pending authorization

Use `KRAMFLOW_CLAUDE_B004_PROMPT.md` for a small correction and verification-preparation batch. Do not execute the unsafe fixture, silently approve flagged-account provisioning, or start Phase 2 yet. The earlier provisioning rejection occurred in Claude’s session; this review neither retried nor overrode it. A specific user authorization is still needed for that remote-account operation, after the setup/cleanup plan is safe and reviewable. Unaffected local corrections should continue without waiting for it.
