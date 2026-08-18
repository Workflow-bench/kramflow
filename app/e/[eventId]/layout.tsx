import { redirect } from "next/navigation";
import { supabaseServer, supabaseAdmin } from "@/lib/supabase/server";
import { AuthProvider } from "@/components/auth/auth-context";
import { EventProvider } from "@/lib/event-context";
import { DisplayEngineProvider } from "@/lib/display-engine/context";
import { CommandPalette } from "@/components/operator/command-palette";

// The gate for every per-event operator surface (console, cue sheet,
// remote, broadcast center, display manager). proxy.ts already redirected
// away anyone with no session at all — this is the real ownership check
// (defense in depth, same reasoning as lib/server/require-event-owner.ts
// for API routes): an authenticated operator who is NOT this event's
// owner gets redirected to their own dashboard, not a peek at someone
// else's event. Same 404-shaped-as-redirect approach as the display
// pages' LinkInvalid — never distinguishes "doesn't exist" from "not
// yours" to an operator probing another event's id.
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
  const { data: event } = await admin
    .from("events")
    .select("id")
    .eq("id", eventId)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!event) redirect("/dashboard");

  return (
    <AuthProvider>
      <EventProvider eventId={eventId}>
        <DisplayEngineProvider eventId={eventId}>
          {children}
          <CommandPalette />
        </DisplayEngineProvider>
      </EventProvider>
    </AuthProvider>
  );
}
