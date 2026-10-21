-- Local Postgres tests for supabase/migrations/20260930000000_import_cue_sheet_atomic.sql.
-- Run against a THROWAWAY database only:
--   psql -v ON_ERROR_STOP=1 -d <throwaway> -f docs/audit-remediation/migrations/tests/import_cue_sheet.test.sql
-- The table definitions mirror the production DDL for every column and constraint
-- the function depends on (sessions global PK + unique(event_id,id); partitions and
-- programs FKs with cascade; programs.id uuid; programs.type check; deferrable
-- unique(session_id, sort_order)). Not covered here: RLS policies, triggers and
-- columns the function never touches. Labeled LOCAL-POSTGRES evidence only.
-- The whole file runs inside one transaction and rolls back at the end.

begin;

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
end $$;

create table events (id uuid primary key default gen_random_uuid(), owner_id uuid not null, name text not null);
create table event_collaborators (
  event_id uuid not null references events(id) on delete cascade, user_id uuid not null,
  role text not null check (role in ('editor','viewer')), status text not null default 'accepted',
  primary key (event_id, user_id)
);
create table sessions (
  id text primary key,
  event_id uuid not null references events(id) on delete cascade,
  sheet_name text not null, event_name text not null, day_label text not null, session_label text not null,
  sort_order integer not null default 0,
  unique (event_id, id)
);
create table partitions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  session_id text not null references sessions(id) on delete cascade,
  label text not null, sort_order integer not null, start_time text
);
create table programs (
  id uuid primary key default gen_random_uuid(),
  sort_order integer not null,
  event_id uuid not null references events(id) on delete cascade,
  session_id text not null references sessions(id) on delete cascade,
  partition_id uuid references partitions(id) on delete set null,
  section_label text,
  type text not null default 'item' check (type in ('item', 'break')),
  name text not null, description text, presenter text, presenter_requirement text, presenter_contact text,
  duration integer, start_time text, end_time text, audio_mics boolean, audio_track boolean,
  video_sidescreen text, backdrop boolean, video_ppt_needed boolean, hall_lights text, stage_lights text,
  camera_angle text, props text, curtains text, remarks text, status text, color_tag text,
  unique (session_id, sort_order) deferrable initially immediate
);
create table activity_log (id bigserial primary key, event_id uuid, action text, detail text);

\i supabase/migrations/20260930000000_import_cue_sheet_atomic.sql

create or replace function _assert(cond boolean, msg text) returns void language plpgsql as $$
begin if not cond then raise exception 'ASSERT FAILED: %', msg; end if; end $$;

create or replace function _sess(label text) returns jsonb language sql immutable as $$
  select ('[{"id":"s1","sheet_name":"Sat","event_name":"E","day_label":"Sat","session_label":"' || label || '","sort_order":0},'
      || '{"id":"s2-empty","sheet_name":"Sat","event_name":"E","day_label":"Sat","session_label":"PM","sort_order":1}]')::jsonb
$$;

create or replace function _prog(sess text, nm text, ord integer) returns text language sql immutable as $$
  select '{"sort_order":' || ord || ',"session_id":"' || sess || '","partition_id":null,"section_label":null,"type":"item","name":"' || nm
      || '","description":null,"presenter":null,"presenter_requirement":null,"presenter_contact":null,"duration":10,"start_time":null,"end_time":null,"audio_mics":false,"audio_track":false,"video_sidescreen":null,"backdrop":false,"video_ppt_needed":false,"hall_lights":null,"stage_lights":null,"camera_angle":null,"props":null,"curtains":null,"remarks":null,"status":null,"color_tag":null}'
$$;

do $$
declare
  ev_a uuid := '00000000-0000-0000-0000-00000000000a';
  ev_b uuid := '00000000-0000-0000-0000-00000000000b';
  owner_a uuid := '00000000-0000-0000-0000-0000000000a1';
  owner_b uuid := '00000000-0000-0000-0000-0000000000b1';
  editor_a uuid := '00000000-0000-0000-0000-0000000000a2';
  viewer_a uuid := '00000000-0000-0000-0000-0000000000a3';
  stranger uuid := '00000000-0000-0000-0000-0000000000f0';
  progs_a jsonb;
  progs_b jsonb;
  sess_b_s1 text;
  sess_b_empty text;
  n integer;
  caught text;
  part_a uuid := '00000000-0000-0000-0000-0000000000fa';
begin
  insert into events (id, owner_id, name) values (ev_a, owner_a, 'A'), (ev_b, owner_b, 'B');
  insert into event_collaborators values (ev_a, editor_a, 'editor', 'accepted'), (ev_a, viewer_a, 'viewer', 'accepted');

  progs_a := ('[' || _prog('s1','Opening',0) || ']')::jsonb;
  progs_b := ('[' || _prog('s1','B opening',0) || ']')::jsonb;

  -- 1. the same workbook imported into two different events succeeds for both
  perform import_cue_sheet(ev_a, owner_a, _sess('AM'), '[]'::jsonb, progs_a::jsonb);
  perform import_cue_sheet(ev_b, owner_b, _sess('AM'), '[]'::jsonb, progs_b::jsonb);
  select count(*) into n from sessions where event_id = ev_a;
  perform _assert(n = 2, 'event A has its two sessions');
  select count(*) into n from sessions where event_id = ev_b;
  perform _assert(n = 2, 'event B has its two sessions despite identical labels');
  select count(*) into n from programs where event_id = ev_b and name = 'B opening';
  perform _assert(n = 1, 'event B program written');

  -- B's session storage id is scoped; A keeps the plain id
  select id into sess_b_s1 from sessions where event_id = ev_b and id like 's1~%';
  perform _assert(sess_b_s1 is not null, 'event B got a scoped storage id');
  perform _assert((select count(*) from sessions where id = 's1' and event_id = ev_a) = 1, 'event A kept the plain id');
  select id into sess_b_empty from sessions where event_id = ev_b and id like 's2-empty~%';

  -- 2. repeated import updates only its own event
  perform import_cue_sheet(ev_b, owner_b, _sess('AM2'), '[]', progs_b);
  perform _assert((select session_label from sessions where id = sess_b_s1) = 'AM2', 'B re-import updated B');
  perform _assert((select session_label from sessions where id = 's1' and event_id = ev_a) = 'AM', 'B re-import did not touch A');
  select count(*) into n from sessions where event_id = ev_b;
  perform _assert(n = 2, 'B re-import did not duplicate sessions');

  -- 3. empty-session replacement clears stale programs under the scoped id
  insert into programs (sort_order, event_id, session_id, name, type)
  values (0, ev_b, sess_b_empty, 'stale', 'item');
  perform import_cue_sheet(ev_b, owner_b, _sess('AM2'), '[]', progs_b);
  select count(*) into n from programs where session_id = sess_b_empty;
  perform _assert(n = 0, 'empty imported session cleared stale programs under its scoped id');

  -- 4. induced mid-operation failure (deferrable unique(session_id, sort_order) fires
  --    at commit of the statement) rolls back B's session upsert and program replacement
  select count(*) into n from programs where event_id = ev_b;
  begin
    perform import_cue_sheet(ev_b, owner_b, _sess('CHANGED'), '[]',
      ('[' || _prog('s1','dup-1',0) || ',' || _prog('s1','dup-2',0) || ']')::jsonb);
    caught := 'none';
  exception when unique_violation then caught := 'unique_violation';
  end;
  perform _assert(caught = 'unique_violation', 'duplicate program position is rejected');
  perform _assert((select session_label from sessions where id = sess_b_s1) = 'AM2', 'rollback kept B session label');
  perform _assert((select count(*) from programs where event_id = ev_b) = n, 'rollback kept B programs');

  -- 5. authorization: viewer and stranger refused with 42501, nothing changes
  begin perform import_cue_sheet(ev_a, viewer_a, _sess('AM'), '[]', progs_a); caught := 'none';
  exception when sqlstate '42501' then caught := '42501'; end;
  perform _assert(caught = '42501', 'viewer refused');
  begin perform import_cue_sheet(ev_a, stranger, _sess('AM'), '[]', progs_a); caught := 'none';
  exception when sqlstate '42501' then caught := '42501'; end;
  perform _assert(caught = '42501', 'stranger refused');

  -- 6. accepted editor may import into their event
  perform import_cue_sheet(ev_a, editor_a, _sess('AM'), '[]', progs_a);

  -- 7. malicious foreign session reference: a program naming another event's
  --    storage id (not in this payload) is rejected and nothing is written
  begin
    perform import_cue_sheet(ev_b, owner_b, _sess('AM2'), '[]',
      ('[' || _prog('s1-not-in-payload','x',0) || ']')::jsonb);
    caught := 'none';
  exception when sqlstate '23503' then caught := '23503'; end;
  perform _assert(caught = '23503', 'program referencing a session outside the payload is rejected');
  perform _assert((select session_label from sessions where id = sess_b_s1) = 'AM2', 'foreign-session attempt left B unchanged');

  -- 8. malicious foreign partition: a payload partition whose id is owned by
  --    event A is rejected for event B, and A's partition is untouched
  insert into partitions (id, event_id, session_id, label, sort_order)
  values (part_a, ev_a, 's1', 'A section', 0);
  begin
    perform import_cue_sheet(ev_b, owner_b, _sess('AM2'),
      ('[{"id":"' || part_a || '","session_id":"s1","label":"stolen","sort_order":0,"start_time":null}]')::jsonb,
      '[]'::jsonb);
    caught := 'none';
  exception when others then caught := sqlstate;
  end;
  perform _assert(caught = '23503',
    'partition owned by another event is rejected with 23503 (got ' || caught || ')');
  perform _assert((select count(*) from partitions where event_id = ev_a) = 1, 'event A partition untouched');

  -- 9. program linked to a partition that is not in this payload is rejected
  begin
    perform import_cue_sheet(ev_b, owner_b, _sess('AM2'), '[]'::jsonb,
      ('[' || replace(_prog('s1','cross',0), '"partition_id":null', '"partition_id":"' || part_a || '"') || ']')::jsonb);
    caught := 'none';
  exception when sqlstate '23503' then caught := '23503'; end;
  perform _assert(caught = '23503', 'program linked to a partition outside the payload is rejected');
  perform _assert((select session_label from sessions where id = sess_b_s1) = 'AM2', 'cross-link attempt left B unchanged');

  raise notice 'import_cue_sheet local-postgres scenarios: ALL PASSED';
end $$;

rollback;
