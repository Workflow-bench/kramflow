import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/require-auth";
import { supabaseAdmin } from "@/lib/supabase/server";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;

  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const { sheet_name, event_name, day_label, session_label, sort_order } = body;
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
  const { error } = await supabase.from("sessions").update(patch).eq("id", id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;

  const { id } = await params;

  const supabase = supabaseAdmin();

  // live_state.active_session_id references sessions(id) with no ON DELETE
  // clause (defaults to NO ACTION/RESTRICT) — deleting a session that's
  // currently the active one violates that FK and fails outright. This
  // used to run the clear-active-session step *after* the delete attempt,
  // so it never got a chance to help: whichever session live_state pointed
  // at (often the last one left, since that's naturally what people delete
  // last) was permanently stuck, appearing as "can't delete the last
  // session" even though nothing was actually enforcing a minimum count.
  // Clearing it first, unconditionally on a match, lets the delete below
  // always succeed regardless of which session is currently "live."
  const { data: liveState, error: liveStateReadError } = await supabase
    .from("live_state")
    .select("active_session_id")
    .eq("id", 1)
    .single();
  if (liveStateReadError) {
    return NextResponse.json({ ok: false, error: liveStateReadError.message }, { status: 500 });
  }
  if (liveState?.active_session_id === id) {
    const { error: clearError } = await supabase.from("live_state").update({ active_session_id: null }).eq("id", 1);
    if (clearError) return NextResponse.json({ ok: false, error: clearError.message }, { status: 500 });
  }

  // programs.session_id has ON DELETE CASCADE (see supabase/schema.sql), so
  // deleting the session also removes every item in it (and, since the
  // partitions redesign, every partition — partitions.session_id also
  // cascades).
  const { error } = await supabase.from("sessions").delete().eq("id", id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
