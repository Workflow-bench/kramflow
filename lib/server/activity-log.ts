import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getUserDisplayName } from "@/lib/server/user-display-name";

// Shared append for activity_log — previously duplicated only inside
// app/api/live/route.ts. Every event-scoped mutation route now uses this
// (cue-sheet CRUD/reorder/bulk-edit, collaborator invite/revoke, display
// registry rename/reassign/command) so "what happened to this event" is a
// complete record, not just show-control actions. Failures are logged, not
// thrown — the activity trail is a record of what happened, not a gate on
// whether the primary write (which already succeeded by the time this is
// called) is allowed to succeed.
export async function logActivity(
  supabase: SupabaseClient,
  eventId: string,
  action: string,
  detail: string,
  actor: { userId: string; name: string }
): Promise<void> {
  const { error } = await supabase
    .from("activity_log")
    .insert({ event_id: eventId, action, detail, actor_user_id: actor.userId, actor_name: actor.name });
  // `action` originates from request-driven call sites (route handlers
  // pass through values derived from the request) — interpolating it into
  // the template string itself, as this used to, meant Node's
  // console.error would parse the *result* for %s/%d/%o-style format
  // specifiers if `action` ever happened to contain one, substituting
  // `error` into an unintended position instead of appending it (CodeQL
  // js/log-injection). Keeping the format string a constant literal and
  // passing `action` as a plain %s argument means its content is only
  // ever substituted as a value, never re-parsed as format syntax.
  if (error) console.error("[activity-log] insert failed (%s):", action, error);
}

// Most call sites only have a userId (from requireEventAccess), not the
// actor's display name — resolves it first rather than pushing every call
// site to do its own getUserDisplayName() call.
export async function logActivityAs(
  supabase: SupabaseClient,
  eventId: string,
  userId: string,
  action: string,
  detail: string
): Promise<void> {
  const name = await getUserDisplayName(supabase, userId);
  await logActivity(supabase, eventId, action, detail, { userId, name });
}
