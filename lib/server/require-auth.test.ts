import { beforeEach, describe, expect, it, vi } from "vitest";

// Audit remediation KF-002 (SEC-03): requireAuthUser() must reject a
// must_change_password session exactly the way requireEventAccess() does
// (see require-event-access.test.ts) — same flag, same response shape,
// shared via requirePasswordCurrent().

let mockUser: Record<string, unknown> | null;

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: async () => ({
    auth: { getUser: async () => ({ data: { user: mockUser } }) },
  }),
}));

const { requireAuth, requireAuthUser, requirePasswordCurrent } = await import("./require-auth");

function userWith(mustChangePassword: boolean) {
  return { id: "user-1", email: "op@example.com", app_metadata: { must_change_password: mustChangePassword } };
}

beforeEach(() => {
  mockUser = null;
});

describe("requireAuthUser", () => {
  it("returns 401 for no session", async () => {
    mockUser = null;
    const res = await requireAuthUser();
    expect(res).toBeInstanceOf(Response);
    expect((res as Response).status).toBe(401);
  });

  it("returns 403 must_change_password for a flagged session, before reaching the caller", async () => {
    mockUser = userWith(true);
    const res = await requireAuthUser();
    expect(res).toBeInstanceOf(Response);
    expect((res as Response).status).toBe(403);
    expect(await (res as Response).json()).toEqual({
      ok: false,
      error: "Set a new password before continuing.",
      code: "must_change_password",
    });
  });

  it("returns the user for a normal session", async () => {
    mockUser = userWith(false);
    const result = await requireAuthUser();
    expect(result).toEqual({ user: mockUser });
  });

  it("treats a missing must_change_password flag the same as false", async () => {
    mockUser = { id: "user-1", email: "op@example.com", app_metadata: {} };
    const result = await requireAuthUser();
    expect(result).toEqual({ user: mockUser });
  });
});

describe("requireAuth (boolean wrapper)", () => {
  it("returns the 403 response for a flagged session", async () => {
    mockUser = userWith(true);
    const res = await requireAuth();
    expect(res).not.toBeNull();
    expect((res as Response).status).toBe(403);
  });

  it("returns null for a normal session", async () => {
    mockUser = userWith(false);
    const res = await requireAuth();
    expect(res).toBeNull();
  });
});

describe("requirePasswordCurrent", () => {
  it("blocks a flagged user", () => {
    const res = requirePasswordCurrent(userWith(true) as never);
    expect(res).not.toBeNull();
    expect(res?.status).toBe(403);
  });

  it("passes a normal user", () => {
    const res = requirePasswordCurrent(userWith(false) as never);
    expect(res).toBeNull();
  });
});
