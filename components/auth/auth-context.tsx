"use client";
import { requestSignOut } from "@/lib/auth/sign-out";
import { setSessionUserId } from "@/lib/auth/session-identity";
import { resetRehearsalRuns } from "@/components/rehearsal/persisted-run";

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
  lock: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>("checking");

  useEffect(() => {
    const supabase = supabaseBrowser();

    supabase.auth.getSession().then((result: { data: { session: Session | null } }) => {
      setSessionUserId(result.data.session?.user?.id ?? null);
      setStatus(result.data.session ? "unlocked" : "locked");
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
      setSessionUserId(session?.user?.id ?? null);
      // Account boundary: a different identity must not see this one's rehearsal runs.
      // INITIAL_SESSION and TOKEN_REFRESHED (a reload, a refreshed token) keep them.
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") resetRehearsalRuns();
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

  // Redirects home only after the server confirms the session was removed.
  // A failed or unconfirmed sign-out returns false and leaves the UI as it
  // was, so the caller can say so instead of acting as if the user was
  // signed out (KF-016, B005-F2).
  async function lock(): Promise<boolean> {
    if (!(await requestSignOut())) return false;
    resetRehearsalRuns();
    setSessionUserId(null);
    setStatus("locked");
    window.location.href = "/";
    return true;
  }

  return <AuthContext.Provider value={{ status, lock }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
