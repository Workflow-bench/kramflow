begin;
 
-- ----------------------------------------------------------------------------
-- 0. Preflight — fail loudly if the dependency this migration assumes
-- (event_collaborators.status, from the earlier collaborator-invite
-- migration) isn't there yet, instead of applying half-correct RLS.
-- ----------------------------------------------------------------------------
 
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'event_collaborators' and column_name = 'status'
  ) then
    raise exception
      'event_collaborators.status does not exist. Run the earlier collaborator-invite migration (adds id/status/invite_token to event_collaborators) before this one — this migration''s activity_log policy depends on it.';
  end if;
end $$;
 
-- ----------------------------------------------------------------------------
-- 1. live_state — item-level actuals only. No identity columns here — see
-- the header comment above for why. item_actuals is timing data (program
-- item id -> { actualStart, actualEnd }), not PII; staying on this
-- publicly-readable row is fine, and matches the existing
-- progress_by_session / notes_overrides JSONB-map pattern already on this
-- table.
--
-- NOT NULL DEFAULT '{}' is safe to add in one statement (Postgres 11+
-- computes the default once, does not rewrite existing rows) — existing
-- rows start with no recorded actuals, which is honest: there is no
-- historical actuals data to reconstruct.
--
-- Deliberately excluded from the `reset` action's patch in
-- app/api/live/route.ts (an application-code change alongside this
-- migration, not part of the SQL) — a session/rehearsal-adjacent reset on
-- the real console does not erase real timing history. Rehearsal itself
-- (app/e/[eventId]/rehearsal/page.tsx) never calls /api/live at all —
-- verified directly in that file's own code and comments — so it cannot
-- write here regardless.
-- ----------------------------------------------------------------------------
 
alter table live_state
  add column if not exists item_actuals jsonb not null default '{}'::jsonb;
 
comment on column live_state.item_actuals is
  'Map of program item id -> { actualStart, actualEnd } (ISO timestamps). actualStart is overwritten each time an item becomes current (start/next/previous/jumpTo landing on it); actualEnd is written only on forward progress away from it (next/finish/a forward jumpTo), never on a rewind. Reflects the most recent pass through each item, not a full visit history — activity_log is the source for that. Not cleared by the reset action. Never written by Rehearsal, which does not call this table''s write path.';
 
-- ----------------------------------------------------------------------------
-- 2. activity_log — actor identity. Existing rows have no recorded actor
-- and stay NULL (never backfilled with a guess, per the "handle existing
-- rows explicitly" requirement). This table is NOT publicly readable after
-- section 4 below, so unlike live_state, storing a real name here is fine —
-- it's visible only to the event's own owner/accepted collaborators.
-- ----------------------------------------------------------------------------
 
alter table activity_log
  add column if not exists actor_user_id uuid references auth.users(id) on delete set null,
  add column if not exists actor_name text;
 
comment on column activity_log.actor_user_id is
  'Who performed this action. Nullable — pre-migration rows have no recorded actor; never backfilled with a guess.';
 
comment on column activity_log.actor_name is
  'Denormalized display name for actor_user_id at the time of the action, so the log stays readable even if the account is later renamed or removed. Also the source for "who currently has control" — resolved client/server-side as the most recent claimControl/releaseControl row for the event, cross-checked against live_state.controller_id/controller_claimed_at, not stored redundantly on the public live_state row.';
 
-- ----------------------------------------------------------------------------
-- 3. Index — every real query against activity_log filters by event_id and
-- orders by created_at. Additive; the existing activity_log_created_at_idx
-- (created_at alone) is left in place.
-- ----------------------------------------------------------------------------
 
create index if not exists activity_log_event_created_idx
on activity_log(event_id, created_at desc);
 
-- ----------------------------------------------------------------------------
-- 4. Security definer helper — the only correct way to check membership in
-- events/event_collaborators from inside another table's RLS policy when
-- those two tables are themselves RLS-locked to service-role-only access.
-- Runs with the privileges to see into both tables directly; still only
-- ever returns a boolean for the calling auth.uid(), never row data, so it
-- doesn't reopen the access those tables' own policies close off.
--
-- Locked down explicitly: revoked from PUBLIC, granted only to
-- `authenticated` — an anonymous caller gets no answer at all (evaluates
-- false via the RLS policy that calls it, since anon has no auth.uid()),
-- and this is not left implicitly exposed as a general-purpose RPC.
-- ----------------------------------------------------------------------------
 
create or replace function public.is_event_member(p_event_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from events e
    where e.id = p_event_id and e.owner_id = auth.uid()
  )
  or exists (
    select 1 from event_collaborators c
    where c.event_id = p_event_id and c.user_id = auth.uid() and c.status = 'accepted'
  );
$$;
 
revoke all on function public.is_event_member(uuid) from public;
grant execute on function public.is_event_member(uuid) to authenticated;
 
comment on function public.is_event_member(uuid) is
  'True if auth.uid() owns or is an accepted collaborator on the given event. security definer so it can see into events/event_collaborators (both RLS-locked to service-role-only) without reopening their own policies — only ever returns a boolean, never row data. Used by activity_log''s SELECT policy; do not call directly from client code as a shortcut around requireEventAccess() server-side checks.';
 
-- ----------------------------------------------------------------------------
-- 5. RLS fix — activity_log was readable by anyone, including a fully
-- unauthenticated request, who knew or guessed an event_id
-- (`using (true)`). Correct and intentional for the *display*-facing
-- tables (live_state, sessions, programs, ...) — anonymous TV displays
-- read those with no login by design. activity_log is not one of those:
-- it's an operator-only audit trail, and after this migration it also
-- carries real names. This was already a cross-tenant read gap before this
-- migration; adding identity to the table without fixing it would have
-- made that gap worse, not just bigger.
-- ----------------------------------------------------------------------------
 
drop policy if exists "public read activity_log" on activity_log;
 
drop policy if exists "event members read activity_log" on activity_log;
create policy "event members read activity_log" on activity_log
  for select
  using (public.is_event_member(activity_log.event_id));
 
-- ----------------------------------------------------------------------------
-- 6. Realtime publication — defensive, idempotent. If activity_log is
-- already in supabase_realtime (likely, since components/operator/
-- activity-log.tsx already subscribes to it live), this is a no-op.
-- ----------------------------------------------------------------------------
 
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'activity_log'
  ) then
    execute 'alter publication supabase_realtime add table activity_log';
  end if;
end $$;
 
commit;
