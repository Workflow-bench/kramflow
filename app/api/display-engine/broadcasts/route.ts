import { NextResponse } from "next/server";
import { requireEventOwner } from "@/lib/server/require-event-owner";
import { supabaseAdmin } from "@/lib/supabase/server";

// POST send-now or schedule a broadcast. requireEventOwner-gated — only
// Broadcast Center + Operator's embedded quick-panel (both authenticated,
// scoped to the operator's own event) create broadcasts. Dismiss/
// acknowledge/promote stay public (see their own route files) since
// BroadcastOverlay — rendered on every public display — calls them
// directly, keyed by the broadcast's own unguessable id, not by event_id.
export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const auth = await requireEventOwner(typeof body.eventId === "string" ? body.eventId : null);
  if (auth instanceof NextResponse) return auth;

  const draft = body.draft as Record<string, unknown> | undefined;
  if (!draft || typeof draft.title !== "string") {
    return NextResponse.json({ ok: false, error: "draft.title is required" }, { status: 400 });
  }

  const scheduledFor = typeof body.scheduledFor === "string" ? body.scheduledFor : null;
  const now = new Date();
  const expiresInMinutes = typeof draft.expiresInMinutes === "number" ? draft.expiresInMinutes : null;
  const baseTime = scheduledFor ? Date.parse(scheduledFor) : now.getTime();

  const row = {
    event_id: auth.eventId,
    type: draft.type,
    title: draft.title,
    message: draft.message,
    icon: draft.icon ?? null,
    priority: draft.priority,
    target: draft.target,
    created_at: now.toISOString(),
    expires_at: expiresInMinutes ? new Date(baseTime + expiresInMinutes * 60000).toISOString() : null,
    duration_seconds: draft.durationSeconds ?? null,
    acknowledgement_required: draft.acknowledgementRequired === true,
    persistent: draft.persistent === true,
    acknowledged_by: [],
    scheduled_for: scheduledFor,
    status: scheduledFor ? "scheduled" : "sent",
  };

  const supabase = supabaseAdmin();
  const { data, error } = await supabase.from("display_broadcasts").insert(row).select().single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, broadcast: data });
}
