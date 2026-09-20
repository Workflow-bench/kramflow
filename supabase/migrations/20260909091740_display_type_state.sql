-- ============================================================================
-- 0009_display_type_state.sql
--
-- SECURITY / OPERATIONAL-INTEGRITY FIX — display_state's Hold/Timer are
-- currently one row per *event*, not per *display type*. Verified live
-- against this exact schema (migration 0001's `display_state_event_id_key
-- unique (event_id)`) during the 2026-09 blocker-remediation pass:
--
--   - app/api/display-engine/timer/route.ts and .../hold/route.ts both
--     accept any token/session that verifyDisplayAccess() resolves to the
--     event — which, by the *documented, intentional* design of
--     app/screens/page.tsx ("KramFlow hands out one link and lets whoever
--     opens it choose the screen"), is EVERY share link minted for the
--     event, regardless of which of General/AV/Green Room/Presenter it
--     was meant for.
--   - Only Presenter's UI ever calls the mutating timer/hold functions
--     (activateHold/deactivateHold/pauseTimer/resumeTimer/resetTimer/
--     adjustTimer/setTimerMode/setTimerSource — confirmed via a full grep
--     of every display client; General/AV/Green Room only ever *read*
--     engine.hold/engine.timer to render <HoldScreen> or hide their own
--     content).
--   - lib/display-engine/use-display-timer.ts's useDisplayTimer() reads
--     the *shared* timer.source field even when a caller (AV, Green Room)
--     always passes its own real auto-derived program input — so flipping
--     timer.source to "manual" via one PATCH call (using a token minted
--     for, say, a lobby General display) silently swaps AV's and Green
--     Room's own shown countdown to the same attacker-controlled manual
--     value, not just Presenter's own confidence monitor. Hold has the
--     same reach: display_state.hold drives <HoldScreen> on all four
--     display types, including the audience-facing General display.
--
-- This does NOT change the intentional, documented event-wide *viewing*
-- model (any link can still pick any of the four screens at /screens) —
-- only the blast radius of Presenter's own *mutation* capability, which
-- code comments throughout the display-engine subsystem already call
-- "Presenter's own controls" and clearly intended to be scoped to
-- Presenter's own output, not the whole venue's displays.
--
-- Approach: a NEW table (display_type_state), not an ALTER of the
-- existing display_state — deliberately additive/non-destructive:
--   - display_state's `hold`/`timer`/`timer_version` columns are left in
--     place, untouched, but become dead weight once the matching
--     application-code change (same commit as this migration) ships —
--     removing them is a separate, later cleanup migration once this one
--     is confirmed working in production, not bundled with a
--     security-sensitive access-control fix.
--   - display_state's `speaker_ready` and `updated_at` columns are
--     UNCHANGED and keep working exactly as before — speaker-ready is a
--     genuinely event-wide concept (Green Room sets it, Remote/the
--     operator read it), not a per-display-type one, so it correctly
--     stays where it is.
--   - Existing events are backfilled with 4 rows each (presenter,
--     green-room, av, general), seeded from their current shared
--     display_state row, so behavior is IDENTICAL immediately after this
--     migration runs — nothing changes for any event until the app code
--     (deployed in the same release as this migration) actually starts
--     reading/writing the new table, and even then only Presenter's own
--     local adjustments ever diverge a row from the others.
--
-- Preflight (run before applying — see the runbook in
-- docs/BLOCKER_REMEDIATION_RUNBOOK.md for the full sequence):
--   select count(*) from display_state;
--   select count(*) from events;
-- Expect display_state's count to be <= events' count (one row per event
-- that has ever loaded a display), and both counts to be whatever they
-- currently are — this migration doesn't delete or lock either table.
--
-- Deployment ordering: apply this migration before deploying the matching
-- application code, but verified precisely (not assumed) what happens if
-- the code ships first, against this exact live schema:
--   - The READ path (app/api/display-view/route.ts) degrades gracefully —
--     confirmed live: with the table absent, it still returns ok:true
--     with every other field correct, silently falling back to
--     display_state's own (still-shared) hold/timer values exactly as
--     today. General/AV/Green Room/Presenter's own passive rendering is
--     unaffected either way.
--   - The WRITE paths (app/api/display-engine/timer/route.ts and
--     .../hold/route.ts) fail cleanly — confirmed live: a 500 with
--     {"ok":false,"error":"Could not find the table
--     'public.display_type_state' in the schema cache"}, which the
--     existing client error handling already surfaces as a normal toast
--     ("Couldn't ... — try again"), not a crash. Only Presenter's own
--     local timer/hold controls are affected (the only display type that
--     ever calls these routes) — General/AV/Green Room never call them.
-- Net effect of deploying the code first: Presenter's local controls stop
-- working (with a clear, visible error) until this migration runs; every
-- other surface — including the actual security fix's blast-radius
-- containment, since the shared display_state.hold/timer become
-- unreachable dead columns the moment nothing calls them anymore — is
-- unaffected. Still: apply the migration first. There's no reason to take
-- even that narrow, self-announcing degradation when sequencing correctly
-- costs nothing.
--
-- Safe to run once; every statement is idempotent (if not exists / on
-- conflict do nothing), so a re-run after a partial failure is safe.
-- ============================================================================

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

-- ============================================================================
-- Post-migration verification — see docs/BLOCKER_REMEDIATION_RUNBOOK.md
-- for the full, exact queries and expected results. Summary:
--   1. select count(*) from display_type_state;
--      expect: 4 * (select count(*) from display_state where event_id is not null)
--   2. For one known event_id, select display_type, hold, timer from
--      display_type_state where event_id = '<id>' order by display_type;
--      expect: 4 rows, hold/timer identical to that event's display_state
--      row (general/av/green-room/presenter) — confirms the backfill
--      preserved current behavior exactly.
--   3. select policyname from pg_policies where tablename =
--      'display_type_state'; expect exactly one row,
--      "event-scoped display_type_state".
--   4. select tablename from pg_publication_tables where pubname =
--      'supabase_realtime' and tablename = 'display_type_state'; expect
--      exactly one row.
-- ============================================================================
