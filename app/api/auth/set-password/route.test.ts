import { beforeEach, describe, expect, it, vi } from "vitest";

// Password replacement (temp password -> real password) and the reauthentication
// that follows it. Supabase is mocked at the module boundary; the handler runs for
// real. Covers: unauthenticated refusal, length floor, admin replacement with the
// must_change_password flag cleared, the follow-up sign-in, and the fallback when
// the sign-in fails after a successful change. Secrets must not appear in replies.

const getUser = vi.fn();
const signInWithPassword = vi.fn();
const updateUserById = vi.fn();
const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: async () => ({ auth: { getUser, signInWithPassword } }),
  supabaseAdmin: () => ({ auth: { admin: { updateUserById } } }),
}));

const { POST } = await import("./route");

const NEW_PASSWORD = "correct-horse-battery";
const req = (body: unknown) =>
  new Request("https://www.kramflow.me/api/auth/set-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

beforeEach(() => {
  getUser.mockReset();
  signInWithPassword.mockReset();
  updateUserById.mockReset();
  consoleError.mockClear();
  getUser.mockResolvedValue({ data: { user: { id: "user-1", email: "owner@example.com" } } });
  updateUserById.mockResolvedValue({ data: {}, error: null });
  signInWithPassword.mockResolvedValue({ data: {}, error: null });
});

describe("POST /api/auth/set-password", () => {
  it("refuses without a signed-in session and changes nothing", async () => {
    getUser.mockResolvedValueOnce({ data: { user: null } });
    const res = await POST(req({ password: NEW_PASSWORD }));
    expect(res.status).toBe(401);
    expect(updateUserById).not.toHaveBeenCalled();
    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  it("refuses a password shorter than 8 characters before touching the account", async () => {
    const res = await POST(req({ password: "short" }));
    expect(res.status).toBe(400);
    expect(updateUserById).not.toHaveBeenCalled();
  });

  it("refuses a missing or non-string password", async () => {
    expect((await POST(req({}))).status).toBe(400);
    expect((await POST(req({ password: 12345678 }))).status).toBe(400);
    expect(updateUserById).not.toHaveBeenCalled();
  });

  it("replaces the password for the signed-in user and clears must_change_password", async () => {
    const res = await POST(req({ password: NEW_PASSWORD }));
    expect(res.status).toBe(200);
    expect(updateUserById).toHaveBeenCalledTimes(1);
    expect(updateUserById).toHaveBeenCalledWith("user-1", {
      password: NEW_PASSWORD,
      app_metadata: { must_change_password: false },
    });
  });

  it("reauthenticates with the new password on the same session after the change", async () => {
    await POST(req({ password: NEW_PASSWORD }));
    expect(signInWithPassword).toHaveBeenCalledWith({ email: "owner@example.com", password: NEW_PASSWORD });
    const replacedFirst = updateUserById.mock.invocationCallOrder[0];
    const reauthAfter = signInWithPassword.mock.invocationCallOrder[0];
    expect(reauthAfter).toBeGreaterThan(replacedFirst);
  });

  it("reports reauthFailed (not an error) when the change succeeded but sign-in did not", async () => {
    signInWithPassword.mockResolvedValueOnce({ data: {}, error: { message: "Invalid login credentials" } });
    const res = await POST(req({ password: NEW_PASSWORD }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, reauthFailed: true });
  });

  it("returns a generic 500 when the admin replacement fails, and never echoes the provider detail or the password", async () => {
    updateUserById.mockResolvedValueOnce({ data: {}, error: { message: "SECRET_ADMIN_DETAIL" } });
    const res = await POST(req({ password: NEW_PASSWORD }));
    const text = await res.text();
    expect(res.status).toBe(500);
    expect(text).not.toContain("SECRET_ADMIN_DETAIL");
    expect(text).not.toContain(NEW_PASSWORD);
    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  it("never includes the new password in any success reply", async () => {
    const res = await POST(req({ password: NEW_PASSWORD }));
    expect(await res.text()).not.toContain(NEW_PASSWORD);
  });
});
