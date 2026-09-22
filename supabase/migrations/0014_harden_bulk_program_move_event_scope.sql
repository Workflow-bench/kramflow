-- Hardens the bulk program move RPC against cross-event partition assignment.
--
-- The route already verifies that every selected program belongs to the
-- authorized event, but older versions of this RPC accepted only p_ids and
-- p_partition_id. Because programs.partition_id references partitions(id)
-- without a composite event constraint, a caller that reached this RPC with a
-- partition id from another event could attach authorized program rows to a
-- foreign event's partition. Keep the route check, and make the database
-- function enforce the same boundary as defense in depth.

begin;

drop function if exists bulk_move_programs_to_partition(uuid[], uuid);
drop function if exists bulk_move_programs_to_partition(uuid, uuid[], uuid);

create or replace function bulk_move_programs_to_partition(
  p_event_id uuid,
  p_ids uuid[],
  p_partition_id uuid
)
returns void
language plpgsql
as $$
declare
  v_session_id text;
begin
  if p_ids is null or array_length(p_ids, 1) is null then
    raise exception 'Program ids are required';
  end if;

  if exists (
    select 1
    from unnest(p_ids) as requested(id)
    left join programs p on p.id = requested.id and p.event_id = p_event_id
    where p.id is null
  ) then
    raise exception 'One or more programs do not belong to event %', p_event_id;
  end if;

  select session_id into strict v_session_id
  from (select distinct session_id from programs where event_id = p_event_id and id = any(p_ids)) s;

  if p_partition_id is not null and not exists (
    select 1
    from partitions
    where id = p_partition_id
      and event_id = p_event_id
      and session_id = v_session_id
  ) then
    raise exception 'Partition % does not belong to event % and session %', p_partition_id, p_event_id, v_session_id;
  end if;

  perform pg_advisory_xact_lock(hashtext(v_session_id));
  set constraints programs_session_sort_order_key deferred;

  create temporary table _bulk_rest on commit drop as
    select id, row_number() over (order by sort_order) as rn
    from programs
    where event_id = p_event_id
      and session_id = v_session_id
      and not (id = any(p_ids));

  update programs p
  set sort_order = r.rn, version = p.version + 1
  from _bulk_rest r
  where p.id = r.id
    and p.event_id = p_event_id;

  update programs p
  set sort_order = (select coalesce(max(rn), 0) from _bulk_rest) + array_position(p_ids, p.id),
      partition_id = p_partition_id,
      version = p.version + 1
  where p.event_id = p_event_id
    and p.id = any(p_ids);
end;
$$;

commit;
