import "server-only";
import { NextResponse } from "next/server";
import { resolveShareLink, type ShareLinkInvalidReason } from "@/lib/server/share-links";
import { requireEventAccess } from "@/lib/server/require-event-access";

// The authoritative, server-side gate for the four display pages
// (general/av/green-room/presenter). proxy.ts's check is optimistic (does
// a token param exist at all?) — this is the real one, called from each
// page's Server Component before it renders any live data. Two ways in:
//
//   1. An authenticated operator with real access to the event — owner or
//      an accepted collaborator (any role: editor or viewer). Resolves to
//      whichever eventId the page/link was opened for, provided the
//      session actually has access to it — an operator (or a
//      collaborator) cannot preview another event's display just by
//      knowing its event_id. This is exactly the isolation boundary that
//      matters, and it's delegated to requireEventAccess() (the same
//      owner/editor/viewer resolution every API route already uses)
//      rather than re-derived here — a second, independent "does this
//      user have access" check is exactly what let this path go
//      owner-only-only by accident (2026-09 permission-truth pass: it
//      used to check `owner_id = user.id` directly, which meant an
//      editor/viewer collaborator — who has real, legitimate access to
//      every other surface of this event — hit this display page's "link
//      invalid" gate instead of a preview. Not a deliberate security
//      boundary; a stale check that predated the collaborator model and
//      was never updated to match it).
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

//
// A Share Display token (and the six-digit TV code that resolves to one) is
// READ-ONLY. That is enforced by which of these two functions a route calls:
//
//   verifyDisplayAccess  token OR session. For reads, and for the few
//                        writes a display makes about itself (below).
//   verifySessionAccess  session only. A share token never satisfies it.
//                        Every route that changes show state uses this.
//
// Routes that call verifyDisplayAccess (directly, or through
// require-broadcast-display-access) and why each is safe for a token:
//   GET  display-view, display-engine/profiles/[id]   reads
//   POST display-engine/registry                      the display registering
//        or heartbeating itself for its own event (no commands, no show state)
//   POST display-engine/broadcasts/[id]/acknowledge   a display acknowledging
//        an emergency for its own displayId
//   POST display-engine/broadcasts/[id]/promote       only ever releases a
//        scheduled broadcast whose time has already passed, which is what the
//        scheduler would do anyway (there is no server-side cron)
// Anything else that writes belongs on verifySessionAccess. The guard in
// app/api/display-engine/token-authority.test.ts fails if a new route starts
// accepting tokens without being added to that list on purpose.
export async function verifySessionAccess(requestedEventId: string | undefined): Promise<DisplayAccessResult> {
  if (requestedEventId) {
    const auth = await requireEventAccess(requestedEventId, "viewer");
    if (!(auth instanceof NextResponse)) return { ok: true, via: "session", eventId: auth.eventId };
  }

  return { ok: false, reason: "no_token" };
}

export async function verifyDisplayAccess(
  token: string | undefined,
  requestedEventId: string | undefined
): Promise<DisplayAccessResult> {
  if (token) {
    const result = await resolveShareLink(token);
    if (!result.ok) return { ok: false, reason: result.reason };
    return { ok: true, via: "token", eventId: result.link.event_id };
  }

  return verifySessionAccess(requestedEventId);
}
