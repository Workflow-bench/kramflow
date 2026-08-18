import { NextResponse } from "next/server";
import { requireEventOwner } from "@/lib/server/require-event-owner";
import { supabaseAdmin } from "@/lib/supabase/server";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const { eventId, sheet_name, event_name, day_label, session_label, sort_order } = body;
  const auth = await requireEventOwner(typeof eventId === "string" ? eventId : null);
  if (auth instanceof NextResponse) return auth;

  const patch: Record<string, unknown> = {};
  if (typeof sheet_name === "string") patch.sheet_name = sheet_name;
  if (typeof event_name === "string") patch.event_name = event_name;
  if (typeof day_label === "string" && day_label) patch.day_label = day_label;
  if (typeof session_label === "string" && session_label) patch.session_label = session_label;
  if (typeof sort_order === "number") patch.sort_order = sort_order;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ ok: false, error: "No valid fields to update" }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const { error } = await supabase.from("sessions").update(patch).eq("event_id", auth.eventId).eq("id", id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const eventId = new URL(request.url).searchParams.get("eventId");
  const auth = await requireEventOwner(eventId);
  if (auth instanceof NextResponse) return auth;

  const supabase = supabaseAdmin();

  // live_state.active_session_id references sessions(event_id, id) with no
  // ON DELETE clause (RESTRICT) — deleting a session that's currently the
  // active one violates that FK and fails outright. Clearing it first,
  // unconditionally on a match, lets the delete below always succeed
  // regardless of which session is currently "live." (See the original
  // single-tenant version of this comment — same bug, same fix, now scoped
  // per event.)
  const { data: liveState, error: liveStateReadError } = await supabase
    .from("live_state")
    .select("active_session_id")
    .eq("event_id", auth.eventId)
    .single();
  if (liveStateReadError) {
    return NextResponse.json({ ok: false, error: liveStateReadError.message }, { status: 500 });
  }
  if (liveState?.active_session_id === id) {
    const { error: clearError } = await supabase
      .from("live_state")
      .update({ active_session_id: null })
      .eq("event_id", auth.eventId);
    if (clearError) return NextResponse.json({ ok: false, error: clearError.message }, { status: 500 });
  }

  // programs.session_id / partitions.session_id both cascade (see
  // supabase/schema.sql) — deleting the session removes every item and
  // partition in it too.
  const { error } = await supabase.from("sessions").delete().eq("event_id", auth.eventId).eq("id", id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
