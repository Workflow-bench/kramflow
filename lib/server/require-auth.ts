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
//
// Correction (Codex Phase 1 review, KF-002/R2): an earlier version of this
// comment claimed app/api/auth/set-password/route.ts *and*
// app/api/invites/[token]/accept/route.ts were both a deliberate, narrow
// exception to this check — wrong for the second one, and Codex caught it.
// set-password is the real exception: it's the one operation a flagged
// session must be able to reach to stop being flagged, so it
// correctly does its own raw getUser() without this check. Invite
// acceptance is not in that category — matching the invite's email proves
// identity, not that the temporary password has been replaced, and both
// the original Fix Guide and the master remediation contract require
// acceptance to fail until it has. accept/route.ts now calls
// requirePasswordCurrent() directly (it doesn't go through
// requireAuthUser()/requireEventAccess() either, since it isn't
// event-scoped and needs the user object before any event lookup) — see
// its own comment. This file's job is exported helper + the two guards
// that share it; routes with their own raw getUser() are responsible for
// calling requirePasswordCurrent() themselves if they need it, and
// set-password is the only one that's correctly exempt.
export function requirePasswordCurrent(user: User): NextResponse | null {
  if (user.app_metadata?.must_change_password) {
    return NextResponse.json(
      { ok: false, error: "Set a new password before continuing.", code: "must_change_password" },
      { status: 403 }
    );
  }
  return null;
}
