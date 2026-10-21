import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { isSafeRedirect, safeNext } from "@/lib/safe-redirect";

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

  // No code, or the exchange failed (expired or already-used link). Send the
  // visitor to login with the validated destination kept, so a successful login
  // continues where the link was meant to go. `link=expired` is a generic marker:
  // it does not say whether the account exists or which failure occurred.
  if (!code) return NextResponse.redirect(new URL("/login", url.origin));
  const failure = new URL("/login", url.origin);
  failure.searchParams.set("link", "expired");
  // Only a raw next that passed validation is carried. The fallback is not.
  const rawNext = url.searchParams.get("next");
  if (rawNext && isSafeRedirect(rawNext)) failure.searchParams.set("next", rawNext);
  return NextResponse.redirect(failure);
}
