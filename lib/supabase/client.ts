"use client";

import { createBrowserClient } from "@supabase/ssr";

// Browser client — public reads, Realtime subscriptions, AND now auth
// (signup/login/logout/session). createBrowserClient (not plain
// @supabase/supabase-js createClient) is the part that matters here: it
// stores the session in cookies rather than only localStorage, which is
// what lets the server (proxy.ts, Server Components, Route Handlers via
// lib/supabase/server.ts) read the same session on the next request. RLS
// (supabase/schema.sql) still restricts the anon key this ships with to
// select-only on public tables; writes go through API routes using the
// service-role client (lib/supabase/server.ts's supabaseAdmin) instead.
let browserClient: ReturnType<typeof createBrowserClient> | null = null;

export function supabaseBrowser() {
  if (browserClient) return browserClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set");
  }
  browserClient = createBrowserClient(url, key);
  return browserClient;
}
