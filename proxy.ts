import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Next.js 16 renamed `middleware.ts` to `proxy.ts` (same runtime, same
// purpose — see AGENTS.md: this codebase runs a version of Next.js with
// real breaking changes from what most training data assumes). This is the
// first proxy file in the project.
//
// Two jobs, both optimistic/cheap on purpose (Next's own auth guide is
// explicit that Proxy runs on every request, including prefetches, and
// should stick to cookie reads — no database round trips here):
//
//  1. Refresh the Supabase session cookie so it doesn't go stale mid-visit
//     (the standard @supabase/ssr proxy pattern).
//  2. Redirect obviously-unauthenticated requests away from operator-only
//     routes before they render anything, and away from display routes
//     that have neither a session nor a share-link token to even try.
//
// This is NOT the authoritative access check for either route class — that
// happens server-side, close to the data: lib/server/require-auth.ts for
// every mutating API route, and lib/server/verify-display-access.ts (reads
// the real share_links table) for the four display pages. A user who
// already has a page loaded and then has their session revoked, or whose
// share-link token gets revoked mid-visit, won't be caught by Proxy until
// their next navigation — those routes' own server-side checks are what
// actually enforce it on every request, not this file. See Next's
// Authentication guide (node_modules/next/dist/docs/01-app/02-guides/
// authentication.md) for why the split is drawn this way.

// Every per-event operator surface (console, cue sheet, remote, broadcast
// center, display manager) now lives under /e/[eventId]/... — a single
// prefix check covers all of them. /dashboard (the operator's own event
// list) is the one operator-only route that isn't event-scoped.
const OPERATOR_ROUTES = ["/dashboard", "/e"];

const DISPLAY_ROUTES = ["/general", "/av", "/green-room", "/presenter"];

export async function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Supabase env vars are required for the app to function at all (every
  // existing data fetch already depends on them) — if they're missing,
  // let the request through unchanged rather than crashing Proxy for
  // every single route; the pages themselves will fail loudly and
  // specifically instead.
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // getUser() (not getSession()) — re-validates against Supabase rather
  // than just decoding the JWT already in the cookie, and is what
  // actually triggers the refresh via setAll above when the access token
  // is near expiry. Same reasoning as lib/server/require-auth.ts.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isOperatorRoute = OPERATOR_ROUTES.some((r) => pathname === r || pathname.startsWith(`${r}/`));
  const isDisplayRoute = DISPLAY_ROUTES.some((r) => pathname === r || pathname.startsWith(`${r}/`));

  if (isOperatorRoute && !user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Display routes: let it through if there's a session (an operator
  // previewing a display) OR a token param is present (a share-link visit
  // — the page itself validates the token for real). Only block the case
  // where neither is true: someone hit a bare /general with nothing to
  // even attempt authorizing with.
  if (isDisplayRoute && !user && !searchParams.get("token")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Logged-in operators land on /dashboard, not the old public launcher or
  // the login/signup forms — matches "no more homepage screen-picker" as
  // the post-login destination.
  if (user && (pathname === "/" || pathname === "/login" || pathname === "/signup")) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Run on everything except static assets, image optimization, and
     * favicon — auth redirects have no business intercepting those, and
     * matching them would just add latency to every asset request.
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
