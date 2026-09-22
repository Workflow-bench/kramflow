import { NextResponse } from "next/server";
import { requireEventAccess } from "@/lib/server/require-event-access";
import { supabaseAdmin } from "@/lib/supabase/server";

// POST send-now or schedule a broadcast. requireEventAccess(owner)-gated — only
// Broadcast Center + Operator's embedded quick-panel (both authenticated,
// scoped to the operator's own event) create broadcasts. Dismiss is
// session-only. Acknowledge and promote accept a Share Display token because
// public displays call them for their own event (see their route files and
// lib/server/verify-display-access.ts).
export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const auth = await requireEventAccess(typeof body.eventId === "string" ? body.eventId : null, "owner");
  if (auth instanceof NextResponse) return auth;

  const draft = body.draft as Record<string, unknown> | undefined;
  if (!draft || typeof draft.title !== "string") {
    return NextResponse.json({ ok: false, error: "draft.title is required" }, { status: 400 });
  }

  const scheduledFor = typeof body.scheduledFor === "string" ? body.scheduledFor : null;
  const now = new Date();
  const expiresInMinutes = typeof draft.expiresInMinutes === "number" ? draft.expiresInMinutes : null;
  const baseTime = scheduledFor ? Date.parse(scheduledFor) : now.getTime();
  if (Number.isNaN(baseTime)) {
    return NextResponse.json({ ok: false, error: "scheduledFor is not a valid date" }, { status: 400 });
  }

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
  if (error) {
    console.error(error);
    return NextResponse.json({ ok: false, error: "Something went wrong. Try again." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, broadcast: data });
}
