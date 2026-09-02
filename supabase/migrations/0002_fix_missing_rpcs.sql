-- Fixes real breakage discovered while auditing the live database against
-- what the app code actually calls: five RPC functions the app depends on
-- (replace_session_programs, move_program, bulk_move_programs_to_partition,
-- bulk_update_programs, swap_program_order) do not exist at all in the
-- database, and the cue-sheet upload route's session upsert
-- (`.upsert(sessions, { onConflict: "event_id,id" })`) fails outright
-- because `sessions` has no unique constraint on (event_id, id) — confirmed
-- by running that exact upsert against the live DB and getting "there is no
-- unique or exclusion constraint matching the ON CONFLICT specification".
--
-- Everything here is additive only — no existing column, constraint, or
-- foreign key is dropped or altered. In particular this does NOT change
-- sessions' primary key (still plain `id`); it adds a second, separate
-- UNIQUE (event_id, id) constraint alongside it, which is enough to satisfy
-- the upsert without touching the existing FK relationships from
-- partitions.session_id / programs.session_id (both of which reference
-- sessions(id) alone and would break if that changed).
--
-- Run this after supabase/migrations/0001_multitenant.sql. Idempotent
-- throughout (IF NOT EXISTS / CREATE OR REPLACE / DROP ... IF EXISTS before
-- CREATE where a signature could change).

begin;

-- ---------------------------------------------------------------------------
-- sessions: additive unique constraint so the cue-sheet upload route's
-- upsert(onConflict: "event_id,id") has a target to match against. Doesn't
-- replace the existing plain-id primary key.
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'sessions_event_id_id_key'
  ) then
    alter table sessions add constraint sessions_event_id_id_key unique (event_id, id);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- programs.version: optimistic-concurrency counter that move_program,
-- bulk_move_programs_to_partition, bulk_update_programs, and
-- swap_program_order all bump on every write (see their definitions
-- below) but which was never actually added to the table.
-- ---------------------------------------------------------------------------
alter table programs add column if not exists version integer not null default 0;

-- ---------------------------------------------------------------------------
-- replace_session_programs — event-scoped version. The version in
-- schema.sql took (p_session_ids, p_partitions, p_programs) with no
-- p_event_id; app/api/cue-sheet/upload/route.ts now calls it with
-- p_event_id as the first arg (same p_event_id-awareness pattern already
-- applied to delete_program / insert_program_into_partition in
-- 0001_multitenant.sql). Every delete/insert here is scoped to p_event_id,
-- not just p_session_ids, so a session-id collision across two different
-- events' cue sheets can't cross-delete another event's rows.
-- ---------------------------------------------------------------------------
drop function if exists replace_session_programs(text[], jsonb, jsonb);
drop function if exists replace_session_programs(uuid, text[], jsonb, jsonb);

create or replace function replace_session_programs(
  p_event_id uuid, p_session_ids text[], p_partitions jsonb, p_programs jsonb
)
returns void
language plpgsql
as $$
begin
  delete from programs where event_id = p_event_id and session_id = any(p_session_ids);
  delete from partitions where event_id = p_event_id and session_id = any(p_session_ids);

  insert into partitions (id, event_id, session_id, label, sort_order, start_time)
  select id, p_event_id, session_id, label, sort_order, start_time
  from jsonb_to_recordset(p_partitions) as x(
    id uuid, session_id text, label text, sort_order integer, start_time text
  );

  insert into programs (
    sort_order, event_id, session_id, partition_id, section_label, type, name, description,
    presenter, presenter_requirement, presenter_contact, duration,
    start_time, end_time, audio_mics, audio_track, video_sidescreen,
    backdrop, video_ppt_needed, hall_lights, stage_lights, camera_angle,
    props, curtains, remarks, status, color_tag
  )
  select
    sort_order, p_event_id, session_id, partition_id, section_label, type, name, description,
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
-- move_program, bulk_move_programs_to_partition, bulk_update_programs,
-- swap_program_order — copied from supabase/schema.sql as-is. Their
-- signatures already match what app/api/programs/{move,bulk,swap}/route.ts
-- call (no p_event_id param): those routes pre-validate that every id
-- involved belongs to the caller's authorized event before invoking the
-- RPC, the same division of responsibility documented in each route's own
-- comments. Simply never existed in the live database until now.
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

commit;
