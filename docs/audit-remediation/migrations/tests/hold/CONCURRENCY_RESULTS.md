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

## Same-timestamp conflict (B009 r7): timestamp witness is insufficient, revision witness works
Script: `hold_same_ts.sh <db> <ts|rev>`. Hold M1 (rev r1, activatedAt T). Session A deactivates from a stale read. Session B commits activation M2 (rev r2) with the SAME activatedAt T.
- `ts` (witness = activatedAt): `A_exit=0 B_exit=0`, final `{"active": false, "message": "M1", "activatedAt": null}`. The stale deactivation overwrote the committed M2. Lost update confirmed for same-millisecond activations.
- `rev` (witness = hold->>rev): `A_exit=0 B_exit=0`, final `{"active": true, "message": "M2", "rev": "r2"}`. The stale write matched zero rows and changed nothing; the route's bounded retry then deactivates the current hold.

Decision: the activation writes a per-activation revision (`crypto.randomUUID()`), and the deactivation witness is `hold->>rev`. Rows written before this change carry no rev and keep the activatedAt witness, so same-millisecond conflicts on those legacy rows remain possible. No migration: `hold` is free-form jsonb.

## Real PostgREST client syntax (not the unit fake)
`lib/hold-postgrest-syntax.test.ts` uses `@supabase/postgrest-js` from node_modules with a capturing fetch. Verified emitted requests: `PATCH …/display_type_state?…&hold->>rev=eq.<value>` and `hold->>activatedAt=is.null`, with `select=hold` for row counting. Server-side translation of `col->>key` filters is PostgREST behaviour; the same predicate is verified as SQL above. No PostgREST binary is installed and the sandbox blocks the registry, so a live PostgREST run was not possible here (external, local-tooling gap).
