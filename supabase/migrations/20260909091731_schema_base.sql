-- KramFlow schema — run once in the Supabase SQL editor on a fresh project.
-- See docs/ARCHITECTURE.md and the restructure plan for the reasoning behind
-- each table. Idempotent: safe to re-run (uses IF NOT EXISTS / CREATE OR REPLACE).
--
-- This is the base schema only. Every table/RLS/RPC change since has landed
-- as a numbered file in supabase/migrations/ — run this file first, then
-- everything in supabase/migrations/ in order. The app code's current RPC
-- signatures (e.g. replace_session_programs's p_event_id param) only exist
-- after supabase/migrations/0001_multitenant.sql — this file alone won't
-- produce a working app. See docs/DEPLOYMENT.md for the full setup order.

-- ---------------------------------------------------------------------------
-- sessions
-- ---------------------------------------------------------------------------
create table if not exists sessions (
  id text primary key,
  sheet_name text not null,
  event_name text not null,
  day_label text not null,
  session_label text not null,
  sort_order integer not null default 0
);

-- ---------------------------------------------------------------------------
-- programs
-- Note: "order" is a reserved SQL word, so the sequence-position column is
-- named sort_order here (mirrors sessions.sort_order); the app's Program
-- type maps it to `order` at the data-access boundary (lib/data/sessions.ts).
-- ---------------------------------------------------------------------------
create table if not exists programs (
  id uuid primary key default gen_random_uuid(),
  sort_order integer not null,
  session_id text not null references sessions(id) on delete cascade,
  section_label text,
  type text not null default 'item' check (type in ('item', 'break')),
  name text not null,
  description text,
  presenter text,
  presenter_requirement text,
  presenter_contact text,
  duration integer not null default 0,
  start_time text,
  end_time text,
  audio_mics boolean not null default false,
  audio_track boolean not null default false,
  video_sidescreen text not null default 'none' check (video_sidescreen in ('none', 'slides', 'live_feed')),
  backdrop boolean not null default false,
  video_ppt_needed boolean not null default false,
  hall_lights text,
  stage_lights text,
  camera_angle text,
  props text,
  curtains text check (curtains in ('open', 'closed')),
  remarks text,
  status text not null default 'confirmed' check (status in ('confirmed', 'draft', 'cut', 'tbd')),
  color_tag text check (color_tag in ('ready', 'vip', 'needs_confirmation', 'urgent')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text,
  version integer not null default 0
);
alter table programs add column if not exists version integer not null default 0;

create index if not exists programs_session_id_idx on programs(session_id);

alter table programs drop constraint if exists programs_session_sort_order_key;
drop index if exists programs_session_sort_order_idx;
alter table programs
  add constraint programs_session_sort_order_key
  unique (session_id, sort_order) deferrable initially immediate;

-- ---------------------------------------------------------------------------
-- partitions
-- ---------------------------------------------------------------------------
create table if not exists partitions (
  id uuid primary key default gen_random_uuid(),
  session_id text not null references sessions(id) on delete cascade,
  label text not null,
  sort_order integer not null,
  start_time text
);
create index if not exists partitions_session_id_idx on partitions(session_id);

alter table programs add column if not exists partition_id uuid references partitions(id) on delete set null;
alter table programs add column if not exists time_is_computed boolean not null default false;
create index if not exists programs_partition_id_idx on programs(partition_id);

-- ---------------------------------------------------------------------------
-- auditoriums
-- ---------------------------------------------------------------------------
create table if not exists auditoriums (
  id uuid primary key default gen_random_uuid(),
  name text not null
);
alter table programs add column if not exists auditorium_id uuid references auditoriums(id) on delete set null;

-- ---------------------------------------------------------------------------
-- event_form_configs
-- ---------------------------------------------------------------------------
create table if not exists event_form_configs (
  event_name text primary key,
  config jsonb not null
);

-- ---------------------------------------------------------------------------
-- replace_session_programs (pre-multitenant signature; superseded by 0001)
-- ---------------------------------------------------------------------------
drop function if exists replace_session_programs(text[], jsonb);

create or replace function replace_session_programs(p_session_ids text[], p_partitions jsonb, p_programs jsonb)
returns void
language plpgsql
as $$
begin
  delete from programs where session_id = any(p_session_ids);
  delete from partitions where session_id = any(p_session_ids);

  insert into partitions (id, session_id, label, sort_order, start_time)
  select id, session_id, label, sort_order, start_time
  from jsonb_to_recordset(p_partitions) as x(
    id uuid, session_id text, label text, sort_order integer, start_time text
  );

  insert into programs (
    sort_order, session_id, partition_id, section_label, type, name, description,
    presenter, presenter_requirement, presenter_contact, duration,
    start_time, end_time, audio_mics, audio_track, video_sidescreen,
    backdrop, video_ppt_needed, hall_lights, stage_lights, camera_angle,
    props, curtains, remarks, status, color_tag
  )
  select
    sort_order, session_id, partition_id, section_label, type, name, description,
    presenter, presenter_requirement, presenter_contact, duration,
    start_time, end_time, audio_mics, audio_track, video_sidescreen,
    backdrop, video_ppt_needed, hall_lights, stage_lights, camera_angle,
    props, curtains, remarks, status, color_tag
  from jsonb_to_recordset(p_programs) as x(
    sort_order integer, session_id text, partition_id uuid, section_label text, type text, name text, description text,
    presenter text, presenter_requirement text, presenter_contact text, duration integer,
    start_time text, end_time text, audio_mics boolean, audio_track boolean, video_sidescreen text,
    backdrop boolean, video_ppt_needed boolean, hall_lights text, stage_lights text, camera_angle text,
    props text, curtains text, remarks text, status text, color_tag text
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- insert_program_into_partition (pre-multitenant signature; superseded by 0001/0004)
-- ---------------------------------------------------------------------------
create or replace function insert_program_into_partition(
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
    sort_order, session_id, partition_id, section_label, type, name, description,
    presenter, presenter_requirement, presenter_contact, duration,
    start_time, end_time, audio_mics, audio_track, video_sidescreen,
    backdrop, video_ppt_needed, hall_lights, stage_lights, camera_angle,
    props, curtains, remarks, status, color_tag, auditorium_id, time_is_computed
  ) values (
    v_target_order, p_session_id, p_partition_id, p_section_label, p_type, p_name, p_description,
    p_presenter, p_presenter_requirement, p_presenter_contact, p_duration,
    p_start_time, p_end_time, p_audio_mics, p_audio_track, p_video_sidescreen,
    p_backdrop, p_video_ppt_needed, p_hall_lights, p_stage_lights, p_camera_angle,
    p_props, p_curtains, p_remarks, p_status, p_color_tag, p_auditorium_id, coalesce(p_time_is_computed, false)
  )
  returning * into v_row;

  return v_row;
end;
$$;

-- ---------------------------------------------------------------------------
-- move_program
-- ---------------------------------------------------------------------------
create or replace function move_program(p_id uuid, p_after_id uuid, p_partition_id uuid)
returns void
language plpgsql
as $$
declare
  v_session_id text;
  v_anchor_rn integer := 0;
begin
  select session_id into v_session_id from programs where id = p_id;
  if v_session_id is null then
    raise exception 'Program % not found', p_id;
  end if;

  perform pg_advisory_xact_lock(hashtext(v_session_id));
  set constraints programs_session_sort_order_key deferred;

  create temporary table _move_rest on commit drop as
    select id, row_number() over (order by sort_order) as rn
    from programs where session_id = v_session_id and id <> p_id;

  if p_after_id is not null then
    select coalesce(rn, 0) into v_anchor_rn from _move_rest where id = p_after_id;
  end if;

  update programs p
  set sort_order = r.rn + case when r.rn > v_anchor_rn then 1 else 0 end, version = p.version + 1
  from _move_rest r where p.id = r.id;

  update programs
  set sort_order = v_anchor_rn + 1, partition_id = p_partition_id, version = version + 1
  where id = p_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- bulk_move_programs_to_partition
-- ---------------------------------------------------------------------------
create or replace function bulk_move_programs_to_partition(p_ids uuid[], p_partition_id uuid)
returns void
language plpgsql
as $$
declare
  v_session_id text;
begin
  select session_id into strict v_session_id
  from (select distinct session_id from programs where id = any(p_ids)) s;

  perform pg_advisory_xact_lock(hashtext(v_session_id));
  set constraints programs_session_sort_order_key deferred;

  create temporary table _bulk_rest on commit drop as
    select id, row_number() over (order by sort_order) as rn
    from programs where session_id = v_session_id and not (id = any(p_ids));

  update programs p
  set sort_order = r.rn, version = p.version + 1
  from _bulk_rest r where p.id = r.id;

  update programs p
  set sort_order = (select coalesce(max(rn), 0) from _bulk_rest) + array_position(p_ids, p.id),
      partition_id = p_partition_id,
      version = p.version + 1
  where p.id = any(p_ids);
end;
$$;

-- ---------------------------------------------------------------------------
-- bulk_update_programs
-- ---------------------------------------------------------------------------
create or replace function bulk_update_programs(p_ids uuid[], p_field text, p_value text)
returns setof programs
language plpgsql
as $$
begin
  if p_field not in (
    'color_tag', 'status', 'presenter', 'presenter_requirement', 'presenter_contact',
    'hall_lights', 'stage_lights', 'camera_angle', 'props', 'curtains', 'remarks', 'video_sidescreen'
  ) then
    raise exception 'Field % is not bulk-editable', p_field;
  end if;

  return query execute format(
    'update programs set %I = $1, version = version + 1 where id = any($2) returning *',
    p_field
  ) using p_value, p_ids;
end;
$$;

-- ---------------------------------------------------------------------------
-- swap_program_order
-- ---------------------------------------------------------------------------
create or replace function swap_program_order(p_id_a uuid, p_id_b uuid)
returns void
language plpgsql
as $$
declare
  v_session_id_a text;
  v_session_id_b text;
  v_partition_a uuid;
  v_partition_b uuid;
  v_order_a integer;
  v_order_b integer;
begin
  select session_id, partition_id, sort_order into v_session_id_a, v_partition_a, v_order_a
  from programs where id = p_id_a;
  select session_id, partition_id, sort_order into v_session_id_b, v_partition_b, v_order_b
  from programs where id = p_id_b;
  if v_order_a is null or v_order_b is null then
    raise exception 'One or both program ids not found';
  end if;
  if v_session_id_a is distinct from v_session_id_b then
    raise exception 'Cannot swap programs across sessions';
  end if;
  if v_partition_a is distinct from v_partition_b then
    raise exception 'Cannot swap programs across partitions';
  end if;

  perform pg_advisory_xact_lock(hashtext(v_session_id_a));

  update programs set sort_order = -1, version = version + 1 where id = p_id_a;
  update programs set sort_order = v_order_a, version = version + 1 where id = p_id_b;
  update programs set sort_order = v_order_b, version = version + 1 where id = p_id_a;
end;
$$;

-- ---------------------------------------------------------------------------
-- live_state
-- ---------------------------------------------------------------------------
create table if not exists live_state (
  id smallint primary key default 1 check (id = 1),
  active_session_id text references sessions(id),
  paused_at timestamptz,
  alert jsonb,
  progress_by_session jsonb not null default '{}'::jsonb,
  notes_overrides jsonb not null default '{}'::jsonb,
  presenter_state jsonb not null default '{"note": null, "flashAt": null}'::jsonb,
  updated_at timestamptz not null default now(),
  version integer not null default 0,
  controller_id text,
  controller_claimed_at timestamptz
);

insert into live_state (id) values (1) on conflict (id) do nothing;
alter table live_state add column if not exists version integer not null default 0;
alter table live_state add column if not exists controller_id text;
alter table live_state add column if not exists controller_claimed_at timestamptz;

-- ---------------------------------------------------------------------------
-- activity_log
-- ---------------------------------------------------------------------------
create table if not exists activity_log (
  id bigint generated always as identity primary key,
  action text not null,
  detail text,
  created_at timestamptz not null default now()
);

create index if not exists activity_log_created_at_idx on activity_log(created_at desc);

-- ---------------------------------------------------------------------------
-- display_state
-- ---------------------------------------------------------------------------
create table if not exists display_state (
  id smallint primary key default 1 check (id = 1),
  hold jsonb not null default '{"active":false,"message":"Please Stand By","subMessage":null,"continueClock":false,"activatedAt":null}'::jsonb,
  timer jsonb not null default '{"mode":"program","source":"auto","startedAt":null,"durationSeconds":300,"pausedAt":null,"adjustmentSeconds":0,"thresholds":{"yellowAt":300,"orangeAt":60,"redAt":0,"criticalAfter":60}}'::jsonb,
  speaker_ready jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  timer_version integer not null default 0
);

insert into display_state (id) values (1) on conflict (id) do nothing;
alter table display_state add column if not exists timer_version integer not null default 0;

-- ---------------------------------------------------------------------------
-- display_registry
-- ---------------------------------------------------------------------------
create table if not exists display_registry (
  id text primary key,
  name text not null,
  type text not null,
  room text,
  profile_id text,
  latency_ms integer,
  registered_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  pending_command jsonb
);

-- ---------------------------------------------------------------------------
-- display_broadcasts
-- ---------------------------------------------------------------------------
create table if not exists display_broadcasts (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  title text not null,
  message text not null,
  icon text,
  priority smallint not null default 2,
  target jsonb not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  duration_seconds integer,
  acknowledgement_required boolean not null default false,
  persistent boolean not null default false,
  acknowledged_by jsonb not null default '[]'::jsonb,
  scheduled_for timestamptz,
  status text not null default 'sent' check (status in ('scheduled', 'sent')),
  dismissed_at timestamptz
);

create index if not exists display_broadcasts_status_idx on display_broadcasts(status);

-- ---------------------------------------------------------------------------
-- acknowledge_broadcast
-- ---------------------------------------------------------------------------
create or replace function acknowledge_broadcast(p_id uuid, p_display_id text)
returns display_broadcasts
language plpgsql
as $$
declare
  result display_broadcasts;
begin
  update display_broadcasts
  set acknowledged_by = acknowledged_by || to_jsonb(p_display_id)
  where id = p_id
    and not (acknowledged_by @> to_jsonb(p_display_id))
  returning * into result;

  if not found then
    select * into result from display_broadcasts where id = p_id;
  end if;

  return result;
end;
$$;

-- ---------------------------------------------------------------------------
-- Backfill partitions from section_label (no-op on a fresh project)
-- ---------------------------------------------------------------------------
do $$
declare
  r record;
  v_prev_session text := null;
  v_prev_label text := null;
  v_partition_id uuid;
  v_partition_sort integer := 0;
begin
  for r in
    select id, session_id, section_label, sort_order
    from programs
    where partition_id is null
    order by session_id, sort_order
  loop
    if r.session_id is distinct from v_prev_session then
      v_prev_session := r.session_id;
      v_prev_label := null;
      v_partition_sort := 0;
    end if;

    if r.section_label is not null and r.section_label is distinct from v_prev_label then
      v_partition_sort := v_partition_sort + 1;
      insert into partitions (session_id, label, sort_order)
      values (r.session_id, r.section_label, v_partition_sort)
      returning id into v_partition_id;
      v_prev_label := r.section_label;
    elsif r.section_label is null then
      v_partition_id := null;
      v_prev_label := null;
    end if;

    update programs set partition_id = v_partition_id where id = r.id;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- share_links
-- ---------------------------------------------------------------------------
create table if not exists share_links (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  label text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  last_used_at timestamptz
);
create index if not exists share_links_token_idx on share_links(token);

alter table share_links enable row level security;

-- ---------------------------------------------------------------------------
-- events / event_collaborators
-- ---------------------------------------------------------------------------
create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists event_collaborators (
  id uuid not null default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  role text not null check (role in ('editor', 'viewer')),
  invited_email text not null,
  status text not null default 'accepted' check (status in ('pending', 'accepted')),
  invite_token text,
  invited_by uuid references auth.users(id) on delete set null,
  invite_expires_at timestamptz,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (event_id, user_id)
);
create unique index if not exists event_collaborators_id_idx on event_collaborators(id);
create unique index if not exists event_collaborators_invite_token_idx
  on event_collaborators(invite_token) where invite_token is not null;
create unique index if not exists event_collaborators_pending_email_idx
  on event_collaborators(event_id, invited_email) where status = 'pending';

alter table events enable row level security;
alter table event_collaborators enable row level security;

-- ---------------------------------------------------------------------------
-- Row-Level Security (base, pre-multitenant — superseded by 0001)
-- ---------------------------------------------------------------------------
alter table sessions enable row level security;
alter table programs enable row level security;
alter table live_state enable row level security;
alter table activity_log enable row level security;
alter table display_state enable row level security;
alter table display_registry enable row level security;
alter table display_broadcasts enable row level security;
alter table partitions enable row level security;
alter table auditoriums enable row level security;
alter table event_form_configs enable row level security;

drop policy if exists "public read sessions" on sessions;
create policy "public read sessions" on sessions for select using (true);

drop policy if exists "public read programs" on programs;
create policy "public read programs" on programs for select using (true);

drop policy if exists "public read live_state" on live_state;
create policy "public read live_state" on live_state for select using (true);

drop policy if exists "public read activity_log" on activity_log;
create policy "public read activity_log" on activity_log for select using (true);

drop policy if exists "public read display_state" on display_state;
create policy "public read display_state" on display_state for select using (true);

drop policy if exists "public read display_registry" on display_registry;
create policy "public read display_registry" on display_registry for select using (true);

drop policy if exists "public read display_broadcasts" on display_broadcasts;
create policy "public read display_broadcasts" on display_broadcasts for select using (true);

drop policy if exists "public read partitions" on partitions;
create policy "public read partitions" on partitions for select using (true);

drop policy if exists "public read auditoriums" on auditoriums;
create policy "public read auditoriums" on auditoriums for select using (true);

drop policy if exists "public read event_form_configs" on event_form_configs;
create policy "public read event_form_configs" on event_form_configs for select using (true);

-- ---------------------------------------------------------------------------
-- Realtime
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
