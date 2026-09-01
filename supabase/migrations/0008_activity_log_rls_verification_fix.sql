-- ============================================================================
-- Kramflow — activity_log RLS verification fix
--
-- The pilot-readiness v2 migration (0007) intended activity_log to end up
-- with exactly one SELECT policy: "event members read activity_log",
-- gated on public.is_event_member() (owner or *accepted* collaborator).
-- v2's own verification query expects exactly that.
--
-- What actually happened: 0007 only dropped "public read activity_log"
-- (using (true)) — the wide-open policy it knew about. It didn't know
-- about "event-scoped activity_log" (from 0001_multitenant.sql), which
-- also applies to activity_log via has_event_access() — owner or *any*
-- event_collaborators row, with no status check. Permissive RLS policies
-- OR together, so that older policy silently keeps letting in any
-- collaborator regardless of status, defeating the status check v2 added.
-- has_event_access() itself is untouched and stays in place for every
-- other table that uses it (sessions, programs, live_state, ...) — this
-- only removes its policy on activity_log specifically, where v2 already
-- established is_event_member() as the intended, more precise check.
--
-- Separately, v2's `revoke all ... from public` on is_event_member() left
-- anon with a direct EXECUTE grant — Supabase's default privileges grant
-- EXECUTE on new public-schema functions to anon/authenticated/
-- service_role at creation time, independent of the public pseudo-role.
-- Functionally inert (the function only returns a boolean and always
-- evaluates false for anon, which has no auth.uid()), but the runbook's
-- verification explicitly expects anon to not appear — revoking it here
-- to match.
--
-- Safe to run once; both statements are idempotent.
-- ============================================================================

begin;

drop policy if exists "event-scoped activity_log" on activity_log;

revoke execute on function public.is_event_member(uuid) from anon;

commit;
