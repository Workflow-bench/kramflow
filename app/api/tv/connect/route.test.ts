import { beforeEach, describe, expect, it, vi } from "vitest";

const reserveAttempt = vi.fn();
const refundAttempt = vi.fn();
const resolveShareLinkByTvCode = vi.fn();

vi.mock("@/lib/server/rate-limit", () => ({
  getClientIp: () => "1.2.3.4",
  reserveAttempt,
  refundAttempt,
}));
vi.mock("@/lib/server/share-links", () => ({ resolveShareLinkByTvCode }));

const { POST } = await import("./route");

const post = (body: unknown) =>
  POST(new Request("http://x/api/tv/connect", { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) }));

beforeEach(() => {
  reserveAttempt.mockReset().mockResolvedValue({ allowed: true, retryAfterSeconds: 0 });
  refundAttempt.mockReset();
  resolveShareLinkByTvCode.mockReset();
});

describe("POST /api/tv/connect", () => {
  it("returns only the /screens path for a valid code, and refunds the attempt", async () => {
    resolveShareLinkByTvCode.mockResolvedValue({ ok: true, link: { token: "abc_DEF-123", event_id: "e1", id: "s1" } });
    const res = await post({ code: "482 731" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true, href: "/screens?token=abc_DEF-123" });
    expect(resolveShareLinkByTvCode).toHaveBeenCalledWith("482731");
    expect(refundAttempt).toHaveBeenCalledTimes(1);
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("returns one generic message for a code that does not resolve, and never refunds", async () => {
    resolveShareLinkByTvCode.mockResolvedValue({ ok: false, reason: "not_found" });
    const res = await post({ code: "000000" });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ ok: false, error: "Invalid or expired code." });
    expect(refundAttempt).not.toHaveBeenCalled();
  });

  it("rejects malformed input with the same message, without any lookup", async () => {
    for (const code of ["", "1", "12345", "1234567", "12345a", "12-345", null, 482731]) {
      const res = await post({ code });
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ ok: false, error: "Invalid or expired code." });
    }
    expect((await post("not json")).status).toBe(400);
    expect(resolveShareLinkByTvCode).not.toHaveBeenCalled();
    expect(refundAttempt).not.toHaveBeenCalled();
  });

  it("throttles before doing any lookup once the reservation is denied", async () => {
    reserveAttempt.mockResolvedValue({ allowed: false, retryAfterSeconds: 60 });
    const res = await post({ code: "482731" });
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("60");
    expect(resolveShareLinkByTvCode).not.toHaveBeenCalled();
  });

  it("does not put the submitted code in the response on failure", async () => {
    resolveShareLinkByTvCode.mockResolvedValue({ ok: false, reason: "not_found" });
    const res = await post({ code: "482731" });
    expect(JSON.stringify(await res.json())).not.toContain("482731");
  });
});
