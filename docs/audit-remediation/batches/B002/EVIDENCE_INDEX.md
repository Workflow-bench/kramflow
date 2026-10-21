# B002 Evidence Index

| Claim | Evidence class | Where |
|---|---|---|
| Viewer/editor denied hold/timer/speaker-ready (auth boundary) | TEST (real guard logic, mocked DB) | `app/api/display-engine/owner-floor-matrix.test.ts` |
| Viewer/editor denied hold/timer/speaker-ready (wiring) | TEST (mocked guard) | `app/api/display-engine/token-authority.test.ts` |
| Viewer/editor denied hold/timer/speaker-ready | LIVE | `TEST_RESULTS.json#live_verification[KF-001-live-viewer, KF-001-live-editor]` |
| Owner succeeds, write persists | LIVE | `TEST_RESULTS.json#live_verification[KF-001-live-owner-persistence]` — independent before/after read, not a status-code assumption |
| Denied roles retain read access | LIVE | `TEST_RESULTS.json#live_verification[KF-001-live-editor]` — `GET /api/display-view` 200 for the editor fixture |
| broadcast-overlay Dismiss not role-gated client-side, on purpose | SOURCE | `components/display-engine/broadcast-overlay.tsx`'s own comment; reasoning in `DECISIONS.md` |
| must_change_password blocks requireAuthUser/requireEventAccess | TEST (real guard logic) | `lib/server/require-auth.test.ts`, `lib/server/require-event-access.test.ts` (B001, unchanged) |
| must_change_password blocks invite acceptance, leaves membership row untouched | TEST | `app/api/invites/[token]/accept/route.test.ts` |
| must_change_password blocks invite acceptance | LIVE | **NOT OBTAINED** — blocked by permission classifier; see `TEST_RESULTS.json#live_verification[KF-002-live-flagged-denial]` and `DECISIONS.md` |
| Full raw-`getUser()` call-site audit | SOURCE | `TASK_LEDGER.md#KF-002` table; individually reasoned, not import-count inference |
| Password-replacement continuation (`next` param) is safe | SOURCE (read, unmodified) | `proxy.ts`, `lib/safe-redirect.ts`, `app/set-password/page.tsx` |
| v1 actions route unconditionally 403 for all 4 actions, incl. no-op and lease-collision states | TEST | `app/api/v1/events/[eventId]/actions/[action]/route.test.ts` (17 tests) |
| v1 actions route unconditionally 403, real valid credential | LIVE | `TEST_RESULTS.json#live_verification[KF-003-live-valid-credential]` |
| Zero live-state mutation across all 4 actions | LIVE | `TEST_RESULTS.json#live_verification[KF-003-live-zero-mutation]` — `version`/`paused_at`/`active_session_id` byte-identical before/after |
| Revoke still works | LIVE | `TEST_RESULTS.json#live_verification[KF-003-live-revoke]` |
| `clientId` collision root cause | SOURCE | `app/api/live/route.ts` lines constructing `clientId` from `body.clientId` unvalidated, read directly, not inferred |
| Package identity unchanged from original audit | STANDARD (sha256) | `PACKAGE_MANIFEST.json` |
| Desktop contrast is 27 raw entries, not 10 | LIVE (raw JSON, not the narrative summary) | `BASELINE.md`, computed directly from `kramflow-lighthouse-desktop.report.json`'s `audits["color-contrast"].details.items` |
| Repository quality gates | TEST | `TEST_RESULTS.json#repository_checks` — 300/300 tests, tsc clean, lint 0 errors/6 warnings (unchanged baseline), build clean |

No `.env`, cookie, secret-credential, production export, or private event data is included anywhere in this directory or referenced files. Test fixture passwords used during live verification (`.test`-TLD accounts only) are not recorded here; see `DECISIONS.md` for the accounts' existence and purpose, not their values.
