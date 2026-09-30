import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { verifySessionAccess } from "@/lib/server/verify-display-access";

const VALID_DISPLAY_TYPES = new Set(["presenter", "green-room", "av", "general"]);

// PATCH activate/deactivate Hold. Owner only: Hold is an operational show
// mutation (it freezes the countdown on a live display), exactly the class
// of action the Remote page's own OWNER_ONLY_NOTE reserves for the event
// owner — a viewer or editor collaborator has real access to the event but
// not to this. A Share Display token is read-only and never authorizes this
// either (see verifySessionAccess), so the caller must be logged in as the
// owner with access to body.eventId. display_type_state is one row per
// (event, display type), not per event alone
// (supabase/migrations/20260909091740_display_type_state.sql), and displayType
// (required, not inferred) resolves which display's own row this Hold
// applies to. Body: { eventId, displayType, active, ... }.
export async function PATCH(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const access = await verifySessionAccess(typeof body.eventId === "string" ? body.eventId : undefined, "owner");
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
    if (error) {
      console.error(error);
      return NextResponse.json({ ok: false, error: "Something went wrong. Try again." }, { status: 500 });
    }
  } else {
    const { data: current, error: fetchError } = await supabase
      .from("display_type_state")
      .select("hold")
      .eq("event_id", access.eventId)
      .eq("display_type", displayType)
      .single();
    if (fetchError) {
      console.error(fetchError);
      return NextResponse.json({ ok: false, error: "Something went wrong. Try again." }, { status: 500 });
    }
    const { error } = await supabase
      .from("display_type_state")
      .update({ hold: { ...current.hold, active: false, activatedAt: null } })
      .eq("event_id", access.eventId)
      .eq("display_type", displayType);
    if (error) {
      console.error(error);
      return NextResponse.json({ ok: false, error: "Something went wrong. Try again." }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
