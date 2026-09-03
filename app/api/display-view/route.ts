import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { fetchSessions } from "@/lib/data/sessions";
import { verifyDisplayAccess } from "@/lib/server/verify-display-access";

// GET ?token=... | ?eventId=... — the read path for the four public TV
// displays (General/AV/Green Room/Presenter). They poll this every ~2-3s
// instead of subscribing to Supabase Realtime directly, for one reason:
// RLS now scopes reads to `owner_id = auth.uid()`, and an anonymous
// share-link visitor has no auth.uid() at all — a direct client
// subscription would just get zero rows. This route resolves the token
// (or an authenticated operator's own eventId) server-side via
// verifyDisplayAccess — the exact same check the display pages themselves
// gate on — then reads with the service-role client, which is a
// legitimate bypass here because the event_id being read was already
// verified, not supplied blindly.
//
// Used uniformly by all four display pages regardless of how they were
// reached (share-link token or an operator's own logged-in preview) — one
// code path is easier to audit for isolation than two, and the operator
// preview case losing true sub-second Realtime in exchange is a
// deliberate, small trade-off (see the approved multi-tenant plan).
const VALID_DISPLAY_TYPES = new Set(["presenter", "green-room", "av", "general"]);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token") ?? undefined;
  const eventId = url.searchParams.get("eventId") ?? undefined;
  const displayTypeParam = url.searchParams.get("displayType") ?? undefined;
  const displayType = displayTypeParam && VALID_DISPLAY_TYPES.has(displayTypeParam) ? displayTypeParam : undefined;

  const access = await verifyDisplayAccess(token, eventId);
  if (!access.ok) {
    return NextResponse.json({ ok: false, reason: access.reason }, { status: 403 });
  }

  // display_type_state, not display_state, for hold/timer (2026-09 blocker
  // remediation — supabase/migrations/0009_display_type_state.sql): see
  // that migration's comment and app/api/display-engine/hold/route.ts's
  // for the full why. displayType is optional here — an unrecognized or
  // missing value just means no hold/timer override is merged in below,
  // which every real display client avoids by always sending its own
  // type; speaker_ready (still genuinely event-wide) keeps coming from
  // display_state, unchanged.
  const admin = supabaseAdmin();
  const [sessions, eventResult, liveStateResult, displayStateResult, typeStateResult, registryResult, broadcastsResult] =
    await Promise.all([
      fetchSessions(admin, access.eventId),
      admin.from("events").select("name, venue").eq("id", access.eventId).single(),
      admin.from("live_state").select("*").eq("event_id", access.eventId).single(),
      admin.from("display_state").select("*").eq("event_id", access.eventId).single(),
      displayType
        ? admin
            .from("display_type_state")
            .select("hold, timer")
            .eq("event_id", access.eventId)
            .eq("display_type", displayType)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      admin.from("display_registry").select("*").eq("event_id", access.eventId),
      admin.from("display_broadcasts").select("*").eq("event_id", access.eventId).order("created_at", { ascending: false }),
    ]);

  // Every one of these is checked, not just liveState — a real DB error on
  // any of them (RLS misconfig, transient outage) must not look like "no
  // displays registered" or "no broadcasts sent" to a public TV display
  // that has no other way to surface a backend problem. typeStateResult is
  // deliberately excluded from this list — a missing row there (an event
  // that predates the migration's backfill, or a request with no
  // displayType) is a real, expected case handled by the ?? fallback
  // below, not an error.
  const failed = [eventResult, liveStateResult, displayStateResult, registryResult, broadcastsResult].find((r) => r.error);
  if (failed) {
    return NextResponse.json({ ok: false, error: failed.error!.message }, { status: 500 });
  }

  const displayState = displayStateResult.data
    ? {
        ...displayStateResult.data,
        ...(typeStateResult.data ? { hold: typeStateResult.data.hold, timer: typeStateResult.data.timer } : {}),
      }
    : null;

  return NextResponse.json({
    ok: true,
    eventId: access.eventId,
    // The public displays previously had no account-level event identity at
    // all — only an optional per-session "Display title" field. A viewer
    // standing in front of a TV in a multi-tenant venue had no way to
    // confirm which event they were even looking at (2026-09-01 audit,
    // KF-014 / design-system audit's "generic public display identity").
    eventName: eventResult.data?.name ?? null,
    eventVenue: eventResult.data?.venue ?? null,
    sessions,
    liveState: liveStateResult.data,
    displayState,
    displayRegistry: registryResult.data ?? [],
    displayBroadcasts: broadcastsResult.data ?? [],
  });
}
