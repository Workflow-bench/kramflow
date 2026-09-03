# Final release migration package — human-run Supabase steps

**Status: RELEASE HOLD.** Two migrations are prepared and committed on the
`deep` branch. Neither has been applied to the live project. Nothing on
`deep` has been pushed, merged, or deployed, and none of it will be until
these are applied and confirmed. This document is the complete, exact
handoff package for the person with Supabase access to apply them safely.

**Do not skip the preflight queries.** They confirm the assumptions each
migration is built on are still true of the live database before it changes
anything.

Run everything in the Supabase SQL editor (or `psql`/the CLI against the
project), as a role with DDL rights. Both migrations are idempotent — safe
to re-run after a partial failure.

---

## 0. Target project

**Project ref:** `ledtrtpxvmcpwupafehk`
**Project URL:** `https://ledtrtpxvmcpwupafehk.supabase.co`

Confirm you are connected to this exact project before running anything —
check the dashboard URL, or run `select current_database();` and cross-check
against the project settings. This must be the actual live Kramflow
project, not a scratch/preview branch. (For context: an automated
verification pass earlier in this engagement found a different Supabase
tool connected to an unrelated organization entirely, with no visibility
into this project — a good reminder to double-check the connection before
running DDL, not just trust whichever project a tool happens to default to.)

## Migration order

1. **`0009_display_type_state.sql`**
2. **`0010_collaborator_invite_columns.sql`**

They are independent — neither's SQL references the other, and nothing in
the application requires one to land before the other. This order is the
recommended default (0009 fixes the higher-severity issue), but if it's
more convenient to split this into two sessions, 0010 first is lower-risk
to warm up with: it needs no application code change alongside it at all,
where 0009 does (§1.5 below).

---

## 1. Migration 0009 — display-type state isolation (P0)

### 1.1 What this actually fixes

**Correct framing — this is not primarily a "share-link authorization"
migration.** Event-wide display-link *viewing* (any link can open any of
General/AV/Green Room/Presenter at `/screens`) is intentional, documented
product behavior — see `app/screens/page.tsx`'s own comment: "KramFlow
hands out one link and lets whoever opens it choose the screen." That is
not being changed, and nothing in this migration touches it.

What this migration fixes is **display-type state isolation**: `hold` and
`timer` were one shared row per *event* (`display_state`), not per display
type. Only Presenter's own UI ever mutates them (confirmed via a full grep
of every display client — General/AV/Green Room only ever read
`engine.hold`/`engine.timer`), but because the state was shared, a
Presenter-local timer adjustment or Hold toggle silently changed what
General/AV/Green Room showed too. Specifically:

**Presenter-local timer/hold mutation must not modify General/AV/Green
Room state.** Before this migration, it did. This migration creates the
per-display-type table the already-written, already-committed application
code (on `deep`, not deployed) reads and writes instead of the old shared
row.

### 1.2 Preflight

```sql
select count(*) from display_state;
select count(*) from events;
```

**Expect:** `display_state`'s count is less than or equal to `events`'
count (one `display_state` row per event that has ever loaded a display).
Record both numbers — the second query's count is what §1.6's postflight
check multiplies by 4.

```sql
select table_name from information_schema.tables
where table_name = 'display_type_state';
```

**Expect:** zero rows — confirms the table doesn't already exist.

### 1.3 What this migration does

- Creates `display_type_state`: one row per `(event_id, display_type)`,
  `display_type` constrained to the four real types (`presenter`,
  `green-room`, `av`, `general` — `'custom'` displays fall back to reading
  the `presenter` row, matching `lib/display-engine/types.ts`'s existing
  `DISPLAY_TYPES` documentation).
- Enables RLS with one `select`-only policy for authenticated users with
  event access — same shape as `display_state`'s own policy. Anonymous
  share-link readers never touch this table directly; they go through
  `app/api/display-view/route.ts`'s service-role client, which already
  independently verifies the token.
- Registers the table on the `supabase_realtime` publication (idempotent —
  guarded by an existence check).
- Backfills exactly 4 rows per existing `display_state` row (see §1.4).

### 1.4 Backfill behavior

One row per `(existing event, each of the 4 real display types)`, seeded
from that event's *current* `display_state.hold`/`.timer`/`.timer_version`
values via a cross join — not a loop, not a default-value seed. This means
every display shows **exactly what it shows right now**, immediately after
this migration runs — nothing changes visibly until the matching
application code (§1.5) is deployed. No historical data is fabricated:
there is no history to backfill (Hold/Timer are current-state fields, not
event logs), so seeding from the current live value is the only honest
choice, not an approximation of one.

### 1.5 Deployment ordering — apply the migration before the app code

The application code for this fix is already committed locally on `deep`,
**not pushed, not deployed**. Apply this migration *before* that code
ships. Verified precisely (not assumed) what happens if the code ships
first, against this exact live schema:

- The **read path** (`/api/display-view`) degrades gracefully — still
  returns correct data, silently falling back to the old shared
  `display_state` values. No outage.
- The **write paths** (`PATCH /api/display-engine/timer` and `.../hold`)
  fail cleanly with a 500 (`"Could not find the table
  'public.display_type_state'..."`), surfaced as a normal error toast, not
  a crash. Only Presenter's own local timer/Hold controls are affected —
  the only display type that ever calls these two routes.

So the actual risk of a wrong order is narrow (Presenter's local controls
briefly show errors) and self-announcing — but there's no reason to take
even that degradation when doing it in order costs nothing extra.

### 1.6 Post-migration verification

```sql
select count(*) from display_type_state;
```

**Expect:** exactly `4 * <display_state count from §1.2>`.

```sql
-- Substitute a real event_id you know has a display_state row.
select display_type, hold, timer
from display_type_state
where event_id = '<event_id>'
order by display_type;
```

**Expect:** 4 rows (`av`, `general`, `green-room`, `presenter`), and every
row's `hold`/`timer` value identical to that event's `display_state` row —
confirms the backfill preserved current behavior exactly.

```sql
select policyname from pg_policies where tablename = 'display_type_state';
```

**Expect:** exactly one row, `event-scoped display_type_state`.

```sql
select tablename from pg_publication_tables
where pubname = 'supabase_realtime' and tablename = 'display_type_state';
```

**Expect:** exactly one row.

### 1.7 What NOT to touch

- **Do not** alter or drop `display_state.hold`/`.timer`/`.timer_version`.
  They intentionally become dead weight once the app code ships (nothing
  reads/writes them anymore for Hold/Timer) — removing them is a separate,
  later cleanup migration, deliberately not bundled with this
  security-sensitive fix. `display_state.speaker_ready` and `.updated_at`
  are untouched and keep working exactly as before — `speaker_ready` is
  genuinely event-wide (Green Room sets it, Remote/operators read it), not
  a per-display-type concept, so it correctly stays where it is.
- **Do not** add a 5th `display_type` value or widen the check constraint
  — `'custom'` displays are handled by falling back to the `presenter` row
  in application code, not a database row of their own.
- **Do not** deploy the matching application code before this migration
  lands (§1.5).

### 1.8 Rollback / mitigation

If something goes wrong after applying: `display_state` is completely
untouched by this migration, so every display continues rendering exactly
as it did before, using the old shared row, with zero user-visible impact
— rollback is "do nothing further," not an emergency. To fully undo the
migration itself (only if genuinely necessary, and only before the
matching app code has been deployed):

```sql
begin;
alter publication supabase_realtime drop table if exists display_type_state;
drop policy if exists "event-scoped display_type_state" on display_type_state;
drop table if exists display_type_state;
commit;
```

Do not run this after the app code has been deployed — that would put the
write paths back into the "table not found" 500 state described in §1.5.

### 1.9 Exact SQL

Source of truth: `supabase/migrations/0009_display_type_state.sql` (has
the full rationale in comments; reproduced verbatim below, comments
included, for a direct copy-paste without needing to open the file
separately):

```sql
begin;

create table if not exists display_type_state (
  id bigint generated always as identity primary key,
  event_id uuid not null references events(id) on delete cascade,
  -- 'custom' (a registered display with no real type assigned yet, or a
  -- one-off) intentionally has no row of its own — DISPLAY_TYPES already
  -- documents it as falling back to Presenter's own route
  -- (lib/display-engine/types.ts), so it reads/writes the 'presenter' row,
  -- same as an actual Presenter display. Keeping the check constraint to
  -- exactly the four real display types (not five) matches "don't build a
  -- bigger permission model than the four known outputs actually need."
  display_type text not null check (display_type in ('presenter', 'green-room', 'av', 'general')),
  hold jsonb not null default '{"active":false,"message":"Please Stand By","subMessage":null,"continueClock":false,"activatedAt":null}'::jsonb,
  timer jsonb not null default '{"mode":"program","source":"auto","startedAt":null,"durationSeconds":300,"pausedAt":null,"adjustmentSeconds":0,"thresholds":{"yellowAt":300,"orangeAt":60,"redAt":0,"criticalAfter":60}}'::jsonb,
  -- Same optimistic-concurrency reasoning as display_state.timer_version
  -- (see schema.sql's comment on it) — scoped per row here, so a
  -- concurrent Presenter timer PATCH can never spuriously conflict with a
  -- Green Room or AV row's own version counter, which display_state's one
  -- shared counter could previously do.
  timer_version integer not null default 0,
  updated_at timestamptz not null default now(),
  unique (event_id, display_type)
);

create index if not exists display_type_state_event_id_idx on display_type_state(event_id);

alter table display_type_state enable row level security;

-- Same shape as display_state's own policy — authenticated operators with
-- real access to the event (owner or accepted collaborator) can read every
-- display type's row for their own event (used by Displays/Broadcast
-- Center's fleet views, which are allowed to see the whole picture). No
-- anon policy, same reasoning as every other display-engine table: an
-- anonymous share-link visitor is resolved and read exclusively through
-- app/api/display-view/route.ts's service-role client, which bypasses RLS
-- because the event_id (and now display_type) it queries with was already
-- verified server-side by verifyDisplayAccess(), not accepted blindly from
-- the request.
drop policy if exists "event-scoped display_type_state" on display_type_state;
create policy "event-scoped display_type_state" on display_type_state for select to authenticated using (has_event_access(event_id));

-- Realtime — authenticated operators previewing a display (e.g. from the
-- Dashboard's "Preview a display" links, or Displays management's own
-- Preview button) read this table directly via Supabase Realtime, same as
-- display_state/display_registry/display_broadcasts already do.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'display_type_state'
  ) then
    execute 'alter publication supabase_realtime add table display_type_state';
  end if;
end $$;

-- Backfill — one row per (existing event, real display type), seeded from
-- that event's current shared display_state row, so hold/timer values are
-- identical to what every display already shows immediately before this
-- migration runs. cross join, not a loop: display_state has at most one
-- row per event_id (the unique constraint from migration 0001), so this
-- produces exactly 4 new rows per existing display_state row.
insert into display_type_state (event_id, display_type, hold, timer, timer_version)
select ds.event_id, dt.display_type, ds.hold, ds.timer, ds.timer_version
from display_state ds
cross join (values ('presenter'), ('green-room'), ('av'), ('general')) as dt(display_type)
where ds.event_id is not null
on conflict (event_id, display_type) do nothing;

commit;
```

### 1.10 Application features blocked until applied

- Display-type state isolation itself (the P0 fix) — the corresponding app
  code cannot be deployed until this lands (§1.5).
- Presenter's own local Hold/Timer controls will 500 if the app code is
  ever deployed ahead of this migration (§1.5) — not currently a live risk
  since neither has shipped yet.

---

## 2. Migration 0010 — collaborator invite columns (P1)

### 2.1 What this fixes

`event_collaborators` on the live database is missing three columns the
already-deployed application code already assumes exist:
`invited_by`, `invite_expires_at`, `accepted_at`. `supabase/schema.sql`
already defines all three (its own comment says they were "added alongside
this comment") — the live database was simply never migrated to match.
Migration 0006 added `id`/`status`/`invite_token` to this table; it did
not add these three. This is the exact, already-reproduced live error:
`"column event_collaborators.invite_expires_at does not exist"`.

This restores schema parity for the *existing* collaborator-invite
workflow — it does not change invite/role logic, and it does not touch any
existing collaborator's access level.

### 2.2 Preflight

```sql
select count(*) from event_collaborators;

select column_name from information_schema.columns
where table_name = 'event_collaborators'
  and column_name in ('invited_by', 'invite_expires_at', 'accepted_at');
```

**Expect:** the first query returns your current collaborator row count
(record it). The second returns **zero rows** — confirms the columns are
genuinely absent. If it returns any rows, stop and report it before
proceeding — every `ADD COLUMN` below is `if not exists`-guarded so
re-running is still safe, but the situation would differ from what this
runbook assumes and is worth understanding first.

### 2.3 What this migration does / backfill behavior

Adds three **nullable** columns, no data rewrite, no existing row touched,
**no backfill for any existing row**:

- `invited_by` — left `NULL` for existing rows. Genuinely unknown who sent
  a pre-existing invite; not defaulted to the event owner, since that would
  misattribute invites an editor might have sent (if that's ever permitted)
  and is factually wrong for the common case of an owner adding their own
  team.
- `invite_expires_at` — left `NULL` for existing rows (both accepted rows,
  where it never applied, and any row predating this column).
- `accepted_at` — **deliberately not backfilled** to `created_at` or any
  other value for existing `'accepted'` rows. The collaborator GET route
  doesn't even return this column to the client for existing rows today,
  so nothing reads it — inventing a value would be exactly the fabricated
  historical metadata this whole engagement was instructed not to
  introduce. `NULL` is the honest value for "this row predates the feature
  that populates this column."

**Existing collaborator access is unaffected** — `role`, `status`,
`user_id`, `invited_email` are untouched by this migration; §2.6 and §4
below verify this directly.

### 2.4 Deployment ordering

No application code change is needed alongside this migration — the
deployed code already assumes the correct schema (it was written for it;
the live database just hasn't caught up). No app deploy is required at the
same time as this migration.

### 2.5 Apply

Run the SQL in §2.8 (or the source file directly, see below).

### 2.6 Post-migration verification

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

**Expect:** identical to the count recorded in §2.2 — no row added,
removed, or (for pre-existing columns) modified.

```sql
-- Confirm no existing collaborator's access changed.
select invited_email, role, status, user_id from event_collaborators order by created_at;
```

**Expect:** identical to what you'd see running the same query before this
migration — every existing collaborator's `role`/`status`/`user_id`
unchanged. Compare against a pre-migration snapshot if you took one.

### 2.7 What NOT to touch

- **Do not** backfill `accepted_at`, `invited_by`, or `invite_expires_at`
  for existing rows, for any reason — see §2.3's reasoning for why `NULL`
  is the correct, honest value.
- **Do not** modify `role`, `status`, `user_id`, or `invited_email` on any
  existing row as part of this migration.
- **Do not** run the throwaway-invite test (§4) against a real
  collaborator's row — only ever a test address you control.

### 2.8 Exact SQL

Source of truth: `supabase/migrations/0010_collaborator_invite_columns.sql`:

```sql
begin;

alter table event_collaborators
  add column if not exists invited_by uuid references auth.users(id) on delete set null,
  add column if not exists invite_expires_at timestamptz,
  add column if not exists accepted_at timestamptz;

comment on column event_collaborators.invited_by is
  'Who sent this invite — the owner (or, in the future, an editor if that''s ever permitted) at the time the row was created. NULL for rows created before this column existed; genuinely unknown, not backfilled.';

comment on column event_collaborators.invite_expires_at is
  'When a pending invite stops being acceptable — enforced by lib/server/collaborator-invites.ts. NULL for already-accepted rows and any row that predates this column.';

comment on column event_collaborators.accepted_at is
  'When a pending invite was accepted, or when an immediate-match invite was created already-accepted. NULL for rows created before this column existed — not backfilled to created_at, since nothing in the app reads this column for pre-existing rows today.';

commit;
```

### 2.9 Rollback / mitigation

Three nullable columns with no backfill — there is nothing for existing
rows to lose. If genuinely necessary to undo (only before any real invite
has been created against the new columns):

```sql
begin;
alter table event_collaborators
  drop column if exists invited_by,
  drop column if exists invite_expires_at,
  drop column if exists accepted_at;
commit;
```

This would put the collaborator invite feature back into its current,
broken (schema-mismatch) state — only do this if the migration itself
caused a problem, not as a way to "undo" a test invite (use the app's own
revoke/remove action for that, see §4).

### 2.10 Application features blocked until applied

- Creating a new collaborator invite (`POST /api/events/[eventId]/collaborators`)
  — currently 500s with the exact `invite_expires_at does not exist` error.
- The collaborator list itself may already work for *reading* existing
  rows (it doesn't select the new columns unconditionally in every path),
  but the pending-invite creation/expiry flow is fully blocked until this
  lands.

---

## 3. After both migrations — full postflight checklist

Run both migrations' individual postflight queries (§1.6, §2.6) first.
Then:

```sql
-- One combined sanity check across both migrations.
select
  (select count(*) from display_type_state) as display_type_state_rows,
  (select count(*) from event_collaborators
     where invited_by is null and invite_expires_at is null and accepted_at is null) as pre_migration_collaborator_rows,
  (select count(*) from event_collaborators) as total_collaborator_rows;
```

**Expect:** `display_type_state_rows` = `4 * <display_state count>`;
`pre_migration_collaborator_rows` = the count recorded in §2.2 (every
existing row still has all three new columns `NULL`, confirming no
fabricated backfill occurred); `total_collaborator_rows` unchanged from
before either migration.

### 3.1 Then, and only then — deploy the application code

The application code for both fixes is already committed locally on
`deep`, **not pushed**. **I will not deploy or push this without explicit
confirmation the migrations have been applied and verified** — standing
rule for this whole engagement. Once this section's checks all pass, tell
me and I'll proceed with the release-verification sequence below, then
wait for further approval before push/deploy.

---

## 4. Collaborator throwaway-invite verification (safe, reversible)

Run this after §2's postflight passes, using a real event you own and an
email address you control that has **no existing Kramflow account** (so it
exercises the pending-invite path, not the immediate-accept path).

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
   Expect `0` (remove deletes the row). Confirm no *other* collaborator row
   was touched:
   ```sql
   select invited_email, status from event_collaborators where event_id = '<event id>';
   ```
   Compare against what you recorded in step 1.
6. **Editor/viewer behavior**, if you have a second real test account
   available: log in as an existing editor or viewer collaborator, confirm
   they still see exactly the access level their role grants — this
   migration doesn't touch role logic, so this is a regression check, not a
   new behavior to verify.

Do not run this against a real collaborator's row — only ever a throwaway
address you control, and always clean it up in step 4.

---

## 5. Display-type state isolation verification (post-deploy, needs §1 applied + app code deployed)

1. Open `/presenter?eventId=<id>` as the authenticated owner (or via a real
   share link). Use Presenter's local timer controls (switch to manual,
   pause, adjust). Confirm no error toast.
2. In a second tab/device, open `/av?eventId=<id>` or `/green-room?...` for
   the **same event**. Confirm its own countdown is *unaffected* by step 1.
3. On Presenter, trigger Hold. Confirm General/AV/Green Room in other tabs
   do **not** show the Hold takeover screen.
4. Deactivate Hold on Presenter; confirm it clears only Presenter's own
   state, doesn't touch anything else.

---

## 6. Same-tab / multi-operator verification (no migration needed — already live-verified this engagement, re-verify post-deploy)

1. **Owner tab, single operator.** Press Next. Confirm it reflects the real
   result the moment the server responds, not delayed until a separate
   Realtime round-trip.
2. **Two tabs, same owner.** Tab A presses Next. Confirm Tab B updates
   within normal Realtime latency, and Tab A never shows a state Tab B
   later contradicts.
3. **Rejected action / control lost mid-action.** Tab A holds control; Tab
   B takes over between Tab A's click and the server's response. Confirm
   Tab A surfaces the lock error rather than showing its own action as
   successful.
4. **Reconnect.** Disconnect Tab A's network, take an action (should fail
   visibly, not silently), reconnect, confirm state reconciles correctly.

---

## 7. Session-specific reset verification (no migration needed)

1. Two sessions, both with some progress/actuals. Reset session B only
   (Cue Sheet → session selector → **⋯** → **Reset session progress** →
   confirm the dialog names session B specifically).
2. Confirm session A's position, Hold state, and item timing are
   completely unaffected.
3. Confirm session B returns to "Press Start" / shows a **Planned finish**
   (not Projected) on Console.
4. Confirm the activity log shows `Reset progress for "<session B>"`.
5. Confirm the Timing Report for session B shows the "progress was reset…"
   state (not "still in progress," not a fabricated final summary) if it
   had any prior actuals.
6. Concurrency: attempt a reset from a tab that does not hold the control
   lease — confirm it's rejected (423), same as every other locked action.

---

## 8. Canonical timing / report verification (no migration needed)

1. Console: current-item drift line and Projected/Planned finish line
   render correctly for a live and a not-yet-started session.
2. Timing Report (Cue Sheet → **⋯** → **Timing Report**): planned vs.
   actual, item-by-item variance, and Notable Exceptions render correctly
   for a finished and an in-progress session.
3. Confirm `SessionSummary` (Console's post-finish panel) and the Timing
   Report agree on actual runtime for the same session — one canonical
   source (`lib/timing.ts`), not two.

---

## 9. Display Profiles removal verification (no migration needed)

Confirm the Displays page no longer presents profile creation/editing or
per-display profile assignment as an active output feature — this was
removed (not hidden-but-still-there) since no real display ever consumed
profile data. Confirm display registration, rename/type/room
configuration, Preview, Diagnose (including the relabeled "Capture Screen"
tool), Reload, and Remove all still work normally.

---

## 10. Known test artifacts (informational — not a blocker, not urgent cleanup)

Two harmless artifacts accumulated on the live demo data during this
engagement's extensive live-verification testing. Neither affects
correctness or blocks release:

- **A stray, empty "Untitled Event"** — appeared during testing, contains
  no sessions. Do not delete it as part of applying these migrations. If
  it can later be conclusively confirmed as test-created (e.g. by creation
  timestamp/owner matching this engagement's test account) and safely
  removed through the app's own normal delete-event flow, it's reasonable
  to include in final pre-release cleanup — but do not perform that
  cleanup now, and never as a side effect of a database migration session.
- **A transient control-lease claim** on the demo event's `live_state` —
  self-expires within the existing 45-second staleness window
  (`CONTROLLER_STALE_MS` in `app/api/live/route.ts`); needs no manual
  action.

Do not touch any other demo/event data as part of applying these
migrations — both artifacts above are inert and unrelated to the schema
changes themselves.
