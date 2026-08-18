import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { verifyDisplayAccess } from "@/lib/server/verify-display-access";

// PATCH activate/deactivate Hold. Still no requireAuth() — Presenter's own
// Hold button is an unauthenticated control by design — but display_state
// is now one row per event (not a global singleton), so a client-supplied
// eventId can no longer be trusted blindly: it's resolved the same way the
// four canonical display pages resolve which event they're allowed to see
// (a share-link token, or an authenticated operator's own eventId), not
// accepted as a bare parameter. Body: { token? | eventId?, active, ... }.
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
    const { error } = await supabase.from("display_state").update({ hold }).eq("event_id", access.eventId);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  } else {
    const { data: current, error: fetchError } = await supabase
      .from("display_state")
      .select("hold")
      .eq("event_id", access.eventId)
      .single();
    if (fetchError) return NextResponse.json({ ok: false, error: fetchError.message }, { status: 500 });
    const { error } = await supabase
      .from("display_state")
      .update({ hold: { ...current.hold, active: false, activatedAt: null } })
      .eq("event_id", access.eventId);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
