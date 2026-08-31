import { redirect } from "next/navigation";
import { supabaseServer, supabaseAdmin } from "@/lib/supabase/server";
import { AuthProvider } from "@/components/auth/auth-context";
import { EventProvider, EventRoleProvider, type EventRole } from "@/lib/event-context";
import { DisplayEngineProvider } from "@/lib/display-engine/context";
import { CommandPalette } from "@/components/operator/command-palette";

// The gate for every per-event operator surface (console, cue sheet,
// remote, broadcast center, display manager). proxy.ts already redirected
// away anyone with no session at all — this is the real access check
// (defense in depth, same reasoning as lib/server/require-event-access.ts
// for API routes): an authenticated operator with no access to this event
// at all — not the owner, not a collaborator — gets redirected to their
// own dashboard, not a peek at someone else's event. Same 404-shaped-as-
// redirect approach as the display pages' LinkInvalid — never
// distinguishes "doesn't exist" from "not yours" to an operator probing
// another event's id.
//
// Report finding #26 — this used to be an owner-only check (`eq("owner_id",
// user.id)`), which meant a collaborator (editor/viewer role, see
// event_collaborators) would be bounced to /dashboard before ever reaching
// any page under /e/[eventId]/..., regardless of what require-event-
// access.ts's API-level checks would have allowed them to do once there.
export default async function EventLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;

  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = supabaseAdmin();
  const { data: event, error: eventError } = await admin.from("events").select("id, owner_id").eq("id", eventId).maybeSingle();
  // Still redirects to the same place either way — this layout has no
  // distinct error page to render, and the redirect itself must not leak
  // whether an id is real (see this file's own "not yours" reasoning
  // above) — but a genuine query failure (RLS misconfig, transient
  // outage) is now at least visible in server logs instead of looking
  // identical to a bad link with zero trace of what happened.
  if (eventError) console.error("[event layout] events lookup failed:", eventError.message);
  if (!event) redirect("/dashboard");

  let role: EventRole;
  if (event.owner_id === user.id) {
    role = "owner";
  } else {
    const { data: collab } = await admin
      .from("event_collaborators")
      .select("role")
      .eq("event_id", eventId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!collab) redirect("/dashboard");
    role = collab.role as EventRole;
  }

  return (
    <AuthProvider>
      <EventProvider eventId={eventId}>
        <EventRoleProvider role={role}>
          <DisplayEngineProvider eventId={eventId}>
            {children}
            <CommandPalette />
          </DisplayEngineProvider>
        </EventRoleProvider>
      </EventProvider>
    </AuthProvider>
  );
}
