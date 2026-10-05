// Ordering controller for auth state. The provider feeds it Supabase events, the initial
// getSession result, and sign-out outcomes. It owns the sequence rules, so a stale response
// cannot undo a newer event, and nothing is applied after dispose (unmount).
import { authEventEffect, lockEffect } from "./auth-events";
import type { AuthChangeEvent } from "@supabase/supabase-js";

export type AuthStatus = "checking" | "locked" | "unlocked";

export interface IdentityControllerDeps {
  getIdentity: () => string | null | undefined;
  setIdentity: (id: string | null) => void;
  resetRuns: () => void;
  setStatus: (s: AuthStatus) => void;
}

export interface IdentityController {
  onEvent(event: AuthChangeEvent, session: { user?: { id?: string } | null } | null): void;
  // Start the initial getSession. The returned function applies its result only if no newer
  // auth event and no dispose happened in between.
  beginHydrate(): (result: { data: { session: { user?: { id?: string } | null } | null } }) => void;
  signOut(serverConfirmed: boolean): boolean;
  dispose(): void;
}

export function createIdentityController(deps: IdentityControllerDeps): IdentityController {
  let seq = 0;
  let disposed = false;
  const apply = (event: AuthChangeEvent, session: { user?: { id?: string } | null } | null) => {
    const incoming = session?.user?.id ?? null;
    const effect = authEventEffect(event, deps.getIdentity(), incoming);
    if (effect.clearRuns) deps.resetRuns();
    deps.setIdentity(effect.identity);
    deps.setStatus(session ? "unlocked" : "locked");
  };
  return {
    onEvent(event, session) {
      seq += 1;
      if (disposed) return;
      apply(event, session);
    },
    beginHydrate() {
      const mine = seq;
      return (result) => {
        if (disposed || seq !== mine) return; // a newer event or unmount won
        apply("INITIAL_SESSION", result.data.session);
      };
    },
    signOut(serverConfirmed) {
      if (disposed) return false;
      // A sign-out the server did not confirm applies nothing, so it must not invalidate a
      // pending hydration either (CD-F2). Only an applied change advances the sequence.
      const effect = lockEffect(serverConfirmed);
      if (!effect) return false;
      seq += 1;
      if (effect.clearRuns) deps.resetRuns();
      deps.setIdentity(effect.identity);
      deps.setStatus("locked");
      return true;
    },
    dispose() {
      disposed = true;
    },
  };
}
