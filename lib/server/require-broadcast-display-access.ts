import "server-only";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { verifyDisplayAccess, verifySessionAccess, type DisplayAccessResult } from "@/lib/server/verify-display-access";
import type { EventRole } from "@/lib/server/require-event-access";

// Shared by the broadcast routes: resolve the broadcast's own event, then
// require that the caller's access maps to that same event. Token-or-session
// callers use requireBroadcastDisplayAccess (acknowledge, promote: a display
// acting for its own event). requireBroadcastSessionAccess is for changes to
// what everyone sees, which a read-only Share Display token must never do.
async function requireBroadcastAccess(
  broadcastId: string,
  verify: () => Promise<DisplayAccessResult>
): Promise<NextResponse | { eventId: string }> {
  const admin = supabaseAdmin();
  const { data: broadcast, error } = await admin
    .from("display_broadcasts")
    .select("event_id")
    .eq("id", broadcastId)
    .maybeSingle();

  if (error) {
    console.error(error);
    return NextResponse.json({ ok: false, error: "Something went wrong. Try again." }, { status: 500 });
  }
  if (!broadcast) {
    return NextResponse.json({ ok: false, error: "Broadcast not found" }, { status: 404 });
  }

  const access = await verify();
  if (!access.ok || access.eventId !== broadcast.event_id) {
    return NextResponse.json({ ok: false, error: "Broadcast not found" }, { status: 404 });
  }

  return { eventId: broadcast.event_id as string };
}

export function requireBroadcastDisplayAccess(
  broadcastId: string,
  token: string | undefined,
  requestedEventId: string | undefined
): Promise<NextResponse | { eventId: string }> {
  return requireBroadcastAccess(broadcastId, () => verifyDisplayAccess(token, requestedEventId));
}

// Audit remediation KF-001 / R1 (Codex Phase 1 review): dismiss "removes
// the message from active everywhere (not just on one screen)" (see its
// own route comment) — shared operational state, the same class as
// hold/timer, not a local per-viewer acknowledgement (that's
// requireBroadcastDisplayAccess/acknowledge, scoped to one displayId and
// correctly left token-allowed below). minRole defaults to "viewer" so
// nothing else calling this changes; dismiss passes "owner" explicitly,
// symmetric with sending a broadcast already requiring owner.
export function requireBroadcastSessionAccess(
  broadcastId: string,
  requestedEventId: string | undefined,
  minRole: EventRole = "viewer"
): Promise<NextResponse | { eventId: string }> {
  return requireBroadcastAccess(broadcastId, () => verifySessionAccess(requestedEventId, minRole));
}
