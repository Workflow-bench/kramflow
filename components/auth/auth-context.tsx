"use client";
import { requestSignOut } from "@/lib/auth/sign-out";
import { getRawSessionUserId, setSessionUserId } from "@/lib/auth/session-identity";
import { createIdentityController, type AuthStatus, type IdentityController } from "@/lib/auth/identity-controller";
import { resetRehearsalRuns } from "@/components/rehearsal/persisted-run";

import { createContext, useContext, useEffect, useRef, useState } from "react";
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

type Status = AuthStatus;

interface AuthContextValue {
  status: Status;
  lock: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>("checking");
  const controllerRef = useRef<IdentityController | null>(null);

  useEffect(() => {
    const supabase = supabaseBrowser();
    // Ordering, identity and rehearsal-run clearing live in identity-controller.ts (tested).
    const controller = createIdentityController({
      getIdentity: getRawSessionUserId,
      setIdentity: setSessionUserId,
      resetRuns: resetRehearsalRuns,
      setStatus,
    });
    controllerRef.current = controller;
    const applyHydrate = controller.beginHydrate();

    supabase.auth.getSession().then((result: { data: { session: Session | null } }) => {
      // A newer auth event that arrived first wins; a late getSession result is dropped.
      applyHydrate(result);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
      controller.onEvent(event, session);
      // A session that changes after a channel already joined needs its own explicit push
      // (lib/supabase/client.ts realtimeReady()).
      refreshRealtimeAuth(session?.access_token ?? null);
    });

    return () => {
      controller.dispose();
      controllerRef.current = null;
      subscription.unsubscribe();
    };
  }, []);

  // Redirects home only after the server confirms the session was removed. A failed or
  // unconfirmed sign-out returns false and leaves identity, runs and UI as they were.
  async function lock(): Promise<boolean> {
    const confirmed = await requestSignOut();
    const applied = controllerRef.current?.signOut(confirmed) ?? false;
    if (!applied) return false;
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
