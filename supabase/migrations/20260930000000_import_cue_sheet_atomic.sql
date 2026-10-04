-- Atomic cue-sheet import (KF-006 / KF-007, Lane C).
--
-- One function, one transaction: session upsert, affected-session delete,
-- partition and program insert. Previously the route upserted sessions in one
-- request and called replace_session_programs in a second, so a failure in the
-- second left imported sessions committed without their programs.
--
-- Affected sessions are derived from the parsed SESSIONS (including empty
-- ones), so an imported session with zero items still clears its stale
-- programs. A foreign session id (already owned by another event) violates the
-- sessions primary key and aborts the whole transaction.
--
-- The caller is the service-role route, which bypasses RLS, so the tenant check
-- below is the authorization boundary: the actor must own the event or be an
-- accepted editor. SECURITY DEFINER with a pinned search_path, and execute is
-- granted to service_role only.

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
  v_session_ids text[];
  v_sessions_written integer;
  v_programs_written integer;
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

  select coalesce(array_agg(x.id), '{}')
    into v_session_ids
    from jsonb_to_recordset(p_sessions) as x(id text);

  insert into sessions (event_id, id, sheet_name, event_name, day_label, session_label, sort_order)
  select p_event_id, x.id, x.sheet_name, x.event_name, x.day_label, x.session_label, x.sort_order
  from jsonb_to_recordset(p_sessions) as x(
    id text, sheet_name text, event_name text, day_label text, session_label text, sort_order integer
  )
  on conflict (event_id, id) do update set
    sheet_name = excluded.sheet_name,
    event_name = excluded.event_name,
    day_label = excluded.day_label,
    session_label = excluded.session_label,
    sort_order = excluded.sort_order;
  get diagnostics v_sessions_written = row_count;

  delete from programs where event_id = p_event_id and session_id = any(v_session_ids);
  delete from partitions where event_id = p_event_id and session_id = any(v_session_ids);

  insert into partitions (id, event_id, session_id, label, sort_order, start_time)
  select x.id, p_event_id, x.session_id, x.label, x.sort_order, x.start_time
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
    x.sort_order, p_event_id, x.session_id, x.partition_id, x.section_label, x.type, x.name, x.description,
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
  );
  get diagnostics v_programs_written = row_count;

  insert into activity_log (event_id, action, detail)
  values (p_event_id, 'cueSheetUpload', format('Imported %s sessions, %s programs', v_sessions_written, v_programs_written));

  return jsonb_build_object('sessionsWritten', v_sessions_written, 'programsWritten', v_programs_written);
end;
$$;

revoke all on function public.import_cue_sheet(uuid, uuid, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.import_cue_sheet(uuid, uuid, jsonb, jsonb, jsonb) to service_role;
