-- Multi-tenant migration — brings the live database up to what the "deep"
-- branch's app code actually expects: a real events/collaborators layer
-- with every operational table scoped by event_id, correct RLS, and the
-- two RPCs the code calls that schema.sql never defined (delete_program)
-- or defined without the p_event_id param it's now called with
-- (insert_program_into_partition).
--
-- Run this ONCE in the Supabase SQL Editor (Project > SQL Editor > New
-- query), on top of whatever supabase/schema.sql already produced. Safe to
-- re-run — idempotent throughout.
--
-- IMPORTANT: this truncates sessions/programs/live_state/display_state/
-- display_registry/display_broadcasts/activity_log. Every row in those
-- tables today predates the events model (no event_id, no owner) and is
-- unusable under it — there is no reconciliation possible, only a fresh
-- start scoped to real events. If you have production data in this
-- project you care about, stop and export it first.

-- ---------------------------------------------------------------------------
-- profiles — one row per auth.users row, billing-tier groundwork
-- (lib/server/plan-limits.ts). Auto-created by a trigger on signup so
-- app/api/events/route.ts's tier lookup never has to handle "no profile
-- row yet" as a real case.
-- ---------------------------------------------------------------------------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  tier text not null default 'free' check (tier in ('free', 'pro')),
  created_at timestamptz not null default now()
);

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Backfill any existing auth.users rows (e.g. the demo user created before
-- this migration ran) that have no profile yet.
insert into profiles (id)
select id from auth.users
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- events — the tenant boundary everything else hangs off.
-- ---------------------------------------------------------------------------
create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  event_date date,
  venue text,
  timezone text,
  form_config jsonb
);
create index if not exists events_owner_id_idx on events(owner_id);

-- ---------------------------------------------------------------------------
-- event_collaborators — non-owner access grants. Owner is events.owner_id
-- and is never a row here (see lib/server/require-event-access.ts).
-- ---------------------------------------------------------------------------
create table if not exists event_collaborators (
  event_id uuid not null references events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('editor', 'viewer')),
  invited_email text,
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);
create index if not exists event_collaborators_user_id_idx on event_collaborators(user_id);

-- ---------------------------------------------------------------------------
-- Drop the dead legacy table — no code references it any more (superseded
-- by events.form_config jsonb).
-- ---------------------------------------------------------------------------
drop table if exists event_form_configs;

-- ---------------------------------------------------------------------------
-- Clear out pre-events scaffolding data — unscoped, unusable under the new
-- model (see header comment).
-- ---------------------------------------------------------------------------
truncate table
  activity_log,
  display_broadcasts,
  display_registry,
  programs,
  sessions
  restart identity cascade;

delete from live_state;
delete from display_state;

-- ---------------------------------------------------------------------------
-- sessions / programs — add event_id
-- ---------------------------------------------------------------------------
alter table sessions add column if not exists event_id uuid references events(id) on delete cascade;
alter table sessions alter column event_id set not null;
create index if not exists sessions_event_id_idx on sessions(event_id);

alter table programs add column if not exists event_id uuid references events(id) on delete cascade;
alter table programs alter column event_id set not null;
create index if not exists programs_event_id_idx on programs(event_id);

-- ---------------------------------------------------------------------------
-- partitions / auditoriums / share_links — didn't exist yet on this
-- project at all; create fresh, event-scoped from the start.
-- ---------------------------------------------------------------------------
create table if not exists partitions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  session_id text not null references sessions(id) on delete cascade,
  label text not null,
  sort_order integer not null,
  start_time text
);
create index if not exists partitions_session_id_idx on partitions(session_id);
create index if not exists partitions_event_id_idx on partitions(event_id);

create table if not exists auditoriums (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  name text not null
);
create index if not exists auditoriums_event_id_idx on auditoriums(event_id);

create table if not exists share_links (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  event_id uuid not null references events(id) on delete cascade,
  label text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  last_used_at timestamptz
);
create index if not exists share_links_token_idx on share_links(token);
create index if not exists share_links_event_id_idx on share_links(event_id);

alter table programs add column if not exists partition_id uuid references partitions(id) on delete set null;
alter table programs add column if not exists time_is_computed boolean not null default false;
alter table programs add column if not exists auditorium_id uuid references auditoriums(id) on delete set null;
create index if not exists programs_partition_id_idx on programs(partition_id);

alter table programs drop constraint if exists programs_session_sort_order_key;
drop index if exists programs_session_sort_order_idx;
alter table programs
  add constraint programs_session_sort_order_key
  unique (session_id, sort_order) deferrable initially immediate;

-- ---------------------------------------------------------------------------
-- live_state — was a singleton (id smallint = 1); now one row per event.
-- ---------------------------------------------------------------------------
alter table live_state drop constraint if exists live_state_pkey;
alter table live_state drop constraint if exists live_state_id_check;
alter table live_state alter column id drop default;
alter table live_state alter column id type bigint using id::bigint;
drop sequence if exists live_state_id_seq cascade;
create sequence live_state_id_seq owned by live_state.id;
alter table live_state alter column id set default nextval('live_state_id_seq');
alter table live_state add primary key (id);

alter table live_state add column if not exists event_id uuid references events(id) on delete cascade;
alter table live_state add constraint live_state_event_id_key unique (event_id);
alter table live_state alter column active_session_id drop not null;
alter table live_state alter column active_session_id type text;

-- ---------------------------------------------------------------------------
-- display_state — same singleton -> per-event change.
-- ---------------------------------------------------------------------------
alter table display_state drop constraint if exists display_state_pkey;
alter table display_state drop constraint if exists display_state_id_check;
alter table display_state alter column id drop default;
alter table display_state alter column id type bigint using id::bigint;
drop sequence if exists display_state_id_seq cascade;
create sequence display_state_id_seq owned by display_state.id;
alter table display_state alter column id set default nextval('display_state_id_seq');
alter table display_state add primary key (id);

alter table display_state add column if not exists event_id uuid references events(id) on delete cascade;
alter table display_state add constraint display_state_event_id_key unique (event_id);

-- ---------------------------------------------------------------------------
-- display_registry — composite (event_id, id) primary key, per registry/
-- route.ts's comment (two events' displays must never collide on id alone).
-- ---------------------------------------------------------------------------
alter table display_registry drop constraint if exists display_registry_pkey;
alter table display_registry add column if not exists event_id uuid references events(id) on delete cascade;
alter table display_registry alter column event_id set not null;
alter table display_registry add primary key (event_id, id);

-- ---------------------------------------------------------------------------
-- display_broadcasts / activity_log — add event_id
-- ---------------------------------------------------------------------------
alter table display_broadcasts add column if not exists event_id uuid references events(id) on delete cascade;
alter table display_broadcasts alter column event_id set not null;
create index if not exists display_broadcasts_event_id_idx on display_broadcasts(event_id);

alter table activity_log add column if not exists event_id uuid references events(id) on delete cascade;
alter table activity_log alter column event_id set not null;
create index if not exists activity_log_event_id_idx on activity_log(event_id);

-- ---------------------------------------------------------------------------
-- RPCs — replace_session_programs, move_program, bulk_move_programs_to_
-- partition, bulk_update_programs, swap_program_order are unchanged from
-- schema.sql (all scoped via session_id, which now transitively belongs to
-- one event via sessions.event_id — no signature change needed). Two RPCs
-- do need to change:
--   - insert_program_into_partition: app/api/programs/route.ts now passes
--     p_event_id, and the inserted row needs an event_id column populated.
--   - delete_program: called by app/api/programs/[id]/route.ts but was
--     never defined at all.
-- ---------------------------------------------------------------------------
drop function if exists insert_program_into_partition(
  text, uuid, text, text, text, text, text, text, text, integer, text, text, boolean, boolean, text, boolean, boolean, text, text, text, text, text, text, text, text, uuid, boolean
);

create or replace function insert_program_into_partition(
  p_event_id uuid,
  p_session_id text,
  p_partition_id uuid,
  p_section_label text, p_type text, p_name text, p_description text,
  p_presenter text, p_presenter_requirement text, p_presenter_contact text, p_duration integer,
  p_start_time text, p_end_time text, p_audio_mics boolean, p_audio_track boolean, p_video_sidescreen text,
  p_backdrop boolean, p_video_ppt_needed boolean, p_hall_lights text, p_stage_lights text, p_camera_angle text,
  p_props text, p_curtains text, p_remarks text, p_status text, p_color_tag text,
  p_auditorium_id uuid, p_time_is_computed boolean
)
returns programs
language plpgsql
as $$
declare
  v_target_order integer;
  v_row programs;
begin
  perform pg_advisory_xact_lock(hashtext(p_session_id));
  set constraints programs_session_sort_order_key deferred;

  if p_partition_id is null then
    select coalesce(max(sort_order), 0) into v_target_order
    from programs where session_id = p_session_id;
  else
    select coalesce(
      (select max(pr.sort_order)
       from partitions pt
       join programs pr on pr.partition_id = pt.id
       where pt.session_id = p_session_id
         and pt.sort_order <= (select sort_order from partitions where id = p_partition_id)),
      (select coalesce(min(sort_order), 1) - 1 from programs where session_id = p_session_id)
    ) into v_target_order;
  end if;
  v_target_order := v_target_order + 1;

  update programs set sort_order = sort_order + 1
  where session_id = p_session_id and sort_order >= v_target_order;

  insert into programs (
    sort_order, session_id, event_id, partition_id, section_label, type, name, description,
    presenter, presenter_requirement, presenter_contact, duration,
    start_time, end_time, audio_mics, audio_track, video_sidescreen,
    backdrop, video_ppt_needed, hall_lights, stage_lights, camera_angle,
    props, curtains, remarks, status, color_tag, auditorium_id, time_is_computed
  ) values (
    v_target_order, p_session_id, p_event_id, p_partition_id, p_section_label, p_type, p_name, p_description,
    p_presenter, p_presenter_requirement, p_presenter_contact, p_duration,
    p_start_time, p_end_time, p_audio_mics, p_audio_track, p_video_sidescreen,
    p_backdrop, p_video_ppt_needed, p_hall_lights, p_stage_lights, p_camera_angle,
    p_props, p_curtains, p_remarks, p_status, p_color_tag, p_auditorium_id, coalesce(p_time_is_computed, false)
  )
  returning * into v_row;

  return v_row;
end;
$$;

-- delete_program — removes one program, renumbers the rest of its session
-- to close the gap, and shifts any live_state currentOrder pointer past
-- the deleted item down by one so it keeps pointing at the same logical
-- item (see app/api/programs/[id]/route.ts's comment for the full "why").
create or replace function delete_program(p_id uuid, p_event_id uuid)
returns void
language plpgsql
as $$
declare
  v_session_id text;
  v_sort_order integer;
begin
  select session_id, sort_order into v_session_id, v_sort_order
  from programs where id = p_id and event_id = p_event_id;
  if v_session_id is null then
    raise exception 'Program % not found', p_id;
  end if;

  perform pg_advisory_xact_lock(hashtext(v_session_id));
  set constraints programs_session_sort_order_key deferred;

  delete from programs where id = p_id and event_id = p_event_id;

  update programs set sort_order = sort_order - 1, version = version + 1
  where session_id = v_session_id and sort_order > v_sort_order;

  update live_state
  set progress_by_session = jsonb_set(
        progress_by_session,
        array[v_session_id],
        jsonb_build_object(
          'currentOrder',
          case
            when (progress_by_session -> v_session_id ->> 'currentOrder') is null then null
            when (progress_by_session -> v_session_id ->> 'currentOrder')::int > v_sort_order
              then (progress_by_session -> v_session_id ->> 'currentOrder')::int - 1
            else (progress_by_session -> v_session_id ->> 'currentOrder')::int
          end,
          'startedAt', progress_by_session -> v_session_id -> 'startedAt'
        )
      ),
      version = version + 1
  where event_id = p_event_id and progress_by_session ? v_session_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Row-Level Security — rewritten for real per-event isolation. Every read
-- policy below allows a row through only if the signed-in user owns the
-- parent event or holds an event_collaborators row on it. Writes still go
-- exclusively through API routes using the service-role client (which
-- bypasses RLS) — no insert/update/delete policies are defined here, same
-- as before.
-- ---------------------------------------------------------------------------
create or replace function has_event_access(p_event_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from events e
    where e.id = p_event_id
      and (
        e.owner_id = auth.uid()
        or exists (
          select 1 from event_collaborators c
          where c.event_id = e.id and c.user_id = auth.uid()
        )
      )
  );
$$;

alter table events enable row level security;
alter table event_collaborators enable row level security;
alter table profiles enable row level security;
alter table sessions enable row level security;
alter table programs enable row level security;
alter table live_state enable row level security;
alter table activity_log enable row level security;
alter table display_state enable row level security;
alter table display_registry enable row level security;
alter table display_broadcasts enable row level security;
alter table partitions enable row level security;
alter table auditoriums enable row level security;
alter table share_links enable row level security;

drop policy if exists "public read sessions" on sessions;
drop policy if exists "public read programs" on programs;
drop policy if exists "public read live_state" on live_state;
drop policy if exists "public read activity_log" on activity_log;
drop policy if exists "public read display_state" on display_state;
drop policy if exists "public read display_registry" on display_registry;
drop policy if exists "public read display_broadcasts" on display_broadcasts;
drop policy if exists "public read partitions" on partitions;
drop policy if exists "public read auditoriums" on auditoriums;

drop policy if exists "own or collaborated events" on events;
create policy "own or collaborated events" on events for select to authenticated
  using (owner_id = auth.uid() or has_event_access(id));

drop policy if exists "collaborators visible to self and owner" on event_collaborators;
create policy "collaborators visible to self and owner" on event_collaborators for select to authenticated
  using (user_id = auth.uid() or has_event_access(event_id));

drop policy if exists "own profile" on profiles;
create policy "own profile" on profiles for select to authenticated
  using (id = auth.uid());

drop policy if exists "event-scoped sessions" on sessions;
create policy "event-scoped sessions" on sessions for select to authenticated using (has_event_access(event_id));

drop policy if exists "event-scoped programs" on programs;
create policy "event-scoped programs" on programs for select to authenticated using (has_event_access(event_id));

drop policy if exists "event-scoped partitions" on partitions;
create policy "event-scoped partitions" on partitions for select to authenticated using (has_event_access(event_id));

drop policy if exists "event-scoped auditoriums" on auditoriums;
create policy "event-scoped auditoriums" on auditoriums for select to authenticated using (has_event_access(event_id));

drop policy if exists "event-scoped live_state" on live_state;
create policy "event-scoped live_state" on live_state for select to authenticated using (has_event_access(event_id));

drop policy if exists "event-scoped activity_log" on activity_log;
create policy "event-scoped activity_log" on activity_log for select to authenticated using (has_event_access(event_id));

drop policy if exists "event-scoped display_state" on display_state;
create policy "event-scoped display_state" on display_state for select to authenticated using (has_event_access(event_id));

drop policy if exists "event-scoped display_registry" on display_registry;
create policy "event-scoped display_registry" on display_registry for select to authenticated using (has_event_access(event_id));

drop policy if exists "event-scoped display_broadcasts" on display_broadcasts;
create policy "event-scoped display_broadcasts" on display_broadcasts for select to authenticated using (has_event_access(event_id));

-- share_links keeps zero policies on purpose (see schema.sql's original
-- comment) — resolved exclusively server-side via the service-role client.

-- ---------------------------------------------------------------------------
-- Realtime — same tables as before, now correctly event-scoped by RLS.
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['sessions', 'programs', 'live_state', 'display_state', 'display_registry', 'display_broadcasts', 'partitions', 'auditoriums']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table %I', t);
    end if;
  end loop;
end $$;
