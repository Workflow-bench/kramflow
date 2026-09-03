# Blocker remediation runbook — human-run Supabase steps

Two migrations are prepared and waiting in `supabase/migrations/`. Neither has
been applied to the live project — I have no DDL access. This document is the
exact sequence to run them safely, in order, with verification at each step.

**Do not skip the preflight queries.** They confirm the assumptions each
migration is built on are still true of the live database before it changes
anything.

Run everything in the Supabase SQL editor (or `psql`/the CLI against the
project), as a role with DDL rights. Both migrations are idempotent — safe to
re-run after a partial failure.

---

## 0. Before you start

- Confirm which project you're connected to (`select current_database();`
  or check the dashboard URL) — this must be the actual live Kramflow
  project, not a scratch/preview branch.
- These two migrations are independent — either can be applied without the
  other, in any order. Doing 0010 (collaborators) first is lower-risk if
  you want to split this into two sessions, since it needs no application
  code change at all.

---

## 1. Migration 0010 — collaborator invite columns (P1, lower risk)

**What it does:** adds three nullable columns
(`invited_by`, `invite_expires_at`, `accepted_at`) to `event_collaborators`.
No data rewrite, no backfill, no existing row touched.

**Application code impact:** none — the deployed code already assumes these
columns exist (it was written for the correct schema; the live DB was just
never migrated to match). No app deploy is needed alongside this one.

### 1.1 Preflight

```sql
select count(*) from event_collaborators;

select column_name from information_schema.columns
where table_name = 'event_collaborators'
  and column_name in ('invited_by', 'invite_expires_at', 'accepted_at');
```

**Expect:** the first query returns your current collaborator row count
(record it). The second returns **zero rows** — confirms the columns are
genuinely absent. If it returns any rows, stop and tell me before proceeding
— that means this migration (or an equivalent change) has already been
applied, and re-running it should still be safe (every `ADD COLUMN` is
`if not exists`-guarded) but the situation is different from what this
runbook assumes.

### 1.2 Apply

Run the full contents of `supabase/migrations/0010_collaborator_invite_columns.sql`.

### 1.3 Post-migration verification

```sql
select column_name, data_type, is_nullable
from information_schema.columns
where table_name = 'event_collaborators'
  and column_name in ('invited_by', 'invite_expires_at', 'accepted_at')
order by column_name;
```

**Expect:** 3 rows, all `is_nullable = 'YES'`. `invited_by` is `uuid`,
`invite_expires_at`/`accepted_at` are `timestamp with time zone`.

```sql
select count(*) from event_collaborators;
```

**Expect:** identical to the count recorded in 1.1.

### 1.4 App-level verification (safe, reversible — see §3 below for the full checklist)

Log in as the demo owner account, open **Settings** on an event with at
least one existing collaborator, and confirm the collaborator list loads (no
more "Couldn't load collaborators" / schema error). Then run the full
throwaway-invite test in §3 before considering this closed.

---

## 2. Migration 0009 — display-type-scoped Hold/Timer (P0, higher risk)

**What it does:** creates a new table, `display_type_state`, holding
Hold/Timer state per `(event, display_type)` instead of one shared row per
event. Backfills 4 rows per existing event from that event's current shared
`display_state` row, so nothing changes visibly until this migration's
matching application code (already written, on the `deep` branch, **not
deployed**) ships.

**Application code impact — sequencing matters here.** Deploy this migration
*before* the matching app code. Verified precisely what happens if the code
ships first, against this exact live schema:

- The **read path** (`/api/display-view`) degrades gracefully — still
  returns correct data, silently falling back to the old shared
  `display_state` values. No outage.
- The **write paths** (`PATCH /api/display-engine/timer` and `.../hold`)
  fail cleanly with a 500 (`"Could not find the table
  'public.display_type_state'..."`), surfaced as a normal error toast, not a
  crash. Only Presenter's own local timer/Hold controls are affected — the
  only display type that ever calls these two routes.

So the actual risk of a wrong order is narrow (Presenter's local controls
briefly show errors) and self-announcing — but apply the migration first
anyway; there's no reason to take even that degradation when doing it in
order costs nothing extra.

### 2.1 Preflight

```sql
select count(*) from display_state;
select count(*) from events;
```

**Expect:** `display_state`'s count is less than or equal to `events`' count
(one `display_state` row per event that has ever loaded a display). Record
both numbers.

```sql
select table_name from information_schema.tables
where table_name = 'display_type_state';
```

**Expect:** zero rows — confirms the table doesn't already exist.

### 2.2 Apply

Run the full contents of `supabase/migrations/0009_display_type_state.sql`.

### 2.3 Post-migration verification

```sql
select count(*) from display_type_state;
```

**Expect:** exactly `4 * <display_state count from 2.1>`.

```sql
-- Substitute a real event_id you know has a display_state row.
select display_type, hold, timer
from display_type_state
where event_id = '<event_id>'
order by display_type;
```

**Expect:** 4 rows (`av`, `general`, `green-room`, `presenter`), and every
row's `hold`/`timer` value identical to that event's `display_state` row —
confirms the backfill preserved current behavior exactly, nothing diverged
yet.

```sql
select policyname from pg_policies where tablename = 'display_type_state';
```

**Expect:** exactly one row, `event-scoped display_type_state`.

```sql
select tablename from pg_publication_tables
where pubname = 'supabase_realtime' and tablename = 'display_type_state';
```

**Expect:** exactly one row.

### 2.4 Then, and only then — deploy the application code

The application code for this fix is already committed locally on `deep`
(not pushed). Once 2.3's checks all pass, this is the point to deploy it.
**I will not deploy or push this without you telling me to** — that's
already a standing rule for this whole engagement, restated here because
this is the one change in this session where deploying out of order has a
real (if narrow) consequence.

### 2.5 Post-deploy app-level verification

See §4 below for the full multi-client checklist. At minimum:

1. Open `/presenter?eventId=<id>` as the authenticated owner (or via a real
   share link). Use Presenter's local timer controls (switch to manual,
   pause, adjust). Confirm no error toast.
2. In a second tab/device, open `/av?eventId=<id>` or `/green-room?...` for
   the **same event**. Confirm its own countdown is *unaffected* by step 1
   — this is the actual fix landing: before this migration, step 1 would
   have silently changed what this screen shows too.
3. On Presenter, trigger Hold. Confirm General/AV/Green Room in other tabs
   do **not** show the Hold takeover screen (before this fix, they would
   have).
4. Deactivate Hold on Presenter; confirm it clears only Presenter's own
   state, doesn't touch anything else.

---

## 3. Collaborator throwaway-invite verification (safe, reversible)

Run this after 1.3 passes, using a real event you own and an email address
you control that has **no existing Kramflow account** (so it exercises the
pending-invite path, not the immediate-accept path).

1. **Owner loads the list.** Settings → Collaborators. Confirm existing
   collaborators (if any) still show correctly, with correct roles.
2. **Create a throwaway invite.** Add the test email as `viewer`. Confirm
   the UI shows it as `pending` with no error.
3. **Verify expiry metadata landed.**
   ```sql
   select invited_email, status, invite_token, invited_by, invite_expires_at, accepted_at
   from event_collaborators
   where invited_email = '<test email>' and event_id = '<event id>';
   ```
   Expect one row: `status = 'pending'`, `invite_token` set,
   `invited_by` = your own user id, `invite_expires_at` ≈ now + the
   configured expiry window, `accepted_at` = null.
4. **Revoke/remove it.** Use the UI's remove action on the pending invite.
   Confirm it disappears from the list.
5. **Confirm cleanup.**
   ```sql
   select count(*) from event_collaborators
   where invited_email = '<test email>' and event_id = '<event id>';
   ```
   Expect `0` (remove deletes the row) — or, if the app's remove semantics
   changed to a soft-revoke instead, confirm the row's `status` reflects
   that instead of silently vanishing. Either way, confirm no *other*
   collaborator row was touched:
   ```sql
   select invited_email, status from event_collaborators where event_id = '<event id>';
   ```
   Compare against what you recorded in step 1.
6. **Editor/viewer behavior**, if you have a second real test account
   available: log in as an existing editor or viewer collaborator, confirm
   they still see exactly the access level their role grants (editor: can
   edit the cue sheet, cannot go live; viewer: read-only) — this migration
   doesn't touch role logic, so this is a regression check, not a new
   behavior to verify.

Do not run this against a real collaborator's row — only ever a throwaway
address you control, and always clean it up in step 4.

---

## 4. Same-tab / multi-operator verification (no migration needed — see the
main report for what changed and why)

1. **Owner tab, single operator.** Press Next. Confirm the pressed button
   shows pending state immediately, then reflects the real result the
   moment the server responds — not delayed until a separate Realtime
   round-trip.
2. **Two tabs, same owner.** Tab A presses Next. Confirm Tab B updates
   within its normal Realtime latency, and Tab A never shows a state that
   Tab B later contradicts.
3. **Two operators, artificial latency** (throttle one tab's network in
   devtools). Confirm the slower tab never shows a false "succeeded" state
   for an action that the server actually rejected (stale version /
   control lease lost).
4. **Rejected action.** Force a version conflict (e.g. two rapid Next
   presses from different tabs) and confirm the loser sees a real error,
   not a silently-reverted optimistic state.
5. **Control lost mid-action.** Tab A holds control; Tab B takes over
   between Tab A's click and the server's response. Confirm Tab A surfaces
   the lock error rather than showing its own action as successful.
6. **Reconnect.** Disconnect Tab A's network, take an action (should
   queue/fail visibly, not silently), reconnect, confirm state
   reconciles correctly with no duplicate/lost action.

Full narrative results for whichever of these were actually exercised this
session are in the main remediation report, not repeated here.
