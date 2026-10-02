import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requireEventAccess = vi.fn();

let rows: { id: string }[];
let dbError: unknown;
let updated: Record<string, unknown> | null;
let deleted: boolean;
const filters: [string, unknown][] = [];

function query() {
  const q = {
    update: (patch: Record<string, unknown>) => {
      updated = patch;
      return q;
    },
    delete: () => {
      deleted = true;
      return q;
    },
    eq: (col: string, val: unknown) => {
      filters.push([col, val]);
      return q;
    },
    select: async () => (dbError ? { data: null, error: dbError } : { data: rows, error: null }),
  };
  return q;
}

vi.mock("@/lib/server/require-event-access", () => ({ requireEventAccess }));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: () => ({ from: () => query() }) }));

const { PATCH, DELETE } = await import("./route");

const ctx = { params: Promise.resolve({ id: "a1" }) };
const patch = (body: unknown) => new Request("http://x/api/auditoriums/a1", { method: "PATCH", body: JSON.stringify(body) });
const del = (eventId: string | null) =>
  new Request(`http://x/api/auditoriums/a1${eventId ? `?eventId=${eventId}` : ""}`, { method: "DELETE" });

beforeEach(() => {
  requireEventAccess.mockReset().mockResolvedValue({ userId: "u1", eventId: "ev1", role: "editor" });
  rows = [{ id: "a1" }];
  dbError = null;
  updated = null;
  deleted = false;
  filters.length = 0;
});

describe("PATCH /api/auditoriums/[id]", () => {
  it("requires editor access and returns a denial untouched", async () => {
    requireEventAccess.mockResolvedValue(NextResponse.json({ ok: false }, { status: 403 }));
    const res = await PATCH(patch({ eventId: "ev1", name: "Hall" }), ctx);
    expect(requireEventAccess).toHaveBeenCalledWith("ev1", "editor");
    expect(res.status).toBe(403);
    expect(updated).toBeNull();
  });

  it("rejects a blank name and invalid JSON", async () => {
    expect((await PATCH(patch({ eventId: "ev1", name: "  " }), ctx)).status).toBe(400);
    const bad = await PATCH(new Request("http://x", { method: "PATCH", body: "{" }), ctx);
    expect(bad.status).toBe(400);
  });

  it("renames with a trimmed name, scoped to the event", async () => {
    const res = await PATCH(patch({ eventId: "ev1", name: "  Main Hall " }), ctx);
    expect(res.status).toBe(200);
    expect(updated).toEqual({ name: "Main Hall" });
    expect(filters).toEqual([["id", "a1"], ["event_id", "ev1"]]);
  });

  it("404s when nothing matched (another event's id, or already gone)", async () => {
    rows = [];
    expect((await PATCH(patch({ eventId: "ev1", name: "Hall" }), ctx)).status).toBe(404);
  });
});

describe("DELETE /api/auditoriums/[id]", () => {
  it("requires editor access", async () => {
    await DELETE(del("ev1"), ctx);
    expect(requireEventAccess).toHaveBeenCalledWith("ev1", "editor");
  });

  it("refuses to run without an event id", async () => {
    requireEventAccess.mockResolvedValue(NextResponse.json({ ok: false }, { status: 400 }));
    const res = await DELETE(del(null), ctx);
    expect(res.status).toBe(400);
    expect(deleted).toBe(false);
  });

  it("deletes only within the event", async () => {
    const res = await DELETE(del("ev1"), ctx);
    expect(res.status).toBe(200);
    expect(deleted).toBe(true);
    expect(filters).toEqual([["id", "a1"], ["event_id", "ev1"]]);
  });

  it("404s when nothing matched and hides database errors", async () => {
    rows = [];
    expect((await DELETE(del("ev1"), ctx)).status).toBe(404);
    dbError = { message: "boom" };
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await DELETE(del("ev1"), ctx);
    spy.mockRestore();
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("boom");
  });
});
