-- ============================================================================
-- 0012_fresh_install_multitenant_gap.sql
--
-- Fixes a real gap in the documented "fresh install" path (schema.sql's own
-- header: "run this file first, then everything in supabase/migrations/ in
-- order"), found while provisioning a brand-new project from scratch for a
-- dev-environment replica (2026-09-09).
--
-- events, partitions, auditoriums, and share_links are all created by
-- schema.sql WITHOUT an event_id/multi-tenant shape (schema.sql predates the
-- events model). 0001_multitenant.sql's own `create table if not exists
-- events (...)` / `partitions (...)` / `auditoriums (...)` / `share_links
-- (...)` blocks assume these tables DON'T exist yet and define the
-- multi-tenant shape (event_id, extra columns) inline — but since schema.sql
-- already created them first, every one of those CREATE TABLE IF NOT EXISTS
-- blocks is a silent no-op, and the event_id columns (plus events' event_date/
-- venue/timezone/form_config) never get added.
--
-- This never bit the real source project because its actual deployment
-- history didn't go through a clean "schema.sql then 0001" replay — schema.sql
-- was written/reconciled after the fact to describe what a fresh project
-- needs, using knowledge of a live schema that had already been migrated
-- through a messier, more organic path. It DOES bite a genuinely fresh
-- project provisioned by literally following schema.sql's own instructions.
--
-- Confirmed live: running schema.sql then 0001_multitenant.sql against an
-- empty project fails with "column event_id does not exist" the moment 0001
-- tries to add an index on partitions.event_id / auditoriums.event_id /
-- share_links.event_id, and a subsequent events insert fails with "column
-- event_date does not exist" for the same reason.
--
-- Safe to run any number of times (if not exists throughout); a no-op on a
-- project where 0001 was able to create these tables fresh (event_id/the
-- extra events columns already exist either way).
-- ============================================================================

begin;

alter table events add column if not exists event_date date;
alter table events add column if not exists venue text;
alter table events add column if not exists timezone text;
alter table events add column if not exists form_config jsonb;

alter table partitions add column if not exists event_id uuid references events(id) on delete cascade;
alter table partitions alter column event_id set not null;
create index if not exists partitions_event_id_idx on partitions(event_id);

alter table auditoriums add column if not exists event_id uuid references events(id) on delete cascade;
alter table auditoriums alter column event_id set not null;
create index if not exists auditoriums_event_id_idx on auditoriums(event_id);

alter table share_links add column if not exists event_id uuid references events(id) on delete cascade;
alter table share_links alter column event_id set not null;
create index if not exists share_links_event_id_idx on share_links(event_id);

commit;

-- ============================================================================
-- Post-migration verification:
--   select column_name from information_schema.columns
--   where table_name = 'events' and column_name in
--     ('event_date','venue','timezone','form_config');
--   -- expect: 4 rows
--
--   select table_name, column_name from information_schema.columns
--   where table_name in ('partitions','auditoriums','share_links')
--     and column_name = 'event_id';
--   -- expect: 3 rows, all not null (is_nullable = 'NO')
-- ============================================================================
