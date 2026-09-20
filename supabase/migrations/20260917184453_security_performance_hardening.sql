-- Safe, non-destructive fixes for findings from the Supabase security/
-- performance advisors (get_advisors) — no schema semantics change, no
-- data touched. Idempotent where the underlying DDL supports it.

-- ---------------------------------------------------------------------------
-- 1. Function search_path hardening (function_search_path_mutable)
-- A function without a pinned search_path resolves unqualified identifiers
-- against whatever search_path the calling session has, which is what lets
-- a search_path-hijacking attack redirect it to attacker-controlled objects.
-- ALTER FUNCTION ... SET search_path pins it without touching the function
-- body — same fix already applied to has_event_access/is_event_member/
-- handle_new_user/rls_auto_enable when they were written; these eight
-- predate that convention.
-- ---------------------------------------------------------------------------
alter function public.swap_program_order(uuid, uuid) set search_path = public;
alter function public.bulk_update_programs(uuid[], text, text) set search_path = public;
alter function public.replace_session_programs(text[], jsonb, jsonb) set search_path = public;
alter function public.replace_session_programs(uuid, text[], jsonb, jsonb) set search_path = public;
alter function public.bulk_move_programs_to_partition(uuid[], uuid) set search_path = public;
alter function public.move_program(uuid, uuid, uuid) set search_path = public;
alter function public.acknowledge_broadcast(uuid, text) set search_path = public;
alter function public.delete_program(uuid, uuid) set search_path = public;
alter function public.insert_program_into_partition(
  uuid, text, uuid, text, text, text, text, text, text, text, integer, text, text,
  boolean, boolean, text, boolean, boolean, text, text, text, text, text, text, text,
  text, uuid, boolean
) set search_path = public;

-- ---------------------------------------------------------------------------
-- 2. RLS initplan optimization (auth_rls_initplan)
-- auth.uid() called directly in a policy's USING clause gets re-evaluated
-- per row; wrapping it as (select auth.uid()) lets Postgres evaluate it
-- once per query instead. Same access control, faster at scale. Does not
-- touch has_event_access()'s own internal auth.uid() call — that one runs
-- inside a SECURITY DEFINER function body, not a policy qual, so the
-- linter doesn't flag it and this doesn't need to either.
-- ---------------------------------------------------------------------------
alter policy "own or collaborated events" on events
  using ((owner_id = (select auth.uid())) or has_event_access(id));

alter policy "collaborators visible to self and owner" on event_collaborators
  using ((user_id = (select auth.uid())) or has_event_access(event_id));

alter policy "own profile" on profiles
  using (id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- 3. Duplicate index cleanup (duplicate_index)
-- event_collaborators ended up with two functionally-identical unique
-- indexes on both `id` and `invite_token` (byproduct of migrations having
-- been applied by hand more than once during the project's Supabase
-- migration — see docs/DEPLOYMENT.md). The *_key indexes back real named
-- unique constraints (event_collaborators_id_key, ..._invite_token_key);
-- the *_idx ones are redundant plain indexes, safe to drop.
-- ---------------------------------------------------------------------------
drop index if exists event_collaborators_id_idx;
drop index if exists event_collaborators_invite_token_idx;

-- ---------------------------------------------------------------------------
-- 4. Missing primary key (no_primary_key)
-- event_collaborators.id has always been unique + not null
-- (event_collaborators_id_key) but was never declared PRIMARY KEY. Postgres
-- refuses to reuse that existing unique index for the new PK constraint
-- (an index can only ever back one constraint), so the old constraint is
-- dropped first and PRIMARY KEY builds its own backing index — table is
-- small (pilot scale), so the brief rebuild is not a concern.
-- ---------------------------------------------------------------------------
alter table event_collaborators drop constraint event_collaborators_id_key;
alter table event_collaborators add primary key (id);

-- ---------------------------------------------------------------------------
-- 5. Unindexed foreign keys (unindexed_foreign_keys)
-- Every FK column Postgres flagged as lacking a covering index — improves
-- join/filter performance (e.g. "who invited this collaborator",
-- "collaborator rows for this user") and FK-triggered lock scans on the
-- referenced table. Tables here are small (pilot-scale), so a plain
-- CREATE INDEX's brief lock is not a concern.
-- ---------------------------------------------------------------------------
create index if not exists activity_log_actor_user_id_idx on activity_log (actor_user_id);
create index if not exists event_collaborators_invited_by_idx on event_collaborators (invited_by);
create index if not exists event_collaborators_user_id_idx on event_collaborators (user_id);
create index if not exists integration_credentials_created_by_idx on integration_credentials (created_by);
create index if not exists live_state_active_session_id_idx on live_state (active_session_id);
create index if not exists programs_auditorium_id_idx on programs (auditorium_id);
create index if not exists share_links_created_by_idx on share_links (created_by);
