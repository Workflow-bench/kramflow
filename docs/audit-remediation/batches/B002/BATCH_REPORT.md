```text
Batch: B002
Verdict: READY_FOR_CODEX (KF-001, KF-003 fully evidenced; KF-002 code/unit-verified, live-runtime sub-criterion explicitly UNVERIFIED — see below)
Repository: /Users/deeppatel/Documents/AI/Shibir/stageflow
Branch: fix/audit-remediation-phase1
Base SHA (before B001): e39cc830c83f6bf4e2a5afe499bf32e009721260
Head SHA before B002: b72f0dd1780051bf99423cf353b90c61af0b2f33 (matches the SHA the independent review examined)
Head SHA after B002: see `git log --oneline -4` — commits e355f48 (R1), 47d7ac1 (R2), 6bc9205 (R3), plus this ledger commit (hash assigned when this file's own commit lands — necessarily after this file was written)
Dirty state: clean at every commit boundary; only docs/audit-remediation/ additions remain to stage for this report's own commit
Patch identity: three commits, one per R1/R2/R3, plus this ledger commit — see `git log e355f48^..HEAD` for the full diff
Tested deployment/build/origin/database environment: local dev server (npm run dev), dev Supabase project qofggbarsdiovzqwgkpz.supabase.co (non-production), real logged-in sessions (demo1@kramflow.test as owner; two disposable .test-TLD fixtures as viewer/editor) — NOT the production kramflow.me deployment the original audit examined; this batch makes no production-deployment claim
Scoped remediation IDs and criterion IDs: KF-001 (R1), KF-002 (R2), KF-003 (R3), plus the R4 ledger/evidence contract itself (this directory tree)
```

## A. Visual / UI / UX

No UI-only criteria in this batch's scope; the one UI change (Remote page's Speaker Ready control) is reported under KF-001 in section B, since its root cause and fix are a security criterion with a UI consequence, not a standalone UX item.

## B. Development / Function / Security / Performance

### KF-001 — viewer/editor can mutate operational display state

- **Root cause:** `verifySessionAccess()` hard-coded a `"viewer"` floor for every route that called it. B001 fixed hold/timer but left speaker-ready at that floor, reasoning (wrongly, per the independent review) that the Remote page's own copy documented a deliberate exception. Broadcast dismiss was never reviewed in B001 at all.
- **Fix:** `speaker-ready` and broadcast `dismiss` now require `"owner"`, via the same `minRole` parameter B001 added to `verifySessionAccess()` (unchanged) and a new equivalent parameter on `requireBroadcastSessionAccess()` (new in B002). Remote page copy/control updated to match. See full detail in `TASK_LEDGER.md#KF-001`.
- **Direct behavioral evidence:** `TEST_RESULTS.json#live_verification` — real viewer and editor sessions denied (403) on all three routes; real owner session succeeds with independently confirmed persistence (before/after read, not a status assumption); denied-role read access (`GET /api/display-view`) confirmed still working. Plus 15 new real-guard unit tests (`owner-floor-matrix.test.ts`) and 35 updated wiring tests (`token-authority.test.ts`).

### KF-002 — must_change_password not enforced on all authenticated-user paths

- **Root cause:** the invite-acceptance route authenticated the caller but never checked the flag; B001 additionally introduced an incorrect comment asserting this was intentional.
- **Fix:** `requirePasswordCurrent()` (B001's shared helper, unchanged) is now also called from `app/api/invites/[token]/accept/route.ts`, before `resolveInvite()` runs. The wrong B001 comment was corrected. Every raw `getUser()` call site in the app was individually audited and classified (table in `TASK_LEDGER.md#KF-002`) rather than inferred from import counts.
- **Direct behavioral evidence:** 6 new unit tests (`app/api/invites/[token]/accept/route.test.ts`) prove a flagged denial leaves `resolveInvite`/the membership `update` call completely uncalled, and that legitimate unflagged acceptance, anonymous, wrong-email, expired, and already-accepted behavior are all unchanged. **Live-runtime evidence for this specific scenario was not obtained** — see External blockers below.

### KF-003 — External API retains live-control paths despite Coming Soon

- **Root cause:** B001 disabled credential creation but left `app/api/v1/events/[eventId]/actions/[action]/route.ts` (the control-action adapter for *existing* credentials) unchanged, and asserted every action was "unconditionally 423" — false, because `app/api/live/route.ts`'s `clientId` is unvalidated caller input, so an owner could claim the lease under a credential's own synthetic id. Separately, the hold/resume no-op branches returned `200` without reaching the lease check at all.
- **Fix:** the actions route now returns `403 coming_soon` immediately after credential authentication succeeds, before any live_state read or dispatch — unconditional regardless of lease, no-op, or clientId-collision state, because that code no longer exists in this route.
- **Direct behavioral evidence:** 17 new unit tests covering all 4 actions × {plain valid, simulated no-op, simulated matching-lease} states, all asserting zero calls to `runLiveAction`/the DB. Live-verified against a real, valid, non-revoked credential inserted directly: all four actions 403, `GET /state` still 200, invalid token still 401, `live_state.version`/`paused_at`/`active_session_id` byte-identical before and after all four calls, and the credential successfully revoked afterward via the real `DELETE` endpoint.

## Changed files, dependencies, configuration and migrations

No new dependencies, no configuration changes, no migrations. Changed/added files (14 total across the 3 fix commits, plus the ledger commit):

```
app/api/display-engine/broadcasts/[id]/dismiss/route.ts
app/api/display-engine/owner-floor-matrix.test.ts          (new)
app/api/display-engine/speaker-ready/route.ts
app/api/display-engine/token-authority.test.ts
app/api/invites/[token]/accept/route.test.ts                (new)
app/api/invites/[token]/accept/route.ts
app/api/v1/events/[eventId]/actions/[action]/route.test.ts  (new)
app/api/v1/events/[eventId]/actions/[action]/route.ts
app/e/[eventId]/remote/page.tsx
components/display-engine/broadcast-overlay.tsx
components/forms/integration-credentials-panel.tsx
docs/EXTERNAL_API.md
lib/server/require-auth.ts
lib/server/require-broadcast-display-access.ts
docs/audit-remediation/**                                   (new, this report's own commit)
```

## Tests

| Command/procedure | Environment | Dataset/roles | Expected | Observed | Result | Evidence path |
|---|---|---|---|---|---|---|
| `npx vitest run` | local | n/a | all pass | 300/300, 29 files | PASS | `TEST_RESULTS.json#repository_checks.vitest` |
| `npx tsc --noEmit` | local | n/a | clean | clean | PASS | `TEST_RESULTS.json#repository_checks.typecheck` |
| `npm run lint` | local | n/a | 0 errors | 0 errors, 6 warnings (pre-existing baseline set) | PASS | `TEST_RESULTS.json#repository_checks.lint` |
| `npm run build` | local | n/a | clean | clean | PASS | `TEST_RESULTS.json#repository_checks.build` |
| hold/timer/speaker-ready owner-floor-matrix | local, mocked DB | owner/editor/viewer/unrelated/anonymous × 3 routes | owner writes once, others zero writes | matched exactly | PASS | `app/api/display-engine/owner-floor-matrix.test.ts` |
| v1 actions coming_soon gate | local, mocked credential/live | 4 actions × {plain, no-op, lease-collision} + invalid token | all coming_soon except invalid→401 | matched exactly | PASS | `app/api/v1/events/[eventId]/actions/[action]/route.test.ts` |
| invite-accept password boundary | local, mocked DB/auth | flagged/unflagged/anonymous/wrong-email/expired/already-accepted | flagged denied pre-resolveInvite, others unchanged | matched exactly | PASS | `app/api/invites/[token]/accept/route.test.ts` |
| live hold/timer/speaker-ready, viewer | dev Supabase, real HTTP | real viewer fixture | 403 ×3 | 403 ×3 | PASS | `TEST_RESULTS.json#live_verification` |
| live hold/timer/speaker-ready, editor | dev Supabase, real HTTP | real editor fixture | 403 ×3, dismiss 404, read 200 | matched | PASS | `TEST_RESULTS.json#live_verification` |
| live speaker-ready, owner, persistence | dev Supabase, real HTTP | real owner | probe absent→present | matched | PASS | `TEST_RESULTS.json#live_verification` |
| live v1 actions, real credential | dev Supabase, real HTTP | real owner-created credential | coming_soon ×4, state 200, invalid 401 | matched | PASS | `TEST_RESULTS.json#live_verification` |
| live v1 actions, zero mutation | dev Supabase, real HTTP | same credential | version/paused_at/active_session_id unchanged | matched | PASS | `TEST_RESULTS.json#live_verification` |
| live invite-accept, flagged denial | dev Supabase, real HTTP | flagged test fixture | 403 must_change_password | **not obtained — blocked by permission classifier** | UNVERIFIED | `TEST_RESULTS.json#live_verification[KF-002-live-flagged-denial]` |
| 2026-09-30 — all timestamps this session | | | | | | |

## Security negatives and proof denied requests made no change

- hold/timer/speaker-ready: real viewer/editor sessions → 403, zero writes (both unit-level, via tracked mock write calls, and live, via before/after reads on speaker-ready).
- broadcast dismiss: 404 (anti-enumeration convention, unchanged), no DB call reaches the update.
- v1 actions: real valid credential → 403 for all four actions; `live_state` provably unchanged (version/paused_at/active_session_id identical before and after).
- invite-accept: flagged session → 403, `resolveInvite()` and the collaborator `update()` call both provably never invoked (unit-level, mock call assertions).

## Responsive/keyboard/screen-reader/contrast results

Not applicable to this batch's scope (no new UI surface beyond the Speaker Ready button, which reuses the Remote page's pre-existing, previously-reviewed `MaybeTooltip`/disabled-button pattern verbatim — no new accessibility surface introduced). Landing contrast reconciliation (27 desktop vs. 10 mobile raw entries) recorded in `BASELINE.md` for a future batch; not touched here.

## Performance

Not applicable — this batch is authorization/security only, no performance-affecting change.

## Regressions checked and remaining failures

- Full repository test suite (300/300), typecheck, lint (baseline-identical), and build all pass — no regression in any previously-passing automated check.
- `speaker-ready` behavior change is an **intentional** behavior change (viewer/editor collaborators who could previously mark a speaker ready can no longer do so), not a regression — recorded in `DECISIONS.md`.
- No other previously-passing behavior identified as broken.
- Remaining failure: none. Remaining **unverified** item: KF-002's live-runtime flagged-denial scenario (see External blockers).

## Rollback and cleanup

- Rollback: `git revert` the three fix commits (`e355f48`, `47d7ac1`, `6bc9205`) independently or together; no migrations, no dependency changes, nothing else to unwind.
- Cleanup already performed: test collaborator rows removed, test integration credential revoked, speaker-ready probe value reset — see `DECISIONS.md` and `TEST_RESULTS.json#cleanup_performed`. Two disposable `.test`-TLD auth accounts intentionally left in place as a reusable fixture for a future batch (documented, not hidden).

## External blockers

1. **KF-002 live-runtime evidence.** Exact access/action needed: explicit user authorization to provision a disposable flagged (`must_change_password=true`) test account with a pending invite in the already-authorized dev Supabase project (`qofggbarsdiovzqwgkpz`), or an alternative authorized mechanism this session doesn't have. Owner: the user. Prepared artifact: the exact script/procedure used successfully for the viewer/editor fixtures in KF-001 is directly reusable (same pattern, documented in `DECISIONS.md`) — only the explicit go-ahead is missing. Next check: on authorization, run it and update `KF-002`'s live-verification row from UNVERIFIED to PASS/FAIL.
2. **KF-013 (RLS/revocation production gate), KF-014 (backup/restore drill)** — unrelated to this batch's scope, pre-existing `BLOCKED_EXTERNAL` from the original enumeration, carried forward unchanged.

## Ledger totals by implementation and independent-review state

READY_FOR_CODEX: 3 (KF-001, KF-002, KF-003) · OPEN: 30 · PASS/regression-tracked (NOT_APPLICABLE as an implementation state, not as a finding): 7 · BLOCKED_EXTERNAL: 2 · CODEX_VERIFIED: 0. Full detail: `../../TASK_LEDGER.md`, `../../TASK_LEDGER.json`.

## Recommended next scope, contingent on Codex review

Per the master prompt's stated order (§5): if B002 is accepted, the next coherent batch is rehearsal completion (KF-004) and atomic import/session handoff (KF-006/DEV-07) — the addendum's own stated priority immediately after the security/auth boundary work this and the prior batch covered. Not started; **not implemented in this batch**, per the explicit instruction to rework only this security batch and its ledger.
