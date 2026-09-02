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
let readyPromise: Promise<void> | null = null;

export function supabaseBrowser() {
  if (browserClient) return browserClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set");
  }
  browserClient = createBrowserClient(url, key, {
    // createBrowserClient manages the Postgres/Auth session via cookies,
    // but the Realtime *socket* authorizes each postgres_changes
    // subscription with a separate token that otherwise defaults to the
    // anon key forever — cookie sign-in never reaches it on its own. Left
    // unset, a signed-in operator's live_state/activity_log subscriptions
    // silently run as anon.
    realtime: {
      accessToken: async () => {
        if (!browserClient) return null;
        const {
          data: { session },
        } = await browserClient.auth.getSession();
        return session?.access_token ?? null;
      },
      // realtime-js's own default (25s) means a hard, silent network cut —
      // no clean WebSocket close, just packets going nowhere — isn't
      // detected until a heartbeat goes unanswered, so the connection
      // badge kept reading SYNCED for 45-50s after the socket was actually
      // dead (measured live via CDP-simulated offline). During a live show
      // "is this screen actually connected" is exactly the kind of thing
      // this product's own design brief says an operator must be able to
      // read at a glance — a near-minute lag before the UI admits it isn't
      // is a real "misleading connectivity" gap, not just slow to notice.
      // 8s roughly halves detection time without materially increasing
      // heartbeat traffic for a handful of connected clients per event.
      heartbeatIntervalMs: 8000,
    },
  });
  return browserClient;
}

// A channel's *initial* join is fired the instant `.subscribe()` is called
// — realtime-js does not wait for the `accessToken` callback above to
// resolve first (only a *reconnect* after a dropped socket does that; see
// RealtimeClient's `_reconnectAuth`). So a channel opened in the same tick
// as sign-in resolving can join using the stale default token, and —
// confirmed live — a correct token pushed to an *already-joined* channel
// afterward does not retroactively re-authorize it for RLS purposes; only
// a token present at join time does. Every channel this app opens
// (lib/store.tsx, lib/use-operator-presence.ts, lib/use-controller-name.ts,
// components/operator/activity-log.tsx) must therefore await this once
// before its first `.subscribe()`, so the very first join already carries
// the signed-in user's token instead of racing it.
function initRealtimeAuth(): Promise<void> {
  const client = supabaseBrowser();
  return client.auth.getSession().then(async (result: Awaited<ReturnType<typeof client.auth.getSession>>) => {
    await client.realtime.setAuth(result.data.session?.access_token ?? null);
  });
}

export function realtimeReady(): Promise<void> {
  if (!readyPromise) readyPromise = initRealtimeAuth();
  return readyPromise;
}

// Called from components/auth/auth-context.tsx's onAuthStateChange — a
// session that only exists *after* realtimeReady() first resolved (e.g.
// sign-in happens on this same tab, no reload) needs its own explicit
// setAuth() push to already-joined channels; resetting the cache also
// means the next channel to open (a sign-in→operator-console navigation)
// awaits a fresh, correctly-populated promise instead of a stale one.
export function refreshRealtimeAuth(accessToken: string | null): void {
  readyPromise = null;
  supabaseBrowser().realtime.setAuth(accessToken);
}
