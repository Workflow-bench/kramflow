import { describe, expect, it } from "vitest";
import type { AuthChangeEvent } from "@supabase/supabase-js";
import { authEventEffect, lockEffect } from "./auth-events";

// Every event in the installed SDK's AuthChangeEvent union. The Record type makes this fail
// to compile when the SDK adds an event that is not listed here (CB-F2).
const ALL_EVENTS: Record<AuthChangeEvent, true> = {
  INITIAL_SESSION: true,
  PASSWORD_RECOVERY: true,
  SIGNED_IN: true,
  SIGNED_OUT: true,
  TOKEN_REFRESHED: true,
  USER_UPDATED: true,
  MFA_CHALLENGE_VERIFIED: true,
};

describe("auth event policy (identity-aware)", () => {
  it("same-user re-establishment (SIGNED_IN refocus) keeps runs", () => {
    expect(authEventEffect("SIGNED_IN", "user-a", "user-a")).toEqual({ identity: "user-a", clearRuns: false });
  });

  it("token refresh, reload and recovery for the same user keep runs", () => {
    expect(authEventEffect("TOKEN_REFRESHED", "user-a", "user-a").clearRuns).toBe(false);
    expect(authEventEffect("INITIAL_SESSION", "user-a", "user-a").clearRuns).toBe(false);
    expect(authEventEffect("PASSWORD_RECOVERY", "user-a", "user-a").clearRuns).toBe(false);
  });

  it("a same-user account update does not erase progress", () => {
    expect(authEventEffect("USER_UPDATED", "user-a", "user-a")).toEqual({ identity: "user-a", clearRuns: false });
  });

  it("an account boundary (A to B) clears runs and sets the new identity", () => {
    expect(authEventEffect("SIGNED_IN", "user-a", "user-b")).toEqual({ identity: "user-b", clearRuns: true });
    expect(authEventEffect("USER_UPDATED", "user-a", "user-b").clearRuns).toBe(true);
  });

  it("unknown previous identity adopts the incoming identity without clearing", () => {
    expect(authEventEffect("INITIAL_SESSION", undefined, "user-a")).toEqual({ identity: "user-a", clearRuns: false });
  });

  it("a confirmed signed-out state followed by a sign-in is a boundary", () => {
    expect(authEventEffect("SIGNED_IN", null, "user-a").clearRuns).toBe(true);
  });

  it("SIGNED_OUT always clears and sets identity null", () => {
    expect(authEventEffect("SIGNED_OUT", "user-a", null)).toEqual({ identity: null, clearRuns: true });
  });

  it("a failed server sign-out changes nothing; a confirmed one clears", () => {
    expect(lockEffect(false)).toBeNull();
    expect(lockEffect(true)).toEqual({ identity: null, clearRuns: true });
  });

  it("every installed SDK event returns a valid effect and never throws", () => {
    for (const event of Object.keys(ALL_EVENTS) as AuthChangeEvent[]) {
      for (const [prev, incoming] of [[undefined, "user-a"], ["user-a", "user-a"], ["user-a", "user-b"], [null, null]] as const) {
        const e = authEventEffect(event, prev, incoming);
        expect(e.identity === null || typeof e.identity === "string").toBe(true);
        expect(typeof e.clearRuns).toBe("boolean");
      }
    }
  });
});
