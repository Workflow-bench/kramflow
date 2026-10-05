import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { verifySessionAccess } from "@/lib/server/verify-display-access";
import { provisionDisplayTypeRows } from "@/lib/server/display-type-state";

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
  // Events created before a display type's row existed have none. Provisioning
  // first means a hold write always has a row to land on (KF-031).
  const provisioned = await provisionDisplayTypeRows(supabase, access.eventId);
  if (!provisioned.ok) {
    console.error("[hold] provisioning failed:", provisioned.error);
    return NextResponse.json({ ok: false, error: "Something went wrong. Try again." }, { status: 500 });
  }
  const hold =
    body.active === true
      ? {
          active: true,
          message: typeof body.message === "string" ? body.message : "Please Stand By",
          subMessage: typeof body.subMessage === "string" ? body.subMessage : null,
          continueClock: body.continueClock === true,
          activatedAt: new Date().toISOString(),
          // Unique per activation. A timestamp alone can repeat within a millisecond, so it
          // cannot prove that the hold a deactivation read is still the one in the row.
          rev: crypto.randomUUID(),
        }
      : null;

  const nextHold = hold ?? null;
  let stored: { hold: { active?: boolean } | null } | null = null;
  if (hold) {
    const { data, error } = await supabase
      .from("display_type_state")
      .update({ hold })
      .eq("event_id", access.eventId)
      .eq("display_type", displayType)
      .select("hold");
    if (error) {
      console.error(error);
      return NextResponse.json({ ok: false, error: "Something went wrong. Try again." }, { status: 500 });
    }
    stored = data && data.length === 1 ? data[0] : null;
  } else {
    // Deactivation is a compare-and-set, not a blind write. The merge is built from a
    // read, so the write is conditional on the activatedAt witness the read saw. If a
    // concurrent activation changed the hold in between, the write matches no row:
    // re-read and retry. Without this, a stale merge overwrote a committed activation's
    // message and cleared its timestamp (lost update, reproduced in
    // docs/audit-remediation/migrations/tests/hold/hold_lost_update.sh).
    const MAX_ATTEMPTS = 3;
    let deactivated = false;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS && !deactivated; attempt++) {
      const { data: current, error: fetchError } = await supabase
        .from("display_type_state")
        .select("hold")
        .eq("event_id", access.eventId)
        .eq("display_type", displayType)
        .maybeSingle();
      if (fetchError) {
        console.error(fetchError);
        return NextResponse.json({ ok: false, error: "Something went wrong. Try again." }, { status: 500 });
      }
      if (!current) {
        console.error("[hold] no display_type_state row after provisioning", access.eventId, displayType);
        return NextResponse.json({ ok: false, error: "Something went wrong. Try again." }, { status: 500 });
      }
      // The witness is the activation revision (`rev`). Rows written before revisions
      // existed carry only activatedAt, so that is the fallback witness for them.
      const read = (current.hold ?? {}) as { rev?: string | null; activatedAt?: string | null };
      const witnessKey = read.rev ? "rev" : "activatedAt";
      const witness = read.rev ?? read.activatedAt ?? null;
      const conditional = supabase
        .from("display_type_state")
        .update({ hold: { ...current.hold, active: false, activatedAt: null, rev: null } })
        .eq("event_id", access.eventId)
        .eq("display_type", displayType);
      const { data, error } =
        witness === null
          ? await conditional.is(`hold->>${witnessKey}`, null).select("hold")
          : await conditional.eq(`hold->>${witnessKey}`, witness).select("hold");
      if (error) {
        console.error(error);
        return NextResponse.json({ ok: false, error: "Something went wrong. Try again." }, { status: 500 });
      }
      if (data && data.length === 1) {
        stored = data[0];
        deactivated = true;
      }
    }
    if (!deactivated) {
      console.error("[hold] deactivation conflicted with concurrent changes", access.eventId, displayType);
      return NextResponse.json(
        { ok: false, error: "The display changed while deactivating. Try again." },
        { status: 409 }
      );
    }
  }

  // Readback: the write counts only if the row now holds the requested state.
  // A write that matched no row must not report success (KF-031).
  const expectedActive = nextHold?.active === true;
  if (!stored || (stored.hold?.active === true) !== expectedActive) {
    console.error("[hold] readback mismatch", access.eventId, displayType, expectedActive);
    return NextResponse.json({ ok: false, error: "Something went wrong. Try again." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
