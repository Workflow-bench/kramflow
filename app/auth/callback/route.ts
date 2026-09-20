import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { safeNext } from "@/lib/safe-redirect";

// The one place a Supabase-Auth-sent email link (collaborator invite,
// password recovery, email change) lands before handing off to wherever it
// actually wants the visitor to go. Supabase's own /auth/v1/verify endpoint
// redirects here with a PKCE `code` once the link itself has been validated
// server-side; exchanging it here is what turns that into an actual session
// (cookies), the same way lib/supabase/server.ts's supabaseServer() reads
// the session for every other request.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  // `next` is attacker-controllable; only a same-origin path may be followed.
  const next = safeNext(url.searchParams.get("next"));

  if (code) {
    const supabase = await supabaseServer();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(next, url.origin));
    }
  }

  // No code, or the exchange failed (expired/already-used link) — send them
  // to login rather than the invite/reset page itself, which would just
  // read as signed-out and confusingly ask them to start over anyway.
  return NextResponse.redirect(new URL("/login", url.origin));
}
