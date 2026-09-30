import "server-only";
import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabase/server";

// Every mutating API route (live-state actions, programs/sessions CRUD,
// cue-sheet upload, display-engine routes) calls this first. Returns a 401
// JSON response to short-circuit the route on failure, or null when the
// caller is authorized — same contract as before this checked real
// sessions, so none of the ~20 call sites needed to change.
//
// Previously verified a single shared PIN's HMAC-signed cookie (no
// per-user identity, see git history of lib/server/auth-cookie.ts). Now
// verifies a real Supabase Auth session — `getUser()`, not `getSession()`,
// because getSession() only decodes the JWT from the cookie without
// re-checking it against Supabase; getUser() makes the round trip that
// actually confirms the session hasn't been revoked. This route is a write
// gate, not a hot path read, so that extra round trip is the right
// trade-off here.
export async function requireAuth(): Promise<NextResponse | null> {
  const result = await requireAuthUser();
  return result instanceof NextResponse ? result : null;
}

// Same check as requireAuth(), but hands back the user it already fetched
// — for the handful of routes (currently just app/api/events/route.ts)
// that need the caller's id afterward and would otherwise make a second
// getUser() round trip to Supabase Auth for the exact same session.
export async function requireAuthUser(): Promise<NextResponse | { user: User }> {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const blocked = requirePasswordCurrent(user);
  if (blocked) return blocked;
  return { user };
}

// A collaborator invited via app/api/events/[eventId]/collaborators/
// route.ts is confirmed immediately with a temporary password and
// app_metadata.must_change_password=true. proxy.ts redirects flagged
// *page* navigations to /set-password, but it explicitly exempts every
// /api/ path (see proxy.ts) — so this is the actual boundary for every
// route that authenticates through requireAuthUser() or
// requireEventAccess(), the two shared guards that both call this.
// app/api/auth/set-password/route.ts and app/api/invites/[token]/accept/
// route.ts intentionally do their own raw supabase.auth.getUser() instead
// of going through either guard — they're exactly the narrow set of
// operations a flagged session must still be able to reach (replace the
// password; accept an invite already addressed to this exact email), so
// they're untouched by this check on purpose, not by oversight.
export function requirePasswordCurrent(user: User): NextResponse | null {
  if (user.app_metadata?.must_change_password) {
    return NextResponse.json(
      { ok: false, error: "Set a new password before continuing.", code: "must_change_password" },
      { status: 403 }
    );
  }
  return null;
}
