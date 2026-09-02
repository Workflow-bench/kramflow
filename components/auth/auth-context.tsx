"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { supabaseBrowser, refreshRealtimeAuth } from "@/lib/supabase/client";

// Real per-operator sessions now (Supabase Auth), replacing the shared-PIN
// + sessionStorage flag this used to be. The public shape — status/lock —
// is unchanged on purpose: 7 existing consumers (command-palette, the
// operator/remote/broadcast/display-manager pages) only ever destructure
// `status` and `lock`, so keeping the contract identical meant none of them
// needed to change. `unlock` is gone — it was PinGate's alone, and PinGate
// no longer exists: proxy.ts redirects unauthenticated requests to the real
// /login page before an operator route ever renders, so there's no more
// inline "enter PIN to unlock" screen to unlock.
//
// "locked" now means "no active Supabase session" rather than "PIN not yet
// entered this browser session" — in normal operation an operator never
// actually sees this state, since proxy.ts already turned back anyone
// without a session. It still matters as a live signal: if a session
// expires or is revoked while a tab is open, onAuthStateChange flips this
// to "locked" so components like command-palette (`unlocked = status ===
// "unlocked"`) react without a full reload.

type Status = "checking" | "locked" | "unlocked";

interface AuthContextValue {
  status: Status;
  lock: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>("checking");

  useEffect(() => {
    const supabase = supabaseBrowser();

    supabase.auth.getSession().then((result: { data: { session: Session | null } }) => {
      setStatus(result.data.session ? "unlocked" : "locked");
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
      setStatus(session ? "unlocked" : "locked");
      // A session that changes *after* a channel already joined (sign-in
      // on this tab with no reload, a token refresh, sign-out) needs its
      // own explicit push — see lib/supabase/client.ts's realtimeReady()
      // doc comment for why joining channels can't just rely on this
      // firing eventually.
      refreshRealtimeAuth(session?.access_token ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  function lock() {
    setStatus("locked");
    // Server-side sign-out (clears the httpOnly session cookie proxy.ts
    // and every API route's requireAuth() check depend on) plus a hard
    // navigation to /login — not router.push, so proxy.ts re-evaluates
    // fresh rather than a client transition racing ahead of the cookie
    // actually being cleared.
    fetch("/api/auth/logout", { method: "POST" }).finally(() => {
      window.location.href = "/login";
    });
  }

  return <AuthContext.Provider value={{ status, lock }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
