import { beforeEach, describe, expect, it, vi } from "vitest";

const maybeSingle = vi.fn();
const updateEq = vi.fn(() => Promise.resolve({ error: null }));
const update = vi.fn(() => ({ eq: updateEq }));
const isRevoked = vi.fn(() => ({ maybeSingle }));
const eqTvCode = vi.fn(() => ({ is: isRevoked, maybeSingle }));
const select = vi.fn(() => ({ eq: eqTvCode }));
const from = vi.fn(() => ({ select, update }));

vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: () => ({ from }),
}));

const { generateTvCode, resolveShareLinkByTvCode, resolveShareLink } = await import("./share-links");

const future = () => new Date(Date.now() + 60_000).toISOString();
const past = () => new Date(Date.now() - 60_000).toISOString();
const row = (over: Record<string, unknown> = {}) => ({
  id: "share-1",
  token: "tok-1",
  tv_code: "482731",
  event_id: "event-1",
  label: null,
  created_by: null,
  created_at: past(),
  expires_at: future(),
  revoked_at: null,
  last_used_at: null,
  ...over,
});

beforeEach(() => {
  maybeSingle.mockReset();
  updateEq.mockClear();
  eqTvCode.mockClear();
  isRevoked.mockClear();
});

describe("generateTvCode", () => {
  it("always returns exactly six numeric digits", () => {
    for (let i = 0; i < 2000; i++) expect(generateTvCode()).toMatch(/^[0-9]{6}$/);
  });

  it("is not a predictable sequence", () => {
    const codes = new Set(Array.from({ length: 500 }, () => generateTvCode()));
    expect(codes.size).toBeGreaterThan(450);
  });
});

describe("resolveShareLinkByTvCode", () => {
  it("resolves an active share and only ever queries non-revoked rows by code", async () => {
    maybeSingle.mockResolvedValue({ data: row(), error: null });
    const result = await resolveShareLinkByTvCode("482731");
    expect(result.ok).toBe(true);
    expect(eqTvCode).toHaveBeenCalledWith("tv_code", "482731");
    expect(isRevoked).toHaveBeenCalledWith("revoked_at", null);
  });

  it("reports an unknown code as not_found", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null });
    expect(await resolveShareLinkByTvCode("000000")).toEqual({ ok: false, reason: "not_found" });
  });

  it("does not distinguish an expired share from an unknown code", async () => {
    maybeSingle.mockResolvedValue({ data: row({ expires_at: past() }), error: null });
    expect(await resolveShareLinkByTvCode("482731")).toEqual({ ok: false, reason: "not_found" });
  });

  it("does not distinguish a revoked share from an unknown code", async () => {
    maybeSingle.mockResolvedValue({ data: row({ revoked_at: past() }), error: null });
    expect(await resolveShareLinkByTvCode("482731")).toEqual({ ok: false, reason: "not_found" });
  });

  it("treats a database error as not_found", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: { message: "boom" } });
    expect(await resolveShareLinkByTvCode("482731")).toEqual({ ok: false, reason: "not_found" });
  });
});

describe("resolveShareLink (unchanged behavior, shared validity rule)", () => {
  it("still reports revoked and expired distinctly for token lookups", async () => {
    maybeSingle.mockResolvedValue({ data: row({ revoked_at: past() }), error: null });
    expect(await resolveShareLink("tok-1")).toEqual({ ok: false, reason: "revoked" });
    maybeSingle.mockResolvedValue({ data: row({ expires_at: past() }), error: null });
    expect(await resolveShareLink("tok-1")).toEqual({ ok: false, reason: "expired" });
  });
});
