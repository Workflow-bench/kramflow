// Policy for auth events and rehearsal runs. Pure, so the ordering rules are testable. The
// provider consumes it through identity-controller.ts; nothing here touches React or Supabase.
//
// prev: the identity the browser last confirmed. undefined = unknown (no auth result yet);
//       null = confirmed signed out; string = user id.
// incoming: the user id the event carries (null when the event has no session).
//
// Rules:
// - Same user, any event (SIGNED_IN refocus or re-established session, TOKEN_REFRESHED,
//   INITIAL_SESSION, USER_UPDATED, MFA_CHALLENGE_VERIFIED, PASSWORD_RECOVERY): keep runs.
// - Unknown previous identity: adopt the incoming identity, keep runs (keys are per user).
// - Confirmed identity change (A to B, signed-out to user, user to signed-out without a
//   SIGNED_OUT event): clear every rehearsal run.
// - SIGNED_OUT: clear, identity null.
import type { AuthChangeEvent } from "@supabase/supabase-js";

export interface AuthEventEffect {
  identity: string | null;
  clearRuns: boolean;
}

export function authEventEffect(
  event: AuthChangeEvent,
  prev: string | null | undefined,
  incoming: string | null
): AuthEventEffect {
  if (event === "SIGNED_OUT") return { identity: null, clearRuns: true };
  // Every other event, including ones added to the installed SDK later, takes the same rule.
  const boundary = prev !== undefined && prev !== incoming;
  return { identity: incoming, clearRuns: boundary };
}

// A sign-out the server did not confirm changes nothing. A confirmed one clears.
export function lockEffect(serverConfirmedSignOut: boolean): AuthEventEffect | null {
  return serverConfirmedSignOut ? { identity: null, clearRuns: true } : null;
}
