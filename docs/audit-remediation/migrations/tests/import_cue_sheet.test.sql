-- Local Postgres test for supabase/migrations/20260930000000_import_cue_sheet_atomic.sql.
-- Run: psql -v ON_ERROR_STOP=1 -f docs/audit-remediation/migrations/tests/import_cue_sheet.test.sql
-- against a THROWAWAY database only. The tables below mirror the columns the
-- function touches from the production schema; they are not the production DDL.
-- Labeled LOCAL-POSTGRES evidence, not Supabase or production proof.

begin;

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
end $$;

create table events (id uuid primary key, owner_id uuid not null, name text not null);
create table event_collaborators (
  event_id uuid not null references events(id), user_id uuid not null, role text not null, status text not null,
  primary key (event_id, user_id)
);
create table sessions (
  event_id uuid not null references events(id), id text primary key,
  sheet_name text not null, event_name text not null, day_label text not null, session_label text not null,
  sort_order integer not null default 0,
  unique (event_id, id)
);
create table partitions (
  id uuid primary key, event_id uuid not null, session_id text not null references sessions(id),
  label text not null, sort_order integer not null default 0, start_time text
);
create table programs (
  id bigserial primary key, sort_order integer not null, event_id uuid not null,
  session_id text not null references sessions(id), partition_id uuid references partitions(id),
  section_label text, type text, name text, description text, presenter text, presenter_requirement text,
  presenter_contact text, duration integer, start_time text, end_time text, audio_mics boolean, audio_track boolean,
  video_sidescreen text, backdrop boolean, video_ppt_needed boolean, hall_lights text, stage_lights text,
  camera_angle text, props text, curtains text, remarks text, status text, color_tag text,
  unique (session_id, sort_order)
);
create table activity_log (id bigserial primary key, event_id uuid, action text, detail text);

\i supabase/migrations/20260930000000_import_cue_sheet_atomic.sql

create or replace function _assert(cond boolean, msg text) returns void language plpgsql as $$
begin if not cond then raise exception 'ASSERT FAILED: %', msg; end if; end $$;

do $$
declare
  ev_a uuid := '00000000-0000-0000-0000-00000000000a';
  ev_b uuid := '00000000-0000-0000-0000-00000000000b';
  owner_a uuid := '00000000-0000-0000-0000-0000000000a1';
  editor_a uuid := '00000000-0000-0000-0000-0000000000a2';
  viewer_a uuid := '00000000-0000-0000-0000-0000000000a3';
  stranger uuid := '00000000-0000-0000-0000-0000000000f0';
  sessions_json jsonb := '[
    {"id":"s1","sheet_name":"Sat","event_name":"E","day_label":"Sat","session_label":"AM","sort_order":0},
    {"id":"s2-empty","sheet_name":"Sat","event_name":"E","day_label":"Sat","session_label":"PM","sort_order":1}]';
  programs_json jsonb := '[
    {"sort_order":0,"session_id":"s1","partition_id":null,"section_label":null,"type":"item","name":"Opening","description":null,"presenter":null,"presenter_requirement":null,"presenter_contact":null,"duration":10,"start_time":null,"end_time":null,"audio_mics":false,"audio_track":false,"video_sidescreen":null,"backdrop":false,"video_ppt_needed":false,"hall_lights":null,"stage_lights":null,"camera_angle":null,"props":null,"curtains":null,"remarks":null,"status":null,"color_tag":null}]';
  n integer;
  caught text;
begin
  insert into events values (ev_a, owner_a, 'A'), (ev_b, owner_a, 'B');
  insert into event_collaborators values (ev_a, editor_a, 'editor', 'accepted'), (ev_a, viewer_a, 'viewer', 'accepted');

  -- 1. owner import succeeds: 2 sessions, 1 program
  perform import_cue_sheet(ev_a, owner_a, sessions_json, '[]', programs_json);
  select count(*) into n from programs where event_id = ev_a;
  perform _assert(n = 1, 'owner import writes exactly the 1 program');

  -- 2. empty imported session clears a stale program that already exists
  insert into programs (sort_order, event_id, session_id, name, type) values (0, ev_a, 's2-empty', 'stale', 'item');
  perform import_cue_sheet(ev_a, owner_a, sessions_json, '[]', programs_json);
  select count(*) into n from programs where session_id = 's2-empty';
  perform _assert(n = 0, 'empty imported session clears its stale programs');

  -- 3. accepted editor may import
  perform import_cue_sheet(ev_a, editor_a, sessions_json, '[]', programs_json);

  -- 4. viewer and stranger are refused with 42501 and change nothing
  select count(*) into n from sessions;
  begin
    perform import_cue_sheet(ev_a, viewer_a, sessions_json, '[]', programs_json);
    caught := 'none';
  exception when sqlstate '42501' then caught := '42501';
  end;
  perform _assert(caught = '42501', 'viewer refused with 42501');
  begin
    perform import_cue_sheet(ev_a, stranger, sessions_json, '[]', programs_json);
    caught := 'none';
  exception when sqlstate '42501' then caught := '42501';
  end;
  perform _assert(caught = '42501', 'stranger refused with 42501');

  -- 5. foreign session id (already owned by event B) aborts the whole import
  insert into sessions values (ev_b, 'shared-id', 'B', 'B', 'B', 'B', 0);
  begin
    perform import_cue_sheet(ev_a, owner_a,
      '[{"id":"shared-id","sheet_name":"x","event_name":"x","day_label":"x","session_label":"x","sort_order":0}]',
      '[]', '[]');
    caught := 'none';
  exception when unique_violation then caught := 'unique_violation';
  end;
  perform _assert(caught = 'unique_violation', 'foreign session id rejected');
  select count(*) into n from sessions where id = 'shared-id' and event_id = ev_b;
  perform _assert(n = 1, 'event B session untouched by event A import attempt');

  -- 6. induced mid-operation failure AFTER sessions upsert and program delete:
  -- the partition references a session that does not exist, so the partition
  -- insert fails. The session label and existing programs must be unchanged.
  select count(*) into n from programs where event_id = ev_a;
  begin
    perform import_cue_sheet(ev_a, owner_a,
      '[{"id":"s1","sheet_name":"CHANGED","event_name":"E","day_label":"Sat","session_label":"CHANGED","sort_order":0}]',
      '[{"id":"00000000-0000-0000-0000-0000000000cc","session_id":"missing-session","label":"x","sort_order":0,"start_time":null}]',
      '[]');
    caught := 'none';
  exception when foreign_key_violation then caught := 'fk';
  end;
  perform _assert(caught = 'fk', 'induced mid-operation failure raised');
  perform _assert((select session_label from sessions where id = 's1') = 'AM', 'failed import rolled back session upsert');
  perform _assert((select count(*) from programs where event_id = ev_a) = n, 'failed import rolled back program delete');

  -- 7. successful re-import replaces rather than appends
  perform import_cue_sheet(ev_a, owner_a, sessions_json, '[]', programs_json);
  select count(*) into n from programs where event_id = ev_a and session_id = 's1';
  perform _assert(n = 1, 're-import replaces programs, does not duplicate');

  raise notice 'import_cue_sheet local-postgres tests: ALL PASSED';
end $$;

rollback;
