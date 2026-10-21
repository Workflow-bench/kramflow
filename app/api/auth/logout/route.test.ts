import { describe, it, expect, vi, beforeEach } from "vitest";

const signOut = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: async () => ({ auth: { signOut } }),
}));

import { POST } from "./route";

beforeEach(() => {
  signOut.mockReset();
});

describe("POST /api/auth/logout", () => {
  it("reports ok only when signOut succeeds", async () => {
    signOut.mockResolvedValue({ error: null });
    const res = await POST();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
  it("reports failure, not success, when signOut errors", async () => {
    signOut.mockResolvedValue({ error: { message: "network down" } });
    const res = await POST();
    expect(res.status).toBe(500);
    expect((await res.json()).ok).toBe(false);
  });
});
