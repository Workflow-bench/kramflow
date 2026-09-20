-- ============================================================================
-- 0010_collaborator_invite_columns.sql
--
-- P1 blocker fix — event_collaborators is missing invited_by,
-- invite_expires_at, and accepted_at on the live database. Verified
-- against the CURRENT repository during the 2026-09 blocker-remediation
-- pass, not assumed from an earlier summary:
--
--   - supabase/schema.sql's event_collaborators CREATE TABLE already
--     defines all three columns (its own comment says they were "added
--     alongside this comment" — i.e. schema.sql was updated but no
--     migration ever shipped the change to a live database built via the
--     migrations/ sequence, not a from-scratch schema.sql run).
--   - Migration 0006 (collaborator_invite_status) added id/status/
--     invite_token to event_collaborators. It did NOT add these three.
--   - Migrations 0007 and 0008 touch event_collaborators only through
--     is_event_member()/has_event_access(), never ALTER it.
--   - The application code genuinely requires all three — confirmed via
--     direct grep, not inferred:
--       - app/api/events/[eventId]/collaborators/route.ts SELECTs
--         invite_expires_at (GET), and WRITEs invited_by + invite_expires_at
--         when creating a pending invite (POST) and accepted_at when an
--         invite matches an existing account immediately.
--       - app/api/invites/[token]/accept/route.ts WRITEs accepted_at when
--         a pending invite is accepted.
--       - lib/server/collaborator-invites.ts actively READS
--         invite_expires_at to enforce invite expiry — not decorative,
--         a real functional dependency.
--   - This is exactly the error already observed live: "column
--     event_collaborators.invite_expires_at does not exist" — confirmed
--     reproducible against the current live project during this session.
--
-- Minimal and additive: three nullable columns, no data rewrite, no
-- backfill. accepted_at is deliberately NOT backfilled for existing
-- 'accepted' rows (e.g. to created_at) — the GET route doesn't even
-- return accepted_at to the client today, so nothing reads it for
-- pre-existing rows, and inventing a value for it would be exactly the
-- fabricated historical metadata the remediation brief said not to
-- create without a justified reason. NULL is the honest, correct value
-- for "this row predates the feature that populates this column."
-- invited_by is similarly left NULL for existing rows — genuinely
-- unknown, not owner_id by default (that would misattribute who actually
-- sent the invite for collaborators added by an editor, if that's ever
-- allowed in the future, and is factually wrong for the common case of
-- an owner adding their own team).
--
-- Preflight (run before applying):
--   select count(*) from event_collaborators;
--   select column_name from information_schema.columns
--     where table_name = 'event_collaborators'
--     and column_name in ('invited_by', 'invite_expires_at', 'accepted_at');
--   -- expect: zero rows from the second query (confirms the columns are
--   -- genuinely absent before this runs, not a stale assumption)
--
-- Safe to run once; every ADD COLUMN is guarded (if not exists), so a
-- re-run after a partial failure is a no-op, not an error. No table lock
-- beyond the brief one Postgres takes for any ALTER TABLE ADD COLUMN
-- (fast — these are nullable with no default requiring a rewrite).
-- ============================================================================

begin;

alter table event_collaborators
  add column if not exists invited_by uuid references auth.users(id) on delete set null,
  add column if not exists invite_expires_at timestamptz,
  add column if not exists accepted_at timestamptz;

comment on column event_collaborators.invited_by is
  'Who sent this invite — the owner (or, in the future, an editor if that''s ever permitted) at the time the row was created. NULL for rows created before this column existed; genuinely unknown, not backfilled.';

comment on column event_collaborators.invite_expires_at is
  'When a pending invite stops being acceptable — enforced by lib/server/collaborator-invites.ts. NULL for already-accepted rows and any row that predates this column.';

comment on column event_collaborators.accepted_at is
  'When a pending invite was accepted, or when an immediate-match invite was created already-accepted. NULL for rows created before this column existed — not backfilled to created_at, since nothing in the app reads this column for pre-existing rows today.';

commit;

-- ============================================================================
-- Post-migration verification — see docs/BLOCKER_REMEDIATION_RUNBOOK.md for
-- the full sequence including a safe, reversible throwaway-invite test.
-- Summary:
--   1. select column_name, data_type, is_nullable from information_schema.columns
--      where table_name = 'event_collaborators'
--      and column_name in ('invited_by', 'invite_expires_at', 'accepted_at')
--      order by column_name;
--      expect: 3 rows, all is_nullable = 'YES'.
--   2. select count(*) from event_collaborators;
--      expect: identical to the preflight count — no rows added, removed,
--      or (for existing columns) modified.
--   3. GET /api/events/{eventId}/collaborators as the event owner in the
--      app — expect a real collaborator list (or a real empty list) instead
--      of "Couldn't load collaborators" / the invite_expires_at error.
-- ============================================================================
