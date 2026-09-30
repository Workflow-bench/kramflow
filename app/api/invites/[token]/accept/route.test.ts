import { beforeEach, describe, expect, it, vi } from "vitest";

// Audit remediation KF-002 / R2 (Codex Phase 1 review): a must_change_
// password session used to be able to accept a real invite by matching
// its email — wrong, per the master contract ("event reads, invite
// acceptance, cue edits... until replacement completes"). Proves the flag
// is checked before resolveInvite() even runs, that a denied call leaves
// the collaborator row completely untouched, and that every other
// existing behavior (wrong email, expired, already-accepted, anonymous,
// and a legitimate unflagged acceptance) is unchanged.

let mockUser: Record<string, unknown> | null;
const resolveInvite = vi.fn();
const update = vi.fn();
const eqImpl = vi.fn(() => ({ error: null }));
const eq = eqImpl as unknown as (column: string, id: unknown) => { error: null };

function userWith(email: string, mustChangePassword: boolean) {
  return { id: "user-1", email, app_metadata: { must_change_password: mustChangePassword } };
}

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: async () => ({ auth: { getUser: async () => ({ data: { user: mockUser } }) } }),
  supabaseAdmin: () => ({
    from: () => ({
      update: (patch: Record<string, unknown>) => {
        update(patch);
        return { eq: (column: string, id: unknown) => eq(column, id) };
      },
    }),
  }),
}));
vi.mock("@/lib/server/collaborator-invites", () => ({ resolveInvite }));

const { POST } = await import("./route");

const params = { params: Promise.resolve({ token: "tok-a" }) };
const post = () => POST(new Request("http://x/api/invites/tok-a/accept", { method: "POST" }), params);

const validInvite = {
  ok: true,
  invite: { id: "invite-1", invited_email: "collab@example.com", event_id: "event-a" },
  event: { id: "event-a", name: "Northwind Summit 2026" },
};

beforeEach(() => {
  mockUser = null;
  resolveInvite.mockReset().mockResolvedValue(validInvite);
  update.mockReset();
  eqImpl.mockReset().mockReturnValue({ error: null });
});

describe("POST /api/invites/[token]/accept — must_change_password boundary", () => {
  it("denies a flagged session before resolveInvite() ever runs", async () => {
    mockUser = userWith("collab@example.com", true);

    const res = await post();

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({
      ok: false,
      error: "Set a new password before continuing.",
      code: "must_change_password",
    });
    expect(resolveInvite).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("succeeds for the correct email once the flag is cleared", async () => {
    mockUser = userWith("collab@example.com", false);

    const res = await post();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, eventId: "event-a", eventName: "Northwind Summit 2026" });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: "user-1", status: "accepted" })
    );
  });
});

describe("POST /api/invites/[token]/accept — preserved behavior", () => {
  it("401s an unauthenticated caller, unchanged", async () => {
    mockUser = null;
    const res = await post();
    expect(res.status).toBe(401);
    expect(resolveInvite).not.toHaveBeenCalled();
  });

  it("403s a wrong-email session, unchanged, after the password check passes", async () => {
    mockUser = userWith("someone-else@example.com", false);
    const res = await post();
    expect(res.status).toBe(403);
    expect(update).not.toHaveBeenCalled();
  });

  it("404s an expired invite, unchanged", async () => {
    mockUser = userWith("collab@example.com", false);
    resolveInvite.mockResolvedValue({ ok: false, reason: "expired" });
    const res = await post();
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ ok: false, error: "This invite has expired. Ask the event owner to send a new one." });
  });

  it("404s an already-accepted invite, unchanged", async () => {
    mockUser = userWith("collab@example.com", false);
    resolveInvite.mockResolvedValue({ ok: false, reason: "already_accepted" });
    const res = await post();
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ ok: false, error: "This invite has already been accepted." });
  });
});
