import "server-only";
import { supabaseServer, supabaseAdmin } from "@/lib/supabase/server";
import { resolveShareLink, type ShareLinkInvalidReason } from "@/lib/server/share-links";

// The authoritative, server-side gate for the four display pages
// (general/av/green-room/presenter). proxy.ts's check is optimistic (does
// a token param exist at all?) — this is the real one, called from each
// page's Server Component before it renders any live data. Two ways in:
//
//   1. An authenticated operator (previewing a display from the dashboard)
//      — resolves to whichever eventId the page/link was opened for,
//      *provided the operator actually owns that event*. An operator
//      cannot preview another operator's display just by knowing its
//      event_id — this is exactly the isolation boundary that matters.
//   2. A valid, unexpired, unrevoked share-link token — resolves to
//      exactly the one event_id the token was minted for, never a
//      client-supplied one.
//
// Anything else fails closed with a specific reason the page turns into a
// real "this link is no longer valid" state — not a blank screen or a
// generic error page.
export type DisplayAccessResult =
  | { ok: true; via: "session" | "token"; eventId: string }
  | { ok: false; reason: ShareLinkInvalidReason | "no_token" };

export async function verifyDisplayAccess(
  token: string | undefined,
  requestedEventId: string | undefined
): Promise<DisplayAccessResult> {
  if (token) {
    const result = await resolveShareLink(token);
    if (!result.ok) return { ok: false, reason: result.reason };
    return { ok: true, via: "token", eventId: result.link.event_id };
  }

  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user && requestedEventId) {
    const admin = supabaseAdmin();
    const { data: event } = await admin
      .from("events")
      .select("id")
      .eq("id", requestedEventId)
      .eq("owner_id", user.id)
      .maybeSingle();
    if (event) return { ok: true, via: "session", eventId: event.id };
  }

  return { ok: false, reason: "no_token" };
}
