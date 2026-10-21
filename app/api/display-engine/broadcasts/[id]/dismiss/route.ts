import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { requireBroadcastSessionAccess } from "@/lib/server/require-broadcast-display-access";

// POST dismiss. Owner only, session only. This removes the message from
// "active" everywhere (not just on one screen), which is a change to what
// every display shows, so a read-only Share Display token must not do it
// — and, per Codex's Phase 1 review (KF-001/R1), the same reasoning that
// requires owner for hold/timer/speaker-ready applies here: this is
// shared show-operation state, not a local per-viewer acknowledgement
// (that's acknowledge/route.ts, correctly still token-allowed, scoped to
// one displayId). Symmetric with sending a broadcast already requiring
// owner (app/api/display-engine/broadcasts/route.ts). The public display
// overlay's own Dismiss button is only ever shown to a non-token
// (authenticated) session — a viewer/editor previewing a display now gets
// a real 403-equivalent "Broadcast not found" (this route's existing
// anti-enumeration convention) on click rather than silently succeeding;
// it stays visible to them rather than being hidden, since this component
// has no reliable role context to hide it correctly by (see
// components/display-engine/broadcast-overlay.tsx's own comment). Stays
// in history (dismissed_at is informational, not a delete).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const access = await requireBroadcastSessionAccess(id, typeof body.eventId === "string" ? body.eventId : undefined, "owner");
  if (access instanceof NextResponse) return access;

  const supabase = supabaseAdmin();
  const { error } = await supabase
    .from("display_broadcasts")
    .update({ dismissed_at: new Date().toISOString() })
    .eq("id", id)
    .eq("event_id", access.eventId);
  if (error) {
    console.error(error);
    return NextResponse.json({ ok: false, error: "Something went wrong. Try again." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
