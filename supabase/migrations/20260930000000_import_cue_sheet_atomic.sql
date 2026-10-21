-- Atomic, event-scoped cue-sheet import (KF-006 / KF-007).
--
-- One function, one transaction: session mapping, session upsert, affected-
-- session delete, partition and program insert, activity row. Nothing is
-- committed unless every step succeeds.
--
-- Session storage identity (B006-S1). The parser derives a session id from its
-- labels ("sat-am"), which is the same for every event that imports the same
-- workbook. sessions.id is the table's global primary key, so a plain upsert
-- cannot serve two events. This function maps each submitted session id to a
-- storage id at the database boundary:
--   1. (event, id) already exists        -> keep id (existing rows and
--                                           references are unchanged)
--   2. (event, id~hash) already exists   -> keep id~hash (a prior scoped import)
--   3. id is free globally               -> keep id (first importer)
--   4. otherwise                         -> id~hash, where hash is derived from
--                                           the event id, so it is stable per
--                                           event and never overlaps another
--                                           event's row.
-- Programs and partitions are remapped through the same map. A reference to a
-- session that is not in the submitted payload, or to a partition owned by
-- another event, raises 'foreign_reference' and aborts the whole import.
--
-- Trust boundary: the caller is the service-role route, which bypasses RLS, so
-- the tenant check below is the authorization boundary. The actor must own the
-- event or be an accepted editor. SECURITY DEFINER with a pinned search_path,
-- execute granted to service_role only.

create or replace function public.import_cue_sheet(
  p_event_id uuid,
  p_actor_id uuid,
  p_sessions jsonb,
  p_partitions jsonb,
  p_programs jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_suffix text;
  v_sessions_written integer;
  v_programs_written integer;
  v_partitions_written integer;
  v_rec record;
  v_dst text;
  v_candidate text;
  v_affected text[];
  v_key text;
begin
  if p_event_id is null or p_actor_id is null then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  if not exists (select 1 from events e where e.id = p_event_id and e.owner_id = p_actor_id)
     and not exists (
       select 1 from event_collaborators c
       where c.event_id = p_event_id and c.user_id = p_actor_id
         and c.role = 'editor' and c.status = 'accepted'
     )
  then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  v_suffix := '~' || left(md5(p_event_id::text), 8);

  create temp table if not exists _session_map (src text primary key, dst text not null) on commit drop;
  delete from _session_map;

  -- Serialise allocation on every candidate storage id (plain and scoped) before
  -- any mapping decision. Two concurrent first imports of one workbook otherwise
  -- both see the plain id as free, and one fails on the global primary key
  -- (KF-006). Keys are taken in sorted order so two imports cannot deadlock. The
  -- locks end with the transaction; READ COMMITTED then lets each statement see
  -- what the earlier transaction committed.
  for v_key in
    select distinct k from (
      select x.id as k from jsonb_to_recordset(p_sessions) as x(id text)
      union
      select x.id || v_suffix from jsonb_to_recordset(p_sessions) as x(id text)
    ) keys
    order by k
  loop
    perform pg_advisory_xact_lock(hashtextextended('cue-session:' || v_key, 0));
  end loop;

  for v_rec in
    select x.id from jsonb_to_recordset(p_sessions) as x(id text)
  loop
    v_candidate := v_rec.id || v_suffix;
    if exists (select 1 from sessions s where s.event_id = p_event_id and s.id = v_rec.id) then
      v_dst := v_rec.id;
    elsif exists (select 1 from sessions s where s.event_id = p_event_id and s.id = v_candidate) then
      v_dst := v_candidate;
    elsif not exists (select 1 from sessions s where s.id = v_rec.id) then
      v_dst := v_rec.id;
    else
      if exists (select 1 from sessions s where s.id = v_candidate and s.event_id <> p_event_id) then
        raise exception 'foreign_reference' using errcode = '23505';
      end if;
      v_dst := v_candidate;
    end if;
    insert into _session_map (src, dst) values (v_rec.id, v_dst);
  end loop;

  -- Foreign references: every program and partition must point inside this payload.
  if exists (
    select 1 from jsonb_to_recordset(p_programs) as x(session_id text)
    where not exists (select 1 from _session_map m where m.src = x.session_id)
  ) then
    raise exception 'foreign_reference' using errcode = '23503';
  end if;
  if exists (
    select 1 from jsonb_to_recordset(p_partitions) as x(session_id text)
    where not exists (select 1 from _session_map m where m.src = x.session_id)
  ) then
    raise exception 'foreign_reference' using errcode = '23503';
  end if;
  -- A partition id must not already belong to a different event.
  if exists (
    select 1 from jsonb_to_recordset(p_partitions) as x(id uuid)
    join partitions pt on pt.id = x.id
    where pt.event_id <> p_event_id
  ) then
    raise exception 'foreign_reference' using errcode = '23503';
  end if;

  -- A program's partition must be one of this payload's partitions, and must
  -- belong to the same session as the program (no cross-session or cross-event links).
  if exists (
    select 1
    from jsonb_to_recordset(p_programs) as g(session_id text, partition_id uuid)
    where g.partition_id is not null and not exists (
      select 1
      from jsonb_to_recordset(p_partitions) as q(id uuid, session_id text)
      where q.id = g.partition_id and q.session_id = g.session_id
    )
  ) then
    raise exception 'foreign_reference' using errcode = '23503';
  end if;

  select coalesce(array_agg(m.dst), '{}') into v_affected from _session_map m;

  insert into sessions (event_id, id, sheet_name, event_name, day_label, session_label, sort_order)
  select p_event_id, m.dst, x.sheet_name, x.event_name, x.day_label, x.session_label, x.sort_order
  from jsonb_to_recordset(p_sessions) as x(
    id text, sheet_name text, event_name text, day_label text, session_label text, sort_order integer
  )
  join _session_map m on m.src = x.id
  on conflict (event_id, id) do update set
    sheet_name = excluded.sheet_name,
    event_name = excluded.event_name,
    day_label = excluded.day_label,
    session_label = excluded.session_label,
    sort_order = excluded.sort_order;
  get diagnostics v_sessions_written = row_count;

  -- Affected sessions include empty ones, so stale programs are cleared.
  delete from programs where event_id = p_event_id and session_id = any(v_affected);
  delete from partitions where event_id = p_event_id and session_id = any(v_affected);

  insert into partitions (id, event_id, session_id, label, sort_order, start_time)
  select x.id, p_event_id, m.dst, x.label, x.sort_order, x.start_time
  from jsonb_to_recordset(p_partitions) as x(
    id uuid, session_id text, label text, sort_order integer, start_time text
  )
  join _session_map m on m.src = x.session_id;
  get diagnostics v_partitions_written = row_count;

  insert into programs (
    sort_order, event_id, session_id, partition_id, section_label, type, name, description,
    presenter, presenter_requirement, presenter_contact, duration,
    start_time, end_time, audio_mics, audio_track, video_sidescreen,
    backdrop, video_ppt_needed, hall_lights, stage_lights, camera_angle,
    props, curtains, remarks, status, color_tag
  )
  select
    x.sort_order, p_event_id, m.dst, x.partition_id, x.section_label, x.type, x.name, x.description,
    x.presenter, x.presenter_requirement, x.presenter_contact, x.duration,
    x.start_time, x.end_time, x.audio_mics, x.audio_track, x.video_sidescreen,
    x.backdrop, x.video_ppt_needed, x.hall_lights, x.stage_lights, x.camera_angle,
    x.props, x.curtains, x.remarks, x.status, x.color_tag
  from jsonb_to_recordset(p_programs) as x(
    sort_order integer, session_id text, partition_id uuid, section_label text, type text, name text, description text,
    presenter text, presenter_requirement text, presenter_contact text, duration integer,
    start_time text, end_time text, audio_mics boolean, audio_track boolean, video_sidescreen text,
    backdrop boolean, video_ppt_needed boolean, hall_lights text, stage_lights text, camera_angle text,
    props text, curtains text, remarks text, status text, color_tag text
  )
  join _session_map m on m.src = x.session_id;
  get diagnostics v_programs_written = row_count;

  insert into activity_log (event_id, action, detail)
  values (p_event_id, 'cueSheetUpload', format('Imported %s sessions, %s programs', v_sessions_written, v_programs_written));

  return jsonb_build_object(
    'sessionsWritten', v_sessions_written,
    'programsWritten', v_programs_written,
    'partitionsWritten', v_partitions_written,
    'sessionIds', (select coalesce(jsonb_object_agg(m.src, m.dst), '{}'::jsonb) from _session_map m)
  );
end;
$$;

revoke all on function public.import_cue_sheet(uuid, uuid, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.import_cue_sheet(uuid, uuid, jsonb, jsonb, jsonb) to service_role;
