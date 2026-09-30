# External Control API

**Control actions are not available yet.** Credential creation is disabled
(`POST /api/events/{eventId}/integrations` returns `403 coming_soon`) —
see `docs/audit-remediation/KRAMFLOW_REMEDIATION_TRACKER.md`, KF-003, for
why and what re-enabling it requires.

The `start`/`hold`/`resume`/`next` actions below forward to the same
controller-lease-gated handler Console and Remote use
(`app/api/live/route.ts`), but an integration credential has no way to
claim that lease — there is no `claimControl`/renew/release action exposed
to it anywhere in this codebase. Every credentialed call to those four
actions returns `423 Locked` unconditionally, not just when a human
operator happens to be in control. This was previously documented here as
if `423` only meant "a competing controller is active" — that's true of
the underlying mechanism, but for an integration credential it is the
*only* outcome, which is what KF-003 exists to fix (a real claim/renew/
release lifecycle) before this is offered again.

`GET /state` is unaffected — it never touched the controller lease — and
still works for any existing credential.

Base URL: `/api/v1/events/{eventId}`

| Request | Purpose | Status |
| --- | --- | --- |
| `GET /state` | Current live state, active session, current and next program | Works |
| `POST /actions/start` | Start the active session | Structurally locked — see above |
| `POST /actions/hold` | Put the live timer on hold | Structurally locked — see above |
| `POST /actions/resume` | Resume the live timer | Structurally locked — see above |
| `POST /actions/next` | Advance to the next program item | Structurally locked — see above |

All requests require `Authorization: Bearer <token>`. A missing, revoked, malformed, wrongly-scoped, or wrong-event token receives `401`. A successful action is recorded as `Integration: <credential label>` in the event activity log.

Do not put the bearer token in a button URL, share link, or browser bookmark.
