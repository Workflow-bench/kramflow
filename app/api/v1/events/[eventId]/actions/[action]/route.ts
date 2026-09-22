import { NextResponse } from "next/server";
import { runLiveAction } from "@/app/api/live/route";
import { requireIntegrationCredential } from "@/lib/server/integration-credentials";
import { supabaseAdmin } from "@/lib/supabase/server";

const ACTIONS = new Set(["start", "hold", "resume", "next"]);

export async function POST(request: Request, { params }: { params: Promise<{ eventId: string; action: string }> }) {
  const { eventId, action } = await params;
  if (!ACTIONS.has(action)) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  const credential = await requireIntegrationCredential(request, eventId, "live:control");
  if (credential instanceof NextResponse) return credential;
  const admin = supabaseAdmin();
  const { data: state, error } = await admin.from("live_state").select("active_session_id, paused_at").eq("event_id", eventId).maybeSingle();
  if (error || !state) return NextResponse.json({ ok: false, error: "Event not found" }, { status: 404 });
  if ((action === "hold" && state.paused_at) || (action === "resume" && !state.paused_at)) return NextResponse.json({ ok: true, noop: true });
  let body: Record<string, unknown> = { eventId, clientId: `integration:${credential.id}`, action: action === "hold" || action === "resume" ? "togglePause" : action };
  if (action === "next") {
    const { count, error: countError } = await admin
      .from("programs")
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId)
      .eq("session_id", state.active_session_id);
    if (countError || count === null) return NextResponse.json({ ok: false, error: "Could not resolve program" }, { status: 500 });
    body = { ...body, maxOrder: count };
  }
  const mutation = new Request(request.url, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return runLiveAction(mutation, { eventId, userId: null, actorName: `Integration: ${credential.label}` });
}
