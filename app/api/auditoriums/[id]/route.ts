import { NextResponse } from "next/server";
import { requireEventAccess } from "@/lib/server/require-event-access";
import { supabaseAdmin } from "@/lib/supabase/server";

// Rename or remove an auditorium. Auditoriums could only be created before;
// a typo or a retired room stayed in the Add Item picker forever.
//
// Deleting is safe for existing items: programs.auditorium_id is declared
// `on delete set null`, so items that used the room simply lose the link.

async function parseBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await parseBody(request);
  if (!body) return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });

  const { eventId, name } = body;
  const auth = await requireEventAccess(typeof eventId === "string" ? eventId : null, "editor");
  if (auth instanceof NextResponse) return auth;

  if (typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ ok: false, error: "name is required" }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("auditoriums")
    .update({ name: name.trim() })
    .eq("id", id)
    .eq("event_id", auth.eventId)
    .select("id");
  if (error) {
    console.error(error);
    return NextResponse.json({ ok: false, error: "Something went wrong. Try again." }, { status: 500 });
  }
  if (!data || data.length === 0) {
    return NextResponse.json({ ok: false, error: "Auditorium not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const eventId = new URL(request.url).searchParams.get("eventId");
  const auth = await requireEventAccess(eventId, "editor");
  if (auth instanceof NextResponse) return auth;

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("auditoriums")
    .delete()
    .eq("id", id)
    .eq("event_id", auth.eventId)
    .select("id");
  if (error) {
    console.error(error);
    return NextResponse.json({ ok: false, error: "Something went wrong. Try again." }, { status: 500 });
  }
  if (!data || data.length === 0) {
    return NextResponse.json({ ok: false, error: "Auditorium not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
