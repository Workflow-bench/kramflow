import { describe, it, expect, vi, beforeEach } from "vitest";

// The actual increment/lockout/doubling logic now lives in the
// check_and_record_rate_limit Postgres RPC (supabase/migrations/
// 0003_rate_limits.sql) — exercised directly against a live database in
// this task's manual verification (see the PR description), since that's
// real server-side SQL, not something to reimplement against a mock here.
// What's left to unit-test at this layer is rate-limit.ts's own logic:
// how it interprets the RPC/table response, and that it fails open (never
// throws) on a Supabase error.
const maybeSingle = vi.fn();
const select = vi.fn(() => ({ eq: () => ({ eq: () => ({ maybeSingle }) }) }));
const rpc = vi.fn();
const from = vi.fn(() => ({ select }));

vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: () => ({ from, rpc }),
}));

const { checkRateLimit, recordFailure, recordSuccess } = await import("./rate-limit");

beforeEach(() => {
  maybeSingle.mockReset();
  rpc.mockReset();
});

describe("checkRateLimit", () => {
  it("allows the request when no row exists for this bucket/ip", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null });
    const result = await checkRateLimit("login", "1.2.3.4");
    expect(result).toEqual({ allowed: true, retryAfterSeconds: 0 });
  });

  it("blocks the request and reports remaining seconds when locked_until is in the future", async () => {
    const lockedUntil = new Date(Date.now() + 45_000).toISOString();
    maybeSingle.mockResolvedValue({ data: { locked_until: lockedUntil }, error: null });
    const result = await checkRateLimit("login", "1.2.3.4");
    expect(result.allowed).toBe(false);
    expect(result.retryAfterSeconds).toBeGreaterThan(40);
    expect(result.retryAfterSeconds).toBeLessThanOrEqual(45);
  });

  it("allows the request when locked_until has already passed", async () => {
    const lockedUntil = new Date(Date.now() - 1000).toISOString();
    maybeSingle.mockResolvedValue({ data: { locked_until: lockedUntil }, error: null });
    const result = await checkRateLimit("login", "1.2.3.4");
    expect(result).toEqual({ allowed: true, retryAfterSeconds: 0 });
  });

  it("fails open (allows the request) on a Supabase error rather than locking everyone out", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: { message: "connection refused" } });
    const result = await checkRateLimit("login", "1.2.3.4");
    expect(result).toEqual({ allowed: true, retryAfterSeconds: 0 });
  });
});

describe("recordFailure / recordSuccess", () => {
  it("calls the RPC with p_success: false and this module's fixed threshold/lockout constants", async () => {
    rpc.mockResolvedValue({ error: null });
    await recordFailure("login", "1.2.3.4");
    expect(rpc).toHaveBeenCalledWith("check_and_record_rate_limit", {
      p_bucket: "login",
      p_ip: "1.2.3.4",
      p_success: false,
      p_threshold: 8,
      p_base_lockout_ms: 30_000,
      p_max_lockout_ms: 300_000,
    });
  });

  it("calls the RPC with p_success: true", async () => {
    rpc.mockResolvedValue({ error: null });
    await recordSuccess("login", "1.2.3.4");
    expect(rpc).toHaveBeenCalledWith(
      "check_and_record_rate_limit",
      expect.objectContaining({ p_success: true })
    );
  });

  it("does not throw when the RPC call itself errors (fails open)", async () => {
    rpc.mockResolvedValue({ error: { message: "timeout" } });
    await expect(recordFailure("login", "1.2.3.4")).resolves.toBeUndefined();
  });
});
