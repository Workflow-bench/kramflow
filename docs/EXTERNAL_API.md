# External Control API

**Control actions are not available yet.** Credential creation is disabled
(`POST /api/events/{eventId}/integrations` returns `403 coming_soon`), and
every control action on an *existing* credential is separately,
deterministically gated the same way — see
`docs/audit-remediation/TASK_LEDGER.md`, KF-003, for why and what
re-enabling it requires.

An earlier version of this fix (and of this doc) claimed the four control
actions below were "structurally locked" — forwarded to the same
controller-lease handler Console/Remote use, unconditionally 423 because
no credential could ever claim the lease. An independent review found that
claim false: `clientId` on the live-action endpoint is caller-supplied and
unvalidated, so an *owner* (who already has full show control) could claim
the lease under a credential's own synthetic client id and let that
credential's forwarded action through — not a privilege escalation, but it
meant the safety property depended on lease behavior instead of being
unconditional. The fix now gates `POST /actions/*` immediately after
credential authentication, before any lease check, live-state read, or
no-op branch — the four actions below cannot reach the live handler or
mutate any state at all, regardless of lease or no-op state.

`GET /state` is unaffected by any of this — it never touched the
controller lease — and still works for any existing credential.

Base URL: `/api/v1/events/{eventId}`

| Request | Purpose | Status |
| --- | --- | --- |
| `GET /state` | Current live state, active session, current and next program | Works |
| `POST /actions/start` | Start the active session | Disabled — `403 coming_soon` |
| `POST /actions/hold` | Put the live timer on hold | Disabled — `403 coming_soon` |
| `POST /actions/resume` | Resume the live timer | Disabled — `403 coming_soon` |
| `POST /actions/next` | Advance to the next program item | Disabled — `403 coming_soon` |

All requests require `Authorization: Bearer <token>`. A missing, revoked, malformed, wrongly-scoped, or wrong-event token receives `401` — checked before the `coming_soon` gate, so an invalid credential never learns whether the action would otherwise have been available.

Do not put the bearer token in a button URL, share link, or browser bookmark.
