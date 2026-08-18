import { NextResponse } from "next/server";
import { requireEventOwner } from "@/lib/server/require-event-owner";
import { supabaseAdmin } from "@/lib/supabase/server";

// DELETE cancels a not-yet-sent scheduled broadcast. requireEventOwner-gated.
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const eventId = new URL(request.url).searchParams.get("eventId");
  const auth = await requireEventOwner(eventId);
  if (auth instanceof NextResponse) return auth;

  const supabase = supabaseAdmin();
  const { error } = await supabase
    .from("display_broadcasts")
    .delete()
    .eq("id", id)
    .eq("event_id", auth.eventId)
    .eq("status", "scheduled");
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
