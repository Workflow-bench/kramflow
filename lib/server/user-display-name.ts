import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveDisplayName } from "@/lib/shared/display-name";

export { resolveDisplayName };

// Server-side "resolve someone else's name from their user id" — used by
// activity_log.actor_name (app/api/live/route.ts, the collaborator-invite
// route) where only the id is on hand. Needs the admin API (auth.users
// isn't a table RLS can expose to a client query), hence "server-only".
export async function getUserDisplayName(admin: SupabaseClient, userId: string): Promise<string> {
  const { data } = await admin.auth.admin.getUserById(userId);
  return resolveDisplayName(data?.user ?? null);
}
