-- Fixes a real, previously-undiscovered gap found while manually verifying
-- the jumpTo bounds-check fix against the live dev database: live_state
-- was missing version/controller_id/controller_claimed_at, and
-- display_state was missing timer_version — every write through
-- app/api/live/route.ts (Start/Next/Previous/Hold/Finish/jumpTo/alerts/
-- notes — the entire live-show control surface) and
-- app/api/display-engine/timer/route.ts's optimistic-concurrency checks
-- was failing outright with "Could not find the 'version' column ...".
--
-- schema.sql already carries idempotent `alter table ... add column if
-- not exists` statements for exactly these columns (added after this
-- project's initial setup) — but docs/DEPLOYMENT.md documents running
-- schema.sql only ONCE per project, never re-running it, so an
-- already-provisioned project never picks up a column added to schema.sql
-- after its initial run. This migration is that catch-up step, made
-- explicit and versioned instead of relying on someone remembering to
-- re-run schema.sql by hand. Safe to run against a project that already
-- has these columns (from a fresh schema.sql run) — everything here is
-- `if not exists`.

begin;

alter table live_state add column if not exists version integer not null default 0;
alter table live_state add column if not exists controller_id text;
alter table live_state add column if not exists controller_claimed_at timestamptz;

alter table display_state add column if not exists timer_version integer not null default 0;

-- Also covers programs' equivalents in case a project is on an even older
-- schema.sql snapshot than this dev project was — confirmed already
-- present here, included for completeness at zero cost (if not exists).
alter table programs add column if not exists version integer not null default 0;
alter table programs add column if not exists partition_id uuid references partitions(id) on delete set null;
alter table programs add column if not exists time_is_computed boolean not null default false;
alter table programs add column if not exists auditorium_id uuid references auditoriums(id) on delete set null;

commit;
