import { NextResponse } from "next/server";
import { requireEventAccess } from "@/lib/server/require-event-access";
import { supabaseAdmin } from "@/lib/supabase/server";

export async function DELETE(_request: Request, { params }: { params: Promise<{ eventId: string; credentialId: string }> }) {
  const { eventId, credentialId } = await params;
  const auth = await requireEventAccess(eventId, "owner");
  if (auth instanceof NextResponse) return auth;
  const { data, error } = await supabaseAdmin()
    .from("integration_credentials")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", credentialId).eq("event_id", auth.eventId).is("revoked_at", null)
    .select("id").maybeSingle();
  if (error) return NextResponse.json({ ok: false, error: "Could not revoke integration" }, { status: 500 });
  if (!data) return NextResponse.json({ ok: false, error: "Integration not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
