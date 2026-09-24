import { beforeEach, describe, expect, it, vi } from "vitest";

const reserveAttempt = vi.fn();
let configured = true;

vi.mock("@/lib/server/rate-limit", () => ({ reserveAttempt }));
vi.mock("@/lib/server/ai", () => {
  class AiError extends Error {
    constructor(
      message: string,
      readonly status: number
    ) {
      super(message);
    }
  }
  return { AiError, isAiConfigured: () => configured };
});

const { guardAi, aiErrorResponse } = await import("./ai-guard");
const { AiError } = await import("@/lib/server/ai");

beforeEach(() => {
  configured = true;
  reserveAttempt.mockReset().mockResolvedValue({ allowed: true, retryAfterSeconds: 0 });
});

describe("guardAi", () => {
  it("answers 503 when AI isn't configured, without touching the limiter", async () => {
    configured = false;
    const res = await guardAi("u1", "alert-draft");
    expect(res?.status).toBe(503);
    expect(reserveAttempt).not.toHaveBeenCalled();
  });

  it("lets an allowed request through", async () => {
    expect(await guardAi("u1", "alert-draft")).toBeNull();
  });

  it("limits per user and per feature", async () => {
    await guardAi("u1", "alert-draft");
    expect(reserveAttempt.mock.calls[0][0]).toBe("ai:alert-draft");
    expect(reserveAttempt.mock.calls[0][1]).toBe("u1");
  });

  it("answers 429 with Retry-After when the user is locked out", async () => {
    reserveAttempt.mockResolvedValue({ allowed: false, retryAfterSeconds: 42 });
    const res = await guardAi("u1", "alert-draft");
    expect(res?.status).toBe(429);
    expect(res?.headers.get("Retry-After")).toBe("42");
  });
});

describe("aiErrorResponse", () => {
  it("uses an AiError's own status and message", async () => {
    const res = aiErrorResponse(new AiError("too big", 413));
    expect(res.status).toBe(413);
    expect((await res.json()).error).toBe("too big");
  });

  it("hides unexpected errors behind a generic 500", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = aiErrorResponse(new Error("secret internals"));
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("secret");
  });
});
