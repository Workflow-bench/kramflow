import { NextResponse } from "next/server";
import { requireEventAccess } from "@/lib/server/require-event-access";
import { supabaseAdmin } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const eventId = new URL(request.url).searchParams.get("eventId");
  const auth = await requireEventAccess(eventId, "viewer");
  if (auth instanceof NextResponse) return auth;

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("sessions")
    .select("*")
    .eq("event_id", auth.eventId)
    .order("sort_order", { ascending: true });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, sessions: data });
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const { eventId, id, sheet_name, event_name, day_label, session_label, sort_order } = body;
  const auth = await requireEventAccess(typeof eventId === "string" ? eventId : null, "editor");
  if (auth instanceof NextResponse) return auth;

  if (typeof id !== "string" || !id || typeof day_label !== "string" || typeof session_label !== "string") {
    return NextResponse.json({ ok: false, error: "id, day_label, and session_label are required" }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const { error } = await supabase.from("sessions").insert({
    id,
    event_id: auth.eventId,
    sheet_name: typeof sheet_name === "string" ? sheet_name : day_label,
    event_name: typeof event_name === "string" ? event_name : "",
    day_label,
    session_label,
    sort_order: typeof sort_order === "number" ? sort_order : 0,
  });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
