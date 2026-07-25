-- KramFlow schema — run once in the Supabase SQL editor on a fresh project.
-- See docs/ARCHITECTURE.md and the restructure plan for the reasoning behind
-- each table. Idempotent: safe to re-run (uses IF NOT EXISTS / CREATE OR REPLACE).

-- ---------------------------------------------------------------------------
-- sessions
-- ---------------------------------------------------------------------------
create table if not exists sessions (
  id text primary key,
  sheet_name text not null,
  event_name text not null,
  day_label text not null,
  session_label text not null,
  sort_order integer not null default 0
);

-- ---------------------------------------------------------------------------
-- programs
-- Note: "order" is a reserved SQL word, so the sequence-position column is
-- named sort_order here (mirrors sessions.sort_order); the app's Program
-- type maps it to `order` at the data-access boundary (lib/data/sessions.ts).
-- ---------------------------------------------------------------------------
create table if not exists programs (
  id uuid primary key default gen_random_uuid(),
  sort_order integer not null,
  session_id text not null references sessions(id) on delete cascade,
  section_label text,
  type text not null default 'item' check (type in ('item', 'break')),
  name text not null,
  description text,
  presenter text,
  presenter_requirement text,
  presenter_contact text,
  duration integer not null default 0,
  start_time text,
  end_time text,
  audio_mics boolean not null default false,
  audio_track boolean not null default false,
  video_sidescreen text not null default 'none' check (video_sidescreen in ('none', 'slides', 'live_feed')),
  backdrop boolean not null default false,
  video_ppt_needed boolean not null default false,
  hall_lights text,
  stage_lights text,
  camera_angle text,
  props text,
  curtains text check (curtains in ('open', 'closed')),
  remarks text,
  status text not null default 'confirmed' check (status in ('confirmed', 'draft', 'cut', 'tbd')),
  color_tag text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text,
  -- Optimistic-concurrency guard for app/api/programs/[id]/route.ts's PATCH.
  -- Confirmed live: two operators editing the same item within the same
  -- stale-data window (one bumps duration, the other adds a stage note)
  -- both got a 200 back, but whoever's PATCH landed second silently wiped
  -- the other's change — the form PATCHes its entire snapshot, not a diff.
  -- Same version-column pattern already used for live_state/display_state.
  version integer not null default 0
);
alter table programs add column if not exists version integer not null default 0;

create index if not exists programs_session_id_idx on programs(session_id);
create unique index if not exists programs_session_sort_order_idx on programs(session_id, sort_order);

-- ---------------------------------------------------------------------------
-- replace_session_programs — atomic "delete this session's programs, then
-- insert the new set" for the cue-sheet upload route and scripts/seed.ts.
-- Both previously did this as two separate round trips (delete, then
-- insert); if the insert failed after the delete had already committed
-- (a transient error, a row that fails a check constraint the dry-run
-- validation didn't catch, etc.), the affected sessions were left with
-- zero programs until a successful re-upload — a real data-loss window.
-- A single function call runs in one transaction: either both steps
-- happen or neither does.
--
-- id/created_at/updated_at/updated_by are deliberately not in the column
-- list below — they're left for the table's own defaults, exactly as the
-- old two-step insert() already relied on (parsed rows never carry ids).
-- ---------------------------------------------------------------------------
create or replace function replace_session_programs(p_session_ids text[], p_programs jsonb)
returns void
language plpgsql
as $$
begin
  delete from programs where session_id = any(p_session_ids);

  insert into programs (
    sort_order, session_id, section_label, type, name, description,
    presenter, presenter_requirement, presenter_contact, duration,
    start_time, end_time, audio_mics, audio_track, video_sidescreen,
    backdrop, video_ppt_needed, hall_lights, stage_lights, camera_angle,
    props, curtains, remarks, status, color_tag
  )
  select
    sort_order, session_id, section_label, type, name, description,
    presenter, presenter_requirement, presenter_contact, duration,
    start_time, end_time, audio_mics, audio_track, video_sidescreen,
    backdrop, video_ppt_needed, hall_lights, stage_lights, camera_angle,
    props, curtains, remarks, status, color_tag
  from jsonb_to_recordset(p_programs) as x(
    sort_order integer, session_id text, section_label text, type text, name text, description text,
    presenter text, presenter_requirement text, presenter_contact text, duration integer,
    start_time text, end_time text, audio_mics boolean, audio_track boolean, video_sidescreen text,
    backdrop boolean, video_ppt_needed boolean, hall_lights text, stage_lights text, camera_angle text,
    props text, curtains text, remarks text, status text, color_tag text
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- insert_program_at_end — atomic "find the next sort_order for this
-- session, then insert" for app/api/programs/route.ts's POST handler.
-- Previously done as two round trips from Node (select max(sort_order),
-- then insert); two "Add item" requests landing close together could both
-- read the same max and then collide on programs_session_sort_order_idx,
-- crashing the second request. pg_advisory_xact_lock serializes concurrent
-- calls for the same session_id only — other sessions are unaffected —
-- and the lock releases automatically at the end of the transaction.
--
-- p_sort_order is nullable: pass an explicit position to insert there, or
-- null to append at the end (mirrors programInputSchema's optional
-- sortOrder). id/created_at/updated_at intentionally omitted, same
-- reasoning as replace_session_programs above.
-- ---------------------------------------------------------------------------
create or replace function insert_program_at_end(
  p_session_id text,
  p_sort_order integer,
  p_section_label text, p_type text, p_name text, p_description text,
  p_presenter text, p_presenter_requirement text, p_presenter_contact text, p_duration integer,
  p_start_time text, p_end_time text, p_audio_mics boolean, p_audio_track boolean, p_video_sidescreen text,
  p_backdrop boolean, p_video_ppt_needed boolean, p_hall_lights text, p_stage_lights text, p_camera_angle text,
  p_props text, p_curtains text, p_remarks text, p_status text, p_color_tag text
)
returns programs
language plpgsql
as $$
declare
  v_sort_order integer;
  v_row programs;
begin
  perform pg_advisory_xact_lock(hashtext(p_session_id));

  if p_sort_order is null then
    select coalesce(max(sort_order), 0) + 1 into v_sort_order from programs where session_id = p_session_id;
  else
    v_sort_order := p_sort_order;
  end if;

  insert into programs (
    sort_order, session_id, section_label, type, name, description,
    presenter, presenter_requirement, presenter_contact, duration,
    start_time, end_time, audio_mics, audio_track, video_sidescreen,
    backdrop, video_ppt_needed, hall_lights, stage_lights, camera_angle,
    props, curtains, remarks, status, color_tag
  ) values (
    v_sort_order, p_session_id, p_section_label, p_type, p_name, p_description,
    p_presenter, p_presenter_requirement, p_presenter_contact, p_duration,
    p_start_time, p_end_time, p_audio_mics, p_audio_track, p_video_sidescreen,
    p_backdrop, p_video_ppt_needed, p_hall_lights, p_stage_lights, p_camera_angle,
    p_props, p_curtains, p_remarks, p_status, p_color_tag
  )
  returning * into v_row;

  return v_row;
end;
$$;

-- ---------------------------------------------------------------------------
-- swap_program_order — atomically swap two programs' sort_order, for the
-- Cue Sheet editor's move-up/move-down reordering
-- (app/(operator)/operator/cue-sheet/page.tsx). A naive client-side swap
-- (PATCH A to B's order, then PATCH B to A's order) would violate
-- programs_session_sort_order_idx's uniqueness the instant the first PATCH
-- lands, since both rows would briefly share a sort_order. Routing through
-- -1 first (sort_order is always >= 1 in practice) avoids that, and running
-- all three updates inside one function keeps the whole swap in a single
-- transaction — no other request can observe the intermediate state.
-- ---------------------------------------------------------------------------
create or replace function swap_program_order(p_id_a uuid, p_id_b uuid)
returns void
language plpgsql
as $$
declare
  v_order_a integer;
  v_order_b integer;
begin
  select sort_order into v_order_a from programs where id = p_id_a;
  select sort_order into v_order_b from programs where id = p_id_b;
  if v_order_a is null or v_order_b is null then
    raise exception 'One or both program ids not found';
  end if;

  update programs set sort_order = -1, version = version + 1 where id = p_id_a;
  update programs set sort_order = v_order_a, version = version + 1 where id = p_id_b;
  update programs set sort_order = v_order_b, version = version + 1 where id = p_id_a;
end;
$$;

-- ---------------------------------------------------------------------------
-- live_state — singleton row, kept small by design (see ARCHITECTURE.md)
-- ---------------------------------------------------------------------------
create table if not exists live_state (
  id smallint primary key default 1 check (id = 1),
  active_session_id text references sessions(id),
  paused_at timestamptz,
  alert jsonb,
  progress_by_session jsonb not null default '{}'::jsonb,
  notes_overrides jsonb not null default '{}'::jsonb,
  presenter_state jsonb not null default '{"note": null, "flashAt": null}'::jsonb,
  updated_at timestamptz not null default now(),
  -- Optimistic concurrency: app/api/live/route.ts reads this row, computes
  -- a patch, then writes it back as two separate round trips — without a
  -- version check, two near-simultaneous requests (a fast double-tap on
  -- Next, or Operator + Remote firing close together) can both read the
  -- same starting state and the second write silently clobbers the
  -- first's. The route bumps this by 1 on every successful write and
  -- requires it to still match at write time; a mismatch means someone
  -- else's write landed first, so the route returns 409 instead of
  -- silently overwriting.
  version integer not null default 0
);

insert into live_state (id) values (1) on conflict (id) do nothing;
alter table live_state add column if not exists version integer not null default 0;

-- ---------------------------------------------------------------------------
-- activity_log — short operator action history, not analytics (see plan)
-- ---------------------------------------------------------------------------
create table if not exists activity_log (
  id bigint generated always as identity primary key,
  action text not null,
  detail text,
  created_at timestamptz not null default now()
);

create index if not exists activity_log_created_at_idx on activity_log(created_at desc);

-- ---------------------------------------------------------------------------
-- display_state — singleton row for the Display Engine's own live state
-- (Hold, Timer, Speaker Ready). Same "keep it small" reasoning as
-- live_state. Previously synced via BroadcastChannel/WebSocket only
-- (same-browser or requiring a separately-deployed relay); moved here so
-- it syncs across real devices the same reliable way live_state does. See
-- docs/DISPLAY_ENGINE.md.
-- ---------------------------------------------------------------------------
create table if not exists display_state (
  id smallint primary key default 1 check (id = 1),
  hold jsonb not null default '{"active":false,"message":"Please Stand By","subMessage":null,"continueClock":false,"activatedAt":null}'::jsonb,
  timer jsonb not null default '{"mode":"program","source":"auto","startedAt":null,"durationSeconds":300,"pausedAt":null,"adjustmentSeconds":0,"thresholds":{"yellowAt":300,"orangeAt":60,"redAt":0,"criticalAfter":60}}'::jsonb,
  speaker_ready jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  -- Same optimistic-concurrency reasoning as live_state.version, scoped to
  -- just the timer column: app/api/display-engine/timer/route.ts's adjust/
  -- pause/resume/reset actions all depend on the timer value it read at
  -- the start of the request, so two near-simultaneous timer PATCHes can
  -- race the same way live_state's next/previous can. Hold and
  -- speaker_ready each update their own column independently and don't
  -- share this counter — a concurrent Hold toggle should never fail a
  -- Timer adjustment's version check just because they hit the same row.
  timer_version integer not null default 0
);

insert into display_state (id) values (1) on conflict (id) do nothing;
alter table display_state add column if not exists timer_version integer not null default 0;

-- ---------------------------------------------------------------------------
-- display_registry — one row per connected display (Presenter/AV/Green
-- Room/General instances, could be several of the same type across
-- different rooms/devices). Self-registers + heartbeats every 15s
-- (lib/display-engine/use-register-display.ts). Display Manager reads
-- this to show connection status/latency and issue remote commands via
-- pending_command.
-- ---------------------------------------------------------------------------
create table if not exists display_registry (
  id text primary key,
  name text not null,
  type text not null,
  room text,
  profile_id text,
  latency_ms integer,
  registered_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  pending_command jsonb
);

-- ---------------------------------------------------------------------------
-- display_broadcasts — Broadcast Center messages. `status`/`dismissed_for`
-- reconstruct the app's active/scheduled/history views client-side from
-- one table rather than three separate arrays:
--   active    = status='sent' and dismissed_at is null and not expired
--   scheduled = status='scheduled'
--   history   = every status='sent' row, regardless of dismissed_at
--     (dismissing removes a message from "active" everywhere, same as the
--     original store — it does not remove it from history)
-- ---------------------------------------------------------------------------
create table if not exists display_broadcasts (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  title text not null,
  message text not null,
  icon text,
  priority smallint not null default 2,
  target jsonb not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  duration_seconds integer,
  acknowledgement_required boolean not null default false,
  persistent boolean not null default false,
  acknowledged_by jsonb not null default '[]'::jsonb,
  scheduled_for timestamptz,
  status text not null default 'sent' check (status in ('scheduled', 'sent')),
  dismissed_at timestamptz
);

create index if not exists display_broadcasts_status_idx on display_broadcasts(status);

-- ---------------------------------------------------------------------------
-- Row-Level Security
-- Public (anon) reads only. All writes go through Next.js API routes using
-- the service_role key, which bypasses RLS entirely — no write policies are
-- defined here on purpose.
-- ---------------------------------------------------------------------------
alter table sessions enable row level security;
alter table programs enable row level security;
alter table live_state enable row level security;
alter table activity_log enable row level security;
alter table display_state enable row level security;
alter table display_registry enable row level security;
alter table display_broadcasts enable row level security;

drop policy if exists "public read sessions" on sessions;
create policy "public read sessions" on sessions for select using (true);

drop policy if exists "public read programs" on programs;
create policy "public read programs" on programs for select using (true);

drop policy if exists "public read live_state" on live_state;
create policy "public read live_state" on live_state for select using (true);

drop policy if exists "public read activity_log" on activity_log;
create policy "public read activity_log" on activity_log for select using (true);

drop policy if exists "public read display_state" on display_state;
create policy "public read display_state" on display_state for select using (true);

drop policy if exists "public read display_registry" on display_registry;
create policy "public read display_registry" on display_registry for select using (true);

drop policy if exists "public read display_broadcasts" on display_broadcasts;
create policy "public read display_broadcasts" on display_broadcasts for select using (true);

-- ---------------------------------------------------------------------------
-- Realtime — enable change broadcasts for the tables clients subscribe to.
-- `ALTER PUBLICATION ... ADD TABLE` has no `IF NOT EXISTS` form and errors
-- ("already member of publication") on a re-run, unlike every other
-- statement in this file — wrapped in a loop that checks first so the
-- whole file stays genuinely idempotent.
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['sessions', 'programs', 'live_state', 'display_state', 'display_registry', 'display_broadcasts']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table %I', t);
    end if;
  end loop;
end $$;
