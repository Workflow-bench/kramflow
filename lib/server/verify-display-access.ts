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

export async function verifyDisplayAccess(
  token: string | undefined,
  requestedEventId: string | undefined
): Promise<DisplayAccessResult> {
  if (token) {
    const result = await resolveShareLink(token);
    if (!result.ok) return { ok: false, reason: result.reason };
    return { ok: true, via: "token", eventId: result.link.event_id };
  }

  if (requestedEventId) {
    const auth = await requireEventAccess(requestedEventId, "viewer");
    if (!(auth instanceof NextResponse)) return { ok: true, via: "session", eventId: auth.eventId };
  }

  return { ok: false, reason: "no_token" };
}
