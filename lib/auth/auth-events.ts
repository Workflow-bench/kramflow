// Policy for what the auth provider does on each Supabase auth event. Pure, so the
// ordering rules can be tested without a Supabase client. The provider calls these.
//
// identity: the user id the browser should treat as signed in (null = none).
// clearRuns: whether per-viewer rehearsal runs must be discarded.

export type AuthEventName =
  | "INITIAL_SESSION"
  | "SIGNED_IN"
  | "SIGNED_OUT"
  | "USER_UPDATED"
  | "TOKEN_REFRESHED"
  | "PASSWORD_RECOVERY";

export interface AuthEventEffect {
  identity: string | null;
  clearRuns: boolean;
}

export function authEventEffect(event: AuthEventName, userId: string | null): AuthEventEffect {
  switch (event) {
    case "SIGNED_OUT":
      return { identity: null, clearRuns: true };
    case "SIGNED_IN":
    case "USER_UPDATED":
      // A sign-in or an account change may be a different person on this browser.
      return { identity: userId, clearRuns: true };
    case "INITIAL_SESSION":
    case "TOKEN_REFRESHED":
    case "PASSWORD_RECOVERY":
      // A reload or a refreshed token is the same person: runs stay.
      return { identity: userId, clearRuns: false };
  }
}

// Sign-out is clearing only when the server confirmed it. A failed attempt keeps the
// identity and the runs, so the operator is not silently logged out of their own state.
export function lockEffect(serverConfirmedSignOut: boolean): { identity: string | null; clearRuns: boolean } | null {
  return serverConfirmedSignOut ? { identity: null, clearRuns: true } : null;
}
