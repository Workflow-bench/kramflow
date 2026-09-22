import { beforeEach, describe, expect, it, vi } from "vitest";

const exchangeCodeForSession = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: async () => ({ auth: { exchangeCodeForSession } }),
}));

const { GET } = await import("./route");

const call = (query: string) => GET(new Request(`https://www.kramflow.me/auth/callback?${query}`));
const location = (res: Response) => res.headers.get("location");

beforeEach(() => exchangeCodeForSession.mockReset().mockResolvedValue({ error: null }));

describe("GET /auth/callback redirect target", () => {
  it("follows a same-origin next path after a successful exchange", async () => {
    expect(location(await call("code=abc&next=/e/123/operator"))).toBe("https://www.kramflow.me/e/123/operator");
  });

  it("defaults to the dashboard when next is absent", async () => {
    expect(location(await call("code=abc"))).toBe("https://www.kramflow.me/dashboard");
  });

  it.each(["https://evil.com", "//evil.com", "/\\evil.com", "javascript:alert(1)"])(
    "never redirects off-site for next=%s",
    async (next) => {
      const target = location(await call(`code=abc&next=${encodeURIComponent(next)}`));
      expect(new URL(target!).origin).toBe("https://www.kramflow.me");
      expect(target).toBe("https://www.kramflow.me/dashboard");
    }
  );

  it("sends a failed exchange to login regardless of next", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: new Error("expired") });
    expect(location(await call("code=abc&next=https://evil.com"))).toBe("https://www.kramflow.me/login");
  });

  it("sends a missing code to login", async () => {
    expect(location(await call("next=/dashboard"))).toBe("https://www.kramflow.me/login");
  });
});
