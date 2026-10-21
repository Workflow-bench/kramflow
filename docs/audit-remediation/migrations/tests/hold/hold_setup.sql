-- Persistent setup for the hold concurrency runs (disposable database only).
create table if not exists events (id uuid primary key default gen_random_uuid(), owner_id uuid, name text not null);
create table if not exists display_type_state (
  event_id uuid not null references events(id) on delete cascade,
  display_type text not null,
  hold jsonb not null default '{"active":false}'::jsonb,
  timer jsonb not null default '{"mode":"program"}'::jsonb,
  timer_version integer not null default 0,
  primary key (event_id, display_type)
);
insert into events (id, name) values
  ('00000000-0000-0000-0000-00000000000a', 'hold-A'),
  ('00000000-0000-0000-0000-00000000000b', 'hold-B')
on conflict (id) do nothing;
insert into display_type_state (event_id, display_type)
  select e, t from unnest(array['00000000-0000-0000-0000-00000000000a','00000000-0000-0000-0000-00000000000b']::uuid[]) e,
                   unnest(array['presenter','green-room','av','general']) t
  on conflict (event_id, display_type) do nothing;
