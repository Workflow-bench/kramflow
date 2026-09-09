import { NextResponse } from "next/server";
import { requireIntegrationCredential } from "@/lib/server/integration-credentials";
import { supabaseAdmin } from "@/lib/supabase/server";

export async function GET(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const credential = await requireIntegrationCredential(request, eventId, "state:read");
  if (credential instanceof NextResponse) return credential;
  const admin = supabaseAdmin();
  const { data: liveState, error } = await admin.from("live_state").select("*").eq("event_id", eventId).maybeSingle();
  if (error || !liveState) return NextResponse.json({ ok: false, error: "Event not found" }, { status: 404 });
  const active = liveState.active_session_id
    ? await admin.from("sessions").select("id, day_label, session_label").eq("id", liveState.active_session_id).eq("event_id", eventId).maybeSingle()
    : { data: null };
  const currentOrder = liveState.progress_by_session?.[liveState.active_session_id ?? ""]?.currentOrder;
  const programs = active.data && typeof currentOrder === "number"
    ? await admin.from("programs").select("id, title, sort_order, duration_seconds").eq("session_id", active.data.id).in("sort_order", [currentOrder, currentOrder + 1]).order("sort_order")
    : { data: [] };
  return NextResponse.json({ ok: true, eventId, state: { liveState, activeSession: active.data, currentProgram: programs.data?.[0] ?? null, nextProgram: programs.data?.[1] ?? null, controller: { active: Boolean(liveState.controller_id && liveState.controller_claimed_at) } } });
}
