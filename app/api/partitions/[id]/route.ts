import { NextResponse } from "next/server";
import { requireEventAccess } from "@/lib/server/require-event-access";
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
  const auth = await requireEventAccess(typeof eventId === "string" ? eventId : null, "editor");
  if (auth instanceof NextResponse) return auth;

  if (start_time !== null && typeof start_time !== "string") {
    return NextResponse.json({ ok: false, error: "start_time must be a string or null" }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("partitions")
    .update({ start_time })
    .eq("id", id)
    .eq("event_id", auth.eventId)
    .select("id");
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  // .eq(id).eq(event_id) matching zero rows (stale id, a race with a
  // concurrent delete) isn't itself a Supabase error — without checking
  // this, the caller can't tell "saved" from "silently did nothing."
  if (!data || data.length === 0) {
    return NextResponse.json({ ok: false, error: "Partition not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
