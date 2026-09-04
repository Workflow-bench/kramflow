import "server-only";
import { NextResponse } from "next/server";
import { supabaseServer, supabaseAdmin } from "@/lib/supabase/server";

// Minimum-viable role-based permissions — the sole authorization check
// for every event-scoped route (an earlier, owner-only require-event-
// owner.ts was superseded by this and removed as dead code). Three tiers,
// ordered low to high: "viewer" (read-only), "editor" (can also edit cue-sheet
// content), "owner" (can also control the live show, manage event
// settings, and manage the collaborator roster itself). The owner is
// events.owner_id and is never a row in event_collaborators — a
// collaborator row only ever grants "editor" or "viewer".
export type EventRole = "viewer" | "editor" | "owner";

const ROLE_RANK: Record<EventRole, number> = { viewer: 0, editor: 1, owner: 2 };

export async function requireEventAccess(
  eventId: string | null | undefined,
  minRole: EventRole
): Promise<NextResponse | { userId: string; eventId: string; role: EventRole }> {
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
  // 404, not 403, whether the event doesn't exist or this user has no
  // access to it at all — matches this app's existing "not found" and
  // "not yours" are indistinguishable convention, so an ID-guessing
  // attempt can't learn which event IDs are real.
  if (error || !event) {
    return NextResponse.json({ ok: false, error: "Event not found" }, { status: 404 });
  }

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
    if (!collab) {
      return NextResponse.json({ ok: false, error: "Event not found" }, { status: 404 });
    }
    role = collab.role as EventRole;
  }

  if (ROLE_RANK[role] < ROLE_RANK[minRole]) {
    return NextResponse.json(
      { ok: false, error: `This requires ${minRole} access. You have ${role} access to this event.` },
      { status: 403 }
    );
  }

  return { userId: user.id, eventId, role };
}
