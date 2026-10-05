import { describe, expect, it } from "vitest";
import { createIdentityController, type AuthStatus } from "./identity-controller";

// Controlled provider integration. The controller is the same code the auth provider
// consumes; the fakes stand in for the identity holder, the rehearsal-run store and the
// status setter. Events and getSession responses are driven explicitly, so ordering is
// deterministic. Labelled controlled seam: no Supabase client and no real auth submission.

type Session = { user?: { id?: string } | null } | null;

function harness() {
  const runs = new Map<string, string>(); // identity -> progress, a stand-in for per-user runs
  let identity: string | null | undefined = undefined;
  let status: AuthStatus = "checking";
  const clears: number[] = [];
  const ctl = createIdentityController({
    getIdentity: () => identity,
    setIdentity: (id) => { identity = id; },
    resetRuns: () => { clears.push(clears.length + 1); runs.clear(); },
    setStatus: (s) => { status = s; },
  });
  const progress = (who: string, value: string) => runs.set(who, value);
  const seen = (who: string) => runs.get(who) ?? null;
  return { ctl, progress, seen, clears, get identity() { return identity; }, get status() { return status; }, runs };
}

const user = (id: string): Session => ({ user: { id } });
const session = (res: { data: { session: Session } }) => res;

describe("controlled provider integration (CB-F1 identity-aware runs)", () => {
  it("A progresses; same-A SIGNED_IN refocus, TOKEN_REFRESHED and reload all preserve progress", () => {
    const h = harness();
    h.ctl.beginHydrate()(session({ data: { session: user("a") } }));
    h.progress("a", "cue 2");
    h.ctl.onEvent("SIGNED_IN", user("a"));
    h.ctl.onEvent("TOKEN_REFRESHED", user("a"));
    h.ctl.beginHydrate()(session({ data: { session: user("a") } })); // reload
    expect(h.seen("a")).toBe("cue 2");
    expect(h.clears).toHaveLength(0);
    expect(h.status).toBe("unlocked");
  });

  it("A to B exposes no A run, and B's own progress is isolated from A", () => {
    const h = harness();
    h.ctl.beginHydrate()(session({ data: { session: user("a") } }));
    h.progress("a", "cue 2");
    h.ctl.onEvent("SIGNED_IN", user("b"));
    expect(h.seen("a")).toBeNull();
    expect(h.identity).toBe("b");
  });

  it("a failed server sign-out preserves identity and progress", () => {
    const h = harness();
    h.ctl.onEvent("SIGNED_IN", user("b"));
    h.progress("b", "cue 2");
    expect(h.ctl.signOut(false)).toBe(false);
    expect(h.identity).toBe("b");
    expect(h.seen("b")).toBe("cue 2");
    expect(h.status).toBe("unlocked");
  });

  it("a confirmed sign-out clears runs and sets signed-out", () => {
    const h = harness();
    h.ctl.onEvent("SIGNED_IN", user("a"));
    h.progress("a", "cue 2");
    expect(h.ctl.signOut(true)).toBe(true);
    expect(h.identity).toBeNull();
    expect(h.seen("a")).toBeNull();
    expect(h.status).toBe("locked");
  });

  it("a stale initial-session response cannot undo a newer sign-out", () => {
    const h = harness();
    const applyLate = h.ctl.beginHydrate(); // getSession starts (still in flight)
    h.ctl.onEvent("SIGNED_OUT", null); // a newer event lands first
    applyLate(session({ data: { session: user("a") } })); // the stale result arrives late
    expect(h.identity).toBeNull();
    expect(h.status).toBe("locked");
  });

  it("a stale initial-session response cannot undo a newer account switch", () => {
    const h = harness();
    const applyLate = h.ctl.beginHydrate();
    h.progress("b", "cue 3");
    h.ctl.onEvent("SIGNED_IN", user("b"));
    applyLate(session({ data: { session: user("a") } }));
    expect(h.identity).toBe("b");
    expect(h.seen("b")).toBe("cue 3");
  });

  it("after unmount (dispose), a late getSession result and late events are ignored", () => {
    const h = harness();
    const applyLate = h.ctl.beginHydrate();
    h.ctl.dispose();
    applyLate(session({ data: { session: user("a") } }));
    h.ctl.onEvent("SIGNED_IN", user("b"));
    expect(h.identity).toBeUndefined();
    expect(h.ctl.signOut(true)).toBe(false);
  });

  it("MFA_CHALLENGE_VERIFIED for the same user preserves progress and does not throw", () => {
    const h = harness();
    h.ctl.onEvent("SIGNED_IN", user("a"));
    h.progress("a", "cue 2");
    expect(() => h.ctl.onEvent("MFA_CHALLENGE_VERIFIED", user("a"))).not.toThrow();
    expect(h.seen("a")).toBe("cue 2");
  });

  it("a failed sign-out during hydration does not discard the valid initial session (CD-F2)", () => {
    const h = harness();
    const applyLate = h.ctl.beginHydrate();
    expect(h.ctl.signOut(false)).toBe(false);
    applyLate(session({ data: { session: user("a") } }));
    expect(h.identity).toBe("a");
    expect(h.status).toBe("unlocked");
  });

  it("a confirmed sign-out still rejects a stale initial session that started before it", () => {
    const h = harness();
    const applyLate = h.ctl.beginHydrate();
    expect(h.ctl.signOut(true)).toBe(true);
    applyLate(session({ data: { session: user("a") } }));
    expect(h.identity).toBeNull();
    expect(h.status).toBe("locked");
  });
});
