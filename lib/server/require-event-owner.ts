import "server-only";
import { NextResponse } from "next/server";
import { supabaseServer, supabaseAdmin } from "@/lib/supabase/server";

// The per-event authorization check every data route now calls before
// touching sessions/programs/partitions/live_state/etc. requireAuth()
// only confirms *a* session exists; this confirms *this* session owns
// *this* event_id — explicit application-layer defense in depth on top of
// (not instead of) the "owner select" RLS policies (supabase/schema.sql).
// Returns a 400/401/403/404 NextResponse to short-circuit the route on
// failure, or { userId, eventId } when authorized.
export async function requireEventOwner(
  eventId: string | null | undefined
): Promise<NextResponse | { userId: string; eventId: string }> {
  if (!eventId) {
    return NextResponse.json({ ok: false, error: "Missing event_id" }, { status: 400 });
  }

  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const admin = supabaseAdmin();
  const { data: event, error } = await admin.from("events").select("id, owner_id").eq("id", eventId).maybeSingle();
  if (error || !event) {
    // 404, not 403, when the event doesn't exist at all — matches how
    // "not found" and "not yours" are made indistinguishable everywhere
    // else in this app's API surface, so an ID-guessing attempt can't
    // learn anything about which event IDs are real.
    return NextResponse.json({ ok: false, error: "Event not found" }, { status: 404 });
  }
  if (event.owner_id !== user.id) {
    return NextResponse.json({ ok: false, error: "Event not found" }, { status: 404 });
  }

  return { userId: user.id, eventId };
}
