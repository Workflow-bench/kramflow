import { NextResponse } from "next/server";
import { requireEventOwner } from "@/lib/server/require-event-owner";
import { supabaseAdmin } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const eventId = new URL(request.url).searchParams.get("eventId");
  const auth = await requireEventOwner(eventId);
  if (auth instanceof NextResponse) return auth;

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("auditoriums")
    .select("*")
    .eq("event_id", auth.eventId)
    .order("name", { ascending: true });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, auditoriums: data });
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const { eventId, name } = body;
  const auth = await requireEventOwner(typeof eventId === "string" ? eventId : null);
  if (auth instanceof NextResponse) return auth;

  if (typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ ok: false, error: "name is required" }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("auditoriums")
    .insert({ name: name.trim(), event_id: auth.eventId })
    .select()
    .single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, auditorium: data });
}
