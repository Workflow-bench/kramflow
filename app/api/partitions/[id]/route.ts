import { NextResponse } from "next/server";
import { requireEventOwner } from "@/lib/server/require-event-owner";
import { supabaseAdmin } from "@/lib/supabase/server";

// Sets a section's start_time — the anchor item 6b's duration cascade
// (lib/schedule.ts's computeScheduledTimes) walks forward from for any
// item in the section with time_is_computed on.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const { eventId, start_time } = body;
  const auth = await requireEventOwner(typeof eventId === "string" ? eventId : null);
  if (auth instanceof NextResponse) return auth;

  if (start_time !== null && typeof start_time !== "string") {
    return NextResponse.json({ ok: false, error: "start_time must be a string or null" }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const { error } = await supabase.from("partitions").update({ start_time }).eq("id", id).eq("event_id", auth.eventId);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
