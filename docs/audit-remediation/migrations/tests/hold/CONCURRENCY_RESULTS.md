# Hold deactivation: lost update and fix (B009, KF-031)

Local Postgres 16.15, disposable database `b9_hold`, two real psql sessions. Script: `hold_lost_update.sh <db> <rmw|cas>`. Setup: `hold_setup.sql`. Scenario: hold is active with message M1. Session A deactivates (read, then write). Session B commits an activation with message M2 while A is between its read and its write.

## Reproduction, route's previous behaviour (rmw)
Output (`mode=rmw A_exit=0 B_exit=0`):
- final hold: `{"active": false, "message": "M1", "activatedAt": null}`
- Confirmed lost update: B's committed activation (M2) is overwritten by A's stale merge. The message reverts to M1 and the activation timestamp is cleared.

## Corrected behaviour (cas)
Output (`mode=cas A_exit=0 B_exit=0`):
- final hold: `{"active": false, "message": "M2", "activatedAt": null}`
- Notices: `attempt 1 wrote 0` (the witness changed, so the conditional write matched no row), `attempt 2 wrote 1`.

## Application fix
`app/api/display-engine/hold/route.ts`, deactivation branch: read the hold, then write `{...current, active:false, activatedAt:null}` conditionally on the `activatedAt` witness (`hold->>activatedAt` equal, or IS NULL when absent). Zero rows: re-read and retry, up to 3 attempts. Still conflicting: HTTP 409 and no write. Activation is unchanged (it sets the whole hold; its message is the intended new state).

Tests (`app/api/display-engine/hold/route.test.ts`, 9 total, 4 new):
- concurrent activation between read and write: retry deactivates it; M2 survives.
- unrelated fields preserved (message, subMessage, continueClock).
- three conflicting writes: 409; the last concurrent write is not overwritten.
- null witness (no activatedAt): IS NULL branch.
Negative control: the previous route (git HEAD) fails the two concurrency tests (`2 failed | 7 passed`); the fixed route passes all nine.

Tenant boundary: every hold write and conditional write filters by `event_id` and `display_type` (unchanged). `hold_persistence.sql` checks that a write for event A never touches event B.

Limits: this is a local mirror of the statements. Not the Supabase runtime; no PostgREST path-filter verification against the live API; no RLS. The `->>` path filter in supabase-js is covered by the unit fake only.
