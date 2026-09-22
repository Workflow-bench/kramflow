-- Fixes a real cross-tenant data-corruption bug found in a full-codebase
-- review: insert_program_into_partition (0001_multitenant.sql) computed
-- sort_order and shifted existing rows scoped only by p_session_id, never
-- p_event_id, and never checked that p_session_id actually belongs to
-- p_event_id at all. app/api/programs/route.ts's POST handler passes the
-- client-supplied sessionId straight through after only checking the
-- caller owns p_event_id — not that the session does. An editor on Event A
-- who learns Event B's session id (e.g. from a distributed share-link's
-- /api/display-view response, which includes sessions[].id) could insert
-- into and reorder Event B's session with zero access grant to Event B.
--
-- Fix: raise an exception if p_session_id doesn't belong to p_event_id,
-- and scope every read/update inside the function by event_id too (not
-- just session_id) as defense in depth, matching the pattern
-- delete_program (0001_multitenant.sql) already uses.

begin;

drop function if exists insert_program_into_partition(
  uuid, text, uuid, text, text, text, text, text, text, text, integer, text, text, boolean, boolean, text, boolean, boolean, text, text, text, text, text, text, text, text, uuid, boolean
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
  if not exists (select 1 from sessions where id = p_session_id and event_id = p_event_id) then
    raise exception 'Session % does not belong to event %', p_session_id, p_event_id;
  end if;
  if p_partition_id is not null and not exists (
    select 1 from partitions where id = p_partition_id and event_id = p_event_id
  ) then
    raise exception 'Partition % does not belong to event %', p_partition_id, p_event_id;
  end if;

  perform pg_advisory_xact_lock(hashtext(p_session_id));
  set constraints programs_session_sort_order_key deferred;

  if p_partition_id is null then
    select coalesce(max(sort_order), 0) into v_target_order
    from programs where session_id = p_session_id and event_id = p_event_id;
  else
    select coalesce(
      (select max(pr.sort_order)
       from partitions pt
       join programs pr on pr.partition_id = pt.id
       where pt.session_id = p_session_id
         and pt.event_id = p_event_id
         and pr.event_id = p_event_id
         and pt.sort_order <= (select sort_order from partitions where id = p_partition_id and event_id = p_event_id)),
      (select coalesce(min(sort_order), 1) - 1 from programs where session_id = p_session_id and event_id = p_event_id)
    ) into v_target_order;
  end if;
  v_target_order := v_target_order + 1;

  update programs set sort_order = sort_order + 1
  where session_id = p_session_id and event_id = p_event_id and sort_order >= v_target_order;

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

commit;
