import "server-only";
import { NextResponse } from "next/server";
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
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
