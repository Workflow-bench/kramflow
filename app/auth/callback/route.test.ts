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

  it("a failed exchange with an off-site next goes to login with a generic marker and no destination", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: new Error("expired") });
    expect(location(await call("code=abc&next=https://evil.com"))).toBe("https://www.kramflow.me/login?link=expired");
  });

  it("a failed exchange keeps a validated same-origin next for login to continue to", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: new Error("already used") });
    expect(location(await call("code=abc&next=/e/123/operator"))).toBe(
      "https://www.kramflow.me/login?link=expired&next=%2Fe%2F123%2Foperator"
    );
  });

  it("a reused code (second exchange fails) is treated the same as expired, with no provider detail in the URL", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: new Error("code verifier mismatch: secret-detail") });
    const target = location(await call("code=abc&next=/dashboard"));
    expect(target).toBe("https://www.kramflow.me/login?link=expired&next=%2Fdashboard");
    expect(target).not.toContain("secret-detail");
  });

  it("sends a missing code to login without the expired marker", async () => {
    expect(location(await call("next=/dashboard"))).toBe("https://www.kramflow.me/login");
  });
});
