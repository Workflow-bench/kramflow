-- v1 beta security hardening (pre-launch review). Additive and reversible: it
-- only removes access that nothing in the app relies on.
--
-- 1. display_profiles was readable by EVERY caller, including anonymous ones
--    holding only the public anon key ("public read ... using (true)"), across
--    all tenants: name, layout zones, accent color, and custom_text. The app
--    never needed that. Every reader (the /screens page, the profile API
--    routes) uses the service-role client, which bypasses RLS, and no Realtime
--    channel subscribes to this table. Reads are now scoped to the event's
--    members like every other event table.
--
-- 2. handle_new_user (auth signup trigger) and rls_auto_enable (event trigger)
--    are SECURITY DEFINER trigger functions that were still callable over
--    PostgREST RPC by anon and signed-in users. Trigger functions are checked
--    for EXECUTE only when the trigger is created, so revoking changes nothing
--    for the triggers themselves.
--
-- 3. has_event_access is used only by policies that apply to `authenticated`;
--    anon has no reason to execute it. Explicit grants are re-issued so that
--    revoking PUBLIC cannot accidentally remove them.

begin;

drop policy if exists "public read display_profiles" on display_profiles;
drop policy if exists "event-scoped display_profiles" on display_profiles;
create policy "event-scoped display_profiles" on display_profiles
  for select to authenticated
  using (has_event_access(event_id));

revoke execute on function public.handle_new_user() from public, anon, authenticated;
-- rls_auto_enable() is created by the Supabase platform, not by these
-- migrations, so only revoke it where it exists.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end $$;

revoke execute on function public.has_event_access(uuid) from public, anon;
grant execute on function public.has_event_access(uuid) to authenticated, service_role;

commit;
