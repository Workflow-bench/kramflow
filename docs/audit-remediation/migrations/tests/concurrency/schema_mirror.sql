-- Local Postgres tests for supabase/migrations/20260930000000_import_cue_sheet_atomic.sql.
-- Run against a THROWAWAY database only:
--   psql -v ON_ERROR_STOP=1 -d <throwaway> -f docs/audit-remediation/migrations/tests/import_cue_sheet.test.sql
-- The table definitions mirror the production DDL for every column and constraint
-- the function depends on (sessions global PK + unique(event_id,id); partitions and
-- programs FKs with cascade; programs.id uuid; programs.type check; deferrable
-- unique(session_id, sort_order)). Not covered here: RLS policies, triggers and
-- columns the function never touches. Labeled LOCAL-POSTGRES evidence only.
-- The whole file runs inside one transaction and rolls back at the end.


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


