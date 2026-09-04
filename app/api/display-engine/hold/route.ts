import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { verifyDisplayAccess } from "@/lib/server/verify-display-access";

const VALID_DISPLAY_TYPES = new Set(["presenter", "green-room", "av", "general"]);

// PATCH activate/deactivate Hold. Still no requireAuth() — Presenter's own
// Hold button is an unauthenticated control by design — but display_type_
// state is one row per (event, display type), not per event alone
// (2026-09 blocker remediation — supabase/migrations/0009_display_type_
// state.sql), so a client-supplied eventId/token still can't be trusted
// blindly: it resolves which *event* the same way the four canonical
// display pages resolve which event they're allowed to see, and
// displayType (required, not inferred) resolves which display's own row
// this Hold applies to. Before this, display_state was one row per event —
// Presenter is the only display type whose UI ever calls this route
// (confirmed via a full grep of every display client), but the shared row
// meant its Hold takeover rendered on every display type sharing the
// event, including the audience-facing General display, reachable by any
// share-link token regardless of which screen it was minted for. Body:
// { token? | eventId?, displayType, active, ... }.
export async function PATCH(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const access = await verifyDisplayAccess(
    typeof body.token === "string" ? body.token : undefined,
    typeof body.eventId === "string" ? body.eventId : undefined
  );
  if (!access.ok) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 403 });

  const displayType = body.displayType;
  if (typeof displayType !== "string" || !VALID_DISPLAY_TYPES.has(displayType)) {
    return NextResponse.json({ ok: false, error: "Missing or invalid displayType" }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const hold =
    body.active === true
      ? {
          active: true,
          message: typeof body.message === "string" ? body.message : "Please Stand By",
          subMessage: typeof body.subMessage === "string" ? body.subMessage : null,
          continueClock: body.continueClock === true,
          activatedAt: new Date().toISOString(),
        }
      : null;

  if (hold) {
    const { error } = await supabase
      .from("display_type_state")
      .update({ hold })
      .eq("event_id", access.eventId)
      .eq("display_type", displayType);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  } else {
    const { data: current, error: fetchError } = await supabase
      .from("display_type_state")
      .select("hold")
      .eq("event_id", access.eventId)
      .eq("display_type", displayType)
      .single();
    if (fetchError) return NextResponse.json({ ok: false, error: fetchError.message }, { status: 500 });
    const { error } = await supabase
      .from("display_type_state")
      .update({ hold: { ...current.hold, active: false, activatedAt: null } })
      .eq("event_id", access.eventId)
      .eq("display_type", displayType);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
