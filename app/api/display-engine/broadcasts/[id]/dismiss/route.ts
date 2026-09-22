import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { requireBroadcastSessionAccess } from "@/lib/server/require-broadcast-display-access";

// POST dismiss. Session only: this removes the message from "active"
// everywhere (not just on one screen), which is a change to what every
// display shows, so a read-only Share Display token must not do it. The
// public display overlay therefore no longer offers Dismiss. It stays in
// history (dismissed_at is informational, not a delete).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const access = await requireBroadcastSessionAccess(id, typeof body.eventId === "string" ? body.eventId : undefined);
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
