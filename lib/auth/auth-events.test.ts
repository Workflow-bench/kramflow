import { describe, expect, it } from "vitest";
import { authEventEffect, lockEffect } from "./auth-events";

describe("auth event effects on rehearsal runs and identity", () => {
  it("token refresh and reload keep the identity and the runs", () => {
    expect(authEventEffect("TOKEN_REFRESHED", "user-a")).toEqual({ identity: "user-a", clearRuns: false });
    expect(authEventEffect("INITIAL_SESSION", "user-a")).toEqual({ identity: "user-a", clearRuns: false });
    expect(authEventEffect("PASSWORD_RECOVERY", "user-a")).toEqual({ identity: "user-a", clearRuns: false });
  });

  it("a sign-in as a different user sets the new identity and clears runs", () => {
    expect(authEventEffect("SIGNED_IN", "user-b")).toEqual({ identity: "user-b", clearRuns: true });
  });

  it("an account update clears runs but keeps the same identity", () => {
    expect(authEventEffect("USER_UPDATED", "user-a")).toEqual({ identity: "user-a", clearRuns: true });
  });

  it("a sign-out event clears the identity and the runs", () => {
    expect(authEventEffect("SIGNED_OUT", null)).toEqual({ identity: null, clearRuns: true });
  });

  it("a sign-out the server did not confirm changes nothing", () => {
    expect(lockEffect(false)).toBeNull();
  });

  it("a confirmed sign-out clears the identity and the runs", () => {
    expect(lockEffect(true)).toEqual({ identity: null, clearRuns: true });
  });

  it("ordering: refresh, then account switch, then failed sign-out, then confirmed sign-out", () => {
    const steps = [
      authEventEffect("TOKEN_REFRESHED", "user-a"),
      authEventEffect("SIGNED_IN", "user-b"),
      lockEffect(false),
      lockEffect(true),
    ];
    expect(steps[0]).toEqual({ identity: "user-a", clearRuns: false });
    expect(steps[1]).toEqual({ identity: "user-b", clearRuns: true });
    expect(steps[2]).toBeNull();
    expect(steps[3]).toEqual({ identity: null, clearRuns: true });
  });
});
