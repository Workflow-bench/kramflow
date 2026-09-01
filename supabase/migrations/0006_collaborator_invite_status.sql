-- ============================================================================
-- Kramflow — Collaborator invite status (prerequisite for the pilot-
-- readiness v2 migration, see Kramflow_Pilot_Readiness_Migration_v2_Runbook)
--
-- Adds id/status/invite_token to event_collaborators. v2's activity_log RLS
-- policy calls public.is_event_member(), which checks
-- `c.status = 'accepted'` — that column doesn't exist yet, so v2's preflight
-- guard fails until this runs.
--
-- Today, adding a row to event_collaborators (via POST
-- app/api/events/[eventId]/collaborators) already grants immediate access —
-- there is no pending/invite-acceptance step in the app
-- (lib/server/require-event-access.ts grants access to any row in the
-- table, full stop). So every existing and newly-inserted-the-old-way row
-- is, in effect, already "accepted." Backfilling status = 'accepted' for
-- existing rows reflects that reality rather than guessing; it does not
-- change who currently has access to anything.
--
-- invite_token is added for a future real pending-invite flow (email
-- invites to non-users — flagged separately as finding #25, out of scope
-- here) but is not required by v2 or used by any code yet.
--
-- Safe to run once. Every ADD COLUMN is guarded, so re-running this script
-- after a partial or full success is a no-op, not an error. Nothing here
-- deletes rows or changes existing access.
-- ============================================================================

begin;

alter table event_collaborators
  add column if not exists id uuid not null default gen_random_uuid(),
  add column if not exists status text not null default 'accepted',
  add column if not exists invite_token text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'event_collaborators_status_check'
  ) then
    alter table event_collaborators
      add constraint event_collaborators_status_check
      check (status in ('pending', 'accepted', 'declined', 'revoked'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'event_collaborators_id_key'
  ) then
    alter table event_collaborators add constraint event_collaborators_id_key unique (id);
  end if;
end $$;

create unique index if not exists event_collaborators_invite_token_key
on event_collaborators(invite_token)
where invite_token is not null;

comment on column event_collaborators.id is
  'Surrogate key for referencing a single collaborator row (e.g. by invite_token lookup). event_id+user_id remains the primary key.';

comment on column event_collaborators.status is
  'pending | accepted | declined | revoked. Existing and directly-added rows default to accepted, matching today''s app behavior (adding a row grants immediate access — there is no acceptance step yet). Read by public.is_event_member() from the pilot-readiness v2 migration.';

comment on column event_collaborators.invite_token is
  'Reserved for a future email-invite-to-non-user flow (finding #25). Not written or read by any code yet.';

commit;
