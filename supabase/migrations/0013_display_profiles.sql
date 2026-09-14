-- ============================================================================
-- 0013_display_profiles.sql
--
-- Real backing store for "Display Profiles" — the customizable
-- font-scale/layout/widget-visibility/color-override concept that
-- app/e/[eventId]/displays/page.tsx's own comment documents as having been
-- REMOVED from that UI because profile content only ever lived in the
-- editing browser's localStorage, never reached app/api/display-view/
-- route.ts's payload, and none of the four real display clients read a
-- profile field at all — "assigning one here would look like it configures
-- a display's real output and would silently do nothing." That comment
-- explicitly says display_registry.profile_id (the assignment reference)
-- was kept "intact for whenever the read path is actually built." This is
-- that: a real, event-scoped table a profile's content actually lives in,
-- so profile_id stops pointing at nothing.
--
-- Backs the new "custom" display type (lib/display-engine/types.ts's
-- DisplayType already reserves the value; DISPLAY_TYPE_META and every
-- picker across the app previously excluded it because there was nothing
-- real to point it at). A profile fully describes one custom display's
-- content: which zone template, which widget in each zone, a viewing-
-- distance scale, and an optional accent color / static text block.
--
-- Same ownership/access model as every other event-scoped config table
-- (partitions, auditoriums): public `select using (true)` here, because
-- writes never go through RLS at all in this codebase — every mutating
-- route uses supabaseAdmin() (service role) with requireEventAccess()
-- doing the real authorization server-side (see
-- app/api/display-engine/registry/[id]/route.ts for the established
-- pattern this follows). The public display route
-- (app/api/display-view/route.ts) already reads with the service-role
-- client too, so RLS on this table is a read convenience for an
-- authenticated operator's own dashboard/editor UI, not the actual
-- security boundary.
-- ============================================================================

begin;

create table if not exists display_profiles (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  name text not null,
  -- Zone *templates*, not free-form drag-and-drop layout — see
  -- docs/CUSTOM-DISPLAY-REQUIREMENTS.md section 2.2 for why: a small,
  -- known set of arrangements gets most of the value (any screen shape a
  -- real TV/tablet/phone actually has) without collision detection or
  -- per-viewport reflow logic none of the four existing fixed displays
  -- needed either.
  template text not null check (template in ('hero-sidebar', 'grid-3up', 'full-bleed')),
  -- { [zoneId]: widgetType | null } — e.g. {"hero":"now-playing","sidebar-top":"up-next"}.
  -- Validated against the real zone ids for `template` and the real
  -- WidgetType union in application code (lib/display-engine/types.ts),
  -- not with a jsonb schema constraint here — the same trust boundary
  -- every other jsonb config column in this schema already uses (see
  -- live_state.progress_by_session, display_state.hold/timer).
  zones jsonb not null default '{}'::jsonb,
  viewing_distance text not null default 'far' check (viewing_distance in ('close', 'far')),
  accent_color text,
  custom_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists display_profiles_event_id_idx on display_profiles(event_id);

alter table display_profiles enable row level security;

drop policy if exists "public read display_profiles" on display_profiles;
create policy "public read display_profiles" on display_profiles for select using (true);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'display_profiles'
  ) then
    execute 'alter publication supabase_realtime add table display_profiles';
  end if;
end $$;

commit;
