import { describe, expect, it, beforeEach, vi } from "vitest";
import { createHash } from "node:crypto";
import { NextResponse } from "next/server";

const maybeSingle = vi.fn();
const updateEq = vi.fn();
const update = vi.fn(() => ({ eq: updateEq }));
const eq = vi.fn(() => ({ maybeSingle }));
const select = vi.fn(() => ({ eq }));
const from = vi.fn(() => ({ select, update }));

vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: () => ({ from }),
}));

const { createIntegrationToken, hashIntegrationToken, requireIntegrationCredential } = await import("./integration-credentials");

const req = (authorization?: string) =>
  new Request("http://x/api/v1/events/event-a/state", {
    headers: authorization ? { authorization } : undefined,
  });

const credential = (overrides: Record<string, unknown> = {}) => ({
  id: "cred-1",
  event_id: "event-a",
  label: "Companion",
  scopes: ["state:read", "live:control"],
  revoked_at: null,
  ...overrides,
});

beforeEach(() => {
  maybeSingle.mockReset();
  updateEq.mockClear();
  eq.mockClear();
  select.mockClear();
  from.mockClear();
});

describe("integration credential tokens", () => {
  it("creates URL-safe live tokens with the expected prefix", () => {
    const token = createIntegrationToken();
    expect(token).toMatch(/^kf_live_[A-Za-z0-9_-]+$/);
    expect(token.length).toBeGreaterThan(40);
  });

  it("hashes tokens with sha256 hex, not reversible storage", () => {
    expect(hashIntegrationToken("kf_live_test")).toBe(
      createHash("sha256").update("kf_live_test").digest("hex")
    );
    expect(hashIntegrationToken("kf_live_test")).not.toContain("kf_live_test");
  });
});

describe("requireIntegrationCredential", () => {
  it("accepts a valid bearer token for the requested event and scope", async () => {
    maybeSingle.mockResolvedValue({ data: credential(), error: null });

    const result = await requireIntegrationCredential(req("Bearer kf_live_valid"), "event-a", "state:read");

    expect(result).toEqual({ id: "cred-1", eventId: "event-a", label: "Companion" });
    expect(eq).toHaveBeenCalledWith("token_hash", hashIntegrationToken("kf_live_valid"));
    expect(updateEq).toHaveBeenCalledWith("id", "cred-1");
  });

  it("rejects missing, non-bearer, and oversized authorization headers before querying", async () => {
    for (const authorization of [undefined, "Basic abc", `Bearer ${"x".repeat(257)}`]) {
      const result = await requireIntegrationCredential(req(authorization), "event-a", "state:read");
      expect(result).toBeInstanceOf(NextResponse);
      expect((result as NextResponse).status).toBe(401);
    }
    expect(from).not.toHaveBeenCalled();
  });

  it("rejects a valid token hash for a different event", async () => {
    maybeSingle.mockResolvedValue({ data: credential({ event_id: "event-b" }), error: null });

    const result = await requireIntegrationCredential(req("Bearer kf_live_valid"), "event-a", "state:read");

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(401);
    expect(updateEq).not.toHaveBeenCalled();
  });

  it("rejects revoked credentials and credentials missing the required scope", async () => {
    maybeSingle.mockResolvedValueOnce({ data: credential({ revoked_at: new Date().toISOString() }), error: null });
    const revoked = await requireIntegrationCredential(req("Bearer kf_live_valid"), "event-a", "state:read");
    expect(revoked).toBeInstanceOf(NextResponse);
    expect((revoked as NextResponse).status).toBe(401);

    maybeSingle.mockResolvedValueOnce({ data: credential({ scopes: ["state:read"] }), error: null });
    const wrongScope = await requireIntegrationCredential(req("Bearer kf_live_valid"), "event-a", "live:control");
    expect(wrongScope).toBeInstanceOf(NextResponse);
    expect((wrongScope as NextResponse).status).toBe(401);
  });

  it("treats lookup errors and missing rows as unauthorized", async () => {
    maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    const missing = await requireIntegrationCredential(req("Bearer kf_live_valid"), "event-a", "state:read");
    expect(missing).toBeInstanceOf(NextResponse);
    expect((missing as NextResponse).status).toBe(401);

    maybeSingle.mockResolvedValueOnce({ data: null, error: { message: "boom" } });
    const errored = await requireIntegrationCredential(req("Bearer kf_live_valid"), "event-a", "state:read");
    expect(errored).toBeInstanceOf(NextResponse);
    expect((errored as NextResponse).status).toBe(401);
  });
});
