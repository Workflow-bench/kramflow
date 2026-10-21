import { beforeEach, describe, expect, it, vi } from "vitest";

// Audit remediation KF-002 (SEC-03): every event-scoped route goes through
// requireEventAccess(), which does its own supabase.auth.getUser() rather
// than delegating to requireAuthUser() — so the must_change_password check
// has to be repeated here, not just fixed in require-auth.ts. These tests
// prove it actually is, and that the existing viewer/editor/owner role
// matrix (unrelated to this fix) still works around it.

let mockUser: Record<string, unknown> | null;
let event: { id: string; owner_id: string } | null;
let collaborator: { role: string } | null;

function userWith(id: string, mustChangePassword: boolean) {
  return { id, email: `${id}@example.com`, app_metadata: { must_change_password: mustChangePassword } };
}

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: async () => ({
    auth: { getUser: async () => ({ data: { user: mockUser } }) },
  }),
  supabaseAdmin: () => ({
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          eq: () => ({ maybeSingle: async () => ({ data: collaborator, error: null }) }),
          maybeSingle: async () => ({ data: table === "events" ? event : null, error: null }),
        }),
      }),
    }),
  }),
}));

const { requireEventAccess } = await import("./require-event-access");

beforeEach(() => {
  mockUser = null;
  event = { id: "event-a", owner_id: "owner-1" };
  collaborator = null;
});

describe("requireEventAccess — must_change_password boundary", () => {
  it("rejects a flagged owner before the role check ever runs", async () => {
    mockUser = userWith("owner-1", true);
    const res = await requireEventAccess("event-a", "viewer");
    expect(res).toBeInstanceOf(Response);
    expect((res as Response).status).toBe(403);
    expect(await (res as Response).json()).toEqual({
      ok: false,
      error: "Set a new password before continuing.",
      code: "must_change_password",
    });
  });

  it("rejects a flagged collaborator the same way", async () => {
    mockUser = userWith("collab-1", true);
    collaborator = { role: "editor" };
    const res = await requireEventAccess("event-a", "viewer");
    expect((res as Response).status).toBe(403);
  });

  it("allows an owner once the flag is cleared", async () => {
    mockUser = userWith("owner-1", false);
    const result = await requireEventAccess("event-a", "owner");
    expect(result).toEqual({ userId: "owner-1", eventId: "event-a", role: "owner" });
  });
});

describe("requireEventAccess — role matrix (unaffected by this fix, guarded against regression)", () => {
  it("resolves the event owner as role 'owner'", async () => {
    mockUser = userWith("owner-1", false);
    const result = await requireEventAccess("event-a", "owner");
    expect(result).toMatchObject({ role: "owner" });
  });

  it("resolves an accepted collaborator's own role", async () => {
    mockUser = userWith("collab-1", false);
    collaborator = { role: "editor" };
    const result = await requireEventAccess("event-a", "viewer");
    expect(result).toMatchObject({ role: "editor" });
  });

  it("403s a viewer against an owner-only minRole", async () => {
    mockUser = userWith("collab-1", false);
    collaborator = { role: "viewer" };
    const res = await requireEventAccess("event-a", "owner");
    expect((res as Response).status).toBe(403);
  });

  it("404s a user with no collaborator row and no ownership (anti-enumeration)", async () => {
    mockUser = userWith("stranger-1", false);
    collaborator = null;
    const res = await requireEventAccess("event-a", "viewer");
    expect((res as Response).status).toBe(404);
  });

  it("401s an unauthenticated caller", async () => {
    mockUser = null;
    const res = await requireEventAccess("event-a", "viewer");
    expect((res as Response).status).toBe(401);
  });
});
