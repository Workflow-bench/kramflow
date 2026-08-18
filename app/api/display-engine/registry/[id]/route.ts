import { NextResponse } from "next/server";
import { requireEventOwner } from "@/lib/server/require-event-owner";
import { supabaseAdmin } from "@/lib/supabase/server";

// requireEventOwner-gated — only Display Manager (an authenticated
// operator managing their own event) renames/reassigns/commands/removes a
// display. Registering and heartbeating (POST ../route.ts) stay public
// since public display pages do that themselves.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const auth = await requireEventOwner(typeof body.eventId === "string" ? body.eventId : null);
  if (auth instanceof NextResponse) return auth;

  const patch: Record<string, unknown> = {};
  if (typeof body.name === "string") patch.name = body.name;
  if (typeof body.type === "string") patch.type = body.type;
  if (body.room !== undefined) patch.room = body.room;
  if (body.profileId !== undefined) patch.profile_id = body.profileId;
  if (body.pendingCommand !== undefined) patch.pending_command = body.pendingCommand;

  const supabase = supabaseAdmin();
  const { error } = await supabase.from("display_registry").update(patch).eq("id", id).eq("event_id", auth.eventId);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const eventId = new URL(request.url).searchParams.get("eventId");
  const auth = await requireEventOwner(eventId);
  if (auth instanceof NextResponse) return auth;

  const supabase = supabaseAdmin();
  const { error } = await supabase.from("display_registry").delete().eq("id", id).eq("event_id", auth.eventId);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
