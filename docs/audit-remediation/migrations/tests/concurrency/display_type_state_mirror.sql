-- Mirror of the display_type_state columns and keys used by the timer and hold routes
-- (supabase/migrations/20260909091740_display_type_state.sql). Keys: primary key (event_id,
-- display_type). Columns the routes read or write only. Disposable database only.
create table if not exists display_type_state (
  event_id uuid not null references events(id) on delete cascade,
  display_type text not null,
  hold jsonb not null default '{"active":false}'::jsonb,
  timer jsonb not null default '{"mode":"program"}'::jsonb,
  timer_version integer not null default 0,
  primary key (event_id, display_type)
);
