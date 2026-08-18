import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Service-role client — server-only, bypasses RLS. Used exclusively by API
// routes and scripts/seed.ts for writes (see supabase/schema.sql: no public
// insert/update/delete policies are defined, so this key is the only way to
// write). Never import this from a "use client" component or anything that
// ships to the browser — no consumer currently does (verified: only
// app/api/* routes and scripts/seed.ts import this module) — the
// `server-only` package's guard was removed because it fires outside
// Next's bundler context too, breaking the standalone seed script.
export function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  }
  return createClient(url, key, {
    auth: { persistSession: false },
  });
}

// Request-scoped, cookie-aware anon client — the server-side half of real
// auth. Reads the session cookie createBrowserClient (lib/supabase/client.ts)
// set, so `.auth.getUser()` here returns the actual signed-in operator
// inside Server Components, Route Handlers, and Server Actions. This is
// deliberately a *separate* client from supabaseAdmin(): this one carries
// the caller's identity and is subject to RLS, admin bypasses RLS entirely
// and carries no identity — mixing them up would either leak service-role
// power into a user-facing request or silently strip a real user's session.
//
// Must be created fresh per request (cookies() is request-scoped) — never
// cached at module scope the way supabaseAdmin() memoizes, or every request
// would share the first caller's cookies.
export async function supabaseServer() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set");
  }
  const cookieStore = await cookies();
  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        // Server Components can't set cookies (no response to attach them
        // to) — this throws there. Route Handlers and Server Actions can,
        // and that's where session refresh/sign-in/sign-out actually
        // mutate cookies; a Server Component only ever reads. Swallowing
        // the error here (rather than the try/catch living at every call
        // site) matches Supabase's own documented Next.js SSR pattern.
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component — safe to ignore because
          // proxy.ts already refreshes the session cookie on every
          // request, so a Server Component never needs to write it itself.
        }
      },
    },
  });
}
