-- Hold persistence on a LOCAL POSTGRES MIRROR (B009, KF-031). Disposable database only.
-- Mirrors the statements app/api/display-engine/hold/route.ts issues, with the same keys.
-- Not the production migration and not the Supabase runtime (no PostgREST, no RLS).
-- Run: psql -v ON_ERROR_STOP=1 -d <throwaway> -f hold_persistence.sql
-- Prerequisite: events(id uuid, name text) exists; this file creates display_type_state
-- from display_type_state_mirror.sql's definition. Rolls back at the end.
begin;

create table if not exists events (id uuid primary key default gen_random_uuid(), owner_id uuid, name text not null);
create table if not exists display_type_state (
  event_id uuid not null references events(id) on delete cascade,
  display_type text not null,
  hold jsonb not null default '{"active":false}'::jsonb,
  timer jsonb not null default '{"mode":"program"}'::jsonb,
  timer_version integer not null default 0,
  primary key (event_id, display_type)
);

-- Two tenants with the same display types. Event B starts with NO rows (the KF-031 case).
insert into events (id, name) values
  ('00000000-0000-0000-0000-00000000000a', 'hold-A'),
  ('00000000-0000-0000-0000-00000000000b', 'hold-B');
insert into display_type_state (event_id, display_type)
  select '00000000-0000-0000-0000-00000000000a', t from unnest(array['presenter','green-room','av','general']) t;

create or replace function _check(label text, ok boolean) returns void language plpgsql as $$
begin
  if not ok then raise exception 'FAIL: %', label; end if;
  raise notice 'PASS: %', label;
end $$;

-- 1. Activation (route: update {hold} where event and type). Exactly one row.
with u as (
  update display_type_state set hold = '{"active":true,"message":"Please Stand By","subMessage":null,"continueClock":false,"activatedAt":"2026-10-04T00:00:00Z"}'::jsonb
  where event_id = '00000000-0000-0000-0000-00000000000a' and display_type = 'presenter'
  returning hold
) select _check('activation writes exactly one row', (select count(*) from u) = 1 and (select (hold->>'active')::boolean from u));

-- 2. Deactivation (route: read current hold, then write {...current, active:false, activatedAt:null}).
with cur as (
  select hold from display_type_state where event_id = '00000000-0000-0000-0000-00000000000a' and display_type = 'presenter'
), u as (
  update display_type_state set hold = (select hold from cur) || '{"active":false,"activatedAt":null}'::jsonb
  where event_id = '00000000-0000-0000-0000-00000000000a' and display_type = 'presenter'
  returning hold
) select _check('deactivation keeps the message and clears active', (select count(*) from u) = 1
  and (select (hold->>'active')::boolean from u) = false
  and (select hold->>'message' from u) = 'Please Stand By');

-- 3. Missing-row initialisation (route: provisioning upsert with ignoreDuplicates, then update).
-- Event B has no rows. Provisioning inserts all four types once; a second run is a no-op.
insert into display_type_state (event_id, display_type)
  select '00000000-0000-0000-0000-00000000000b', t from unnest(array['presenter','green-room','av','general']) t
  on conflict (event_id, display_type) do nothing;
insert into display_type_state (event_id, display_type)
  select '00000000-0000-0000-0000-00000000000b', t from unnest(array['presenter','green-room','av','general']) t
  on conflict (event_id, display_type) do nothing;
select _check('provisioning creates four rows once, idempotently', (select count(*) from display_type_state where event_id = '00000000-0000-0000-0000-00000000000b') = 4);

-- 4. Hold write after provisioning lands on the row (route readback sees one row).
with u as (
  update display_type_state set hold = '{"active":true,"message":"B stands by","subMessage":null,"continueClock":true,"activatedAt":"2026-10-04T00:00:00Z"}'::jsonb
  where event_id = '00000000-0000-0000-0000-00000000000b' and display_type = 'presenter'
  returning hold
) select _check('hold after provisioning writes one row', (select count(*) from u) = 1);

-- 5. Missing row WITHOUT provisioning: the write matches zero rows (route refuses to report ok).
with u as (
  update display_type_state set hold = '{"active":true}'::jsonb
  where event_id = '00000000-0000-0000-0000-0000000000ff' and display_type = 'presenter'
  returning hold
) select _check('write to a non-existent event matches zero rows', (select count(*) from u) = 0);

-- 6. Tenant boundary: A's hold does not touch B, and B's rows do not match A's id.
select _check('activating A left B presenter hold untouched', (
  select hold->>'active' from display_type_state where event_id = '00000000-0000-0000-0000-00000000000b' and display_type = 'presenter'
) = 'true' and (select hold->>'message' from display_type_state where event_id = '00000000-0000-0000-0000-00000000000b' and display_type = 'presenter') = 'B stands by');
with u as (
  update display_type_state set hold = '{"active":false}'::jsonb
  where event_id = '00000000-0000-0000-0000-00000000000a' and display_type = 'presenter'
    and event_id = '00000000-0000-0000-0000-00000000000b'
  returning hold
) select _check('cross-tenant predicate (A row, B id) matches zero rows', (select count(*) from u) = 0);

-- 7. Display types are independent within an event: presenter hold does not change general.
select _check('presenter hold leaves general inactive', (
  select (hold->>'active')::boolean from display_type_state where event_id = '00000000-0000-0000-0000-00000000000a' and display_type = 'general'
) = false);

-- 8. Invalid display type matches nothing (route validates the type before any write).
with u as (
  update display_type_state set hold = '{"active":true}'::jsonb
  where event_id = '00000000-0000-0000-0000-00000000000a' and display_type = 'not-a-type'
  returning hold
) select _check('unknown display type writes nothing', (select count(*) from u) = 0);

select 'hold_persistence: ALL PASSED (local postgres mirror)' as result;
rollback;
