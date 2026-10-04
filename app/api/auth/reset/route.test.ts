import { beforeEach, describe, expect, it, vi } from "vitest";

// Password reset request. Tests check the generic-response contract (a known
// and an unknown address get byte-identical replies), the per-IP budget, and
// that the redirect target comes from the canonical origin, not the Host header.

const resetPasswordForEmail = vi.fn();
const reserveAttempt = vi.fn();
const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: async () => ({ auth: { resetPasswordForEmail } }),
}));
vi.mock("@/lib/server/rate-limit", () => ({
  getClientIp: () => "203.0.113.7",
  reserveAttempt,
}));

const { POST } = await import("./route");
const { GENERIC_RESET_MESSAGE } = await import("@/lib/reset-message");

const req = (body: unknown, headers: Record<string, string> = {}) =>
  new Request("https://evil.example/api/auth/reset", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

beforeEach(() => {
  resetPasswordForEmail.mockReset();
  reserveAttempt.mockReset();
  consoleError.mockClear();
  reserveAttempt.mockResolvedValue({ allowed: true, retryAfterSeconds: 0 });
  resetPasswordForEmail.mockResolvedValue({ data: {}, error: null });
});

describe("POST /api/auth/reset", () => {
  it("answers a known and an unknown address with the same body and status", async () => {
    resetPasswordForEmail.mockResolvedValueOnce({ data: {}, error: null });
    const known = await POST(req({ email: "owner@example.com" }));
    resetPasswordForEmail.mockResolvedValueOnce({ data: {}, error: { message: "User not found" } });
    const unknown = await POST(req({ email: "nobody@example.com" }));
    expect(known.status).toBe(200);
    expect(unknown.status).toBe(200);
    expect(await known.text()).toBe(await unknown.text());
  });

  it("returns the shared generic message", async () => {
    const res = await POST(req({ email: "owner@example.com" }));
    expect((await res.json()).message).toBe(GENERIC_RESET_MESSAGE);
  });

  it("never returns a provider error, and logs it for the operator instead", async () => {
    resetPasswordForEmail.mockResolvedValueOnce({ data: {}, error: { message: "SECRET_PROVIDER_DETAIL" } });
    const res = await POST(req({ email: "owner@example.com" }));
    expect(res.status).toBe(200);
    expect(await res.text()).not.toContain("SECRET_PROVIDER_DETAIL");
    expect(consoleError).toHaveBeenCalled();
  });

  it("builds the redirect from the canonical origin, ignoring spoofed Host headers", async () => {
    await POST(req({ email: "owner@example.com" }, { Host: "evil.example", "X-Forwarded-Host": "evil.example" }));
    const [, options] = resetPasswordForEmail.mock.calls[0];
    expect(options.redirectTo).toBe("https://www.kramflow.me/auth/callback?next=%2Fset-password");
  });

  it("refuses an invalid address without contacting the provider", async () => {
    const res = await POST(req({ email: "not-an-email" }));
    expect(res.status).toBe(400);
    expect(resetPasswordForEmail).not.toHaveBeenCalled();
  });

  it("refuses a malformed body without contacting the provider", async () => {
    const res = await POST(req("{not json"));
    expect(res.status).toBe(400);
    expect(resetPasswordForEmail).not.toHaveBeenCalled();
  });

  it("is rate limited per IP: a limited request reaches neither the provider nor the caller's account", async () => {
    reserveAttempt.mockResolvedValueOnce({ allowed: false, retryAfterSeconds: 60 });
    const res = await POST(req({ email: "owner@example.com" }));
    expect(res.status).toBe(429);
    expect(resetPasswordForEmail).not.toHaveBeenCalled();
    expect(reserveAttempt).toHaveBeenCalledWith("reset", "203.0.113.7", expect.any(Object), expect.any(Number));
  });
});
