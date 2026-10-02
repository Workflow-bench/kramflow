import { NextResponse } from "next/server";
import { requireEventAccess } from "@/lib/server/require-event-access";
import { supabaseAdmin } from "@/lib/supabase/server";

// Creates a section inside a session. Sections used to exist only as a side
// effect of the Excel import, so a cue sheet built by hand had nowhere to put
// a start time and its items never got scheduled times. The New/Edit Session
// form now calls this when an operator gives a session a start time.
export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const { eventId, sessionId, label, start_time } = body;
  const auth = await requireEventAccess(typeof eventId === "string" ? eventId : null, "editor");
  if (auth instanceof NextResponse) return auth;

  if (typeof sessionId !== "string" || !sessionId) {
    return NextResponse.json({ ok: false, error: "sessionId is required" }, { status: 400 });
  }
  if (typeof label !== "string" || !label.trim()) {
    return NextResponse.json({ ok: false, error: "label is required" }, { status: 400 });
  }
  if (start_time != null && typeof start_time !== "string") {
    return NextResponse.json({ ok: false, error: "start_time must be a string or null" }, { status: 400 });
  }

  const supabase = supabaseAdmin();

  // The session must belong to this event; otherwise an editor of one event
  // could attach a section to another event's session.
  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select("id")
    .eq("id", sessionId)
    .eq("event_id", auth.eventId)
    .maybeSingle();
  if (sessionError) {
    console.error(sessionError);
    return NextResponse.json({ ok: false, error: "Something went wrong. Try again." }, { status: 500 });
  }
  if (!session) {
    return NextResponse.json({ ok: false, error: "Session not found" }, { status: 404 });
  }

  const { data: last } = await supabase
    .from("partitions")
    .select("sort_order")
    .eq("session_id", sessionId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await supabase
    .from("partitions")
    .insert({
      session_id: sessionId,
      event_id: auth.eventId,
      label: label.trim(),
      sort_order: (last?.sort_order ?? -1) + 1,
      start_time: typeof start_time === "string" && start_time.trim() ? start_time.trim() : null,
    })
    .select("id")
    .single();
  if (error || !data) {
    console.error(error);
    return NextResponse.json({ ok: false, error: "Something went wrong. Try again." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, id: data.id });
}
