import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requireEventAccess = vi.fn();

let sessionRow: Record<string, unknown> | null;
let lastSort: number | null;
let insertError: unknown;
let inserted: Record<string, unknown> | null;
const filters: [string, unknown][] = [];

function query(table: string) {
  const q = {
    select: () => q,
    eq: (col: string, val: unknown) => {
      filters.push([`${table}.${col}`, val]);
      return q;
    },
    order: () => q,
    limit: () => q,
    maybeSingle: async () => ({
      data: table === "sessions" ? sessionRow : lastSort === null ? null : { sort_order: lastSort },
      error: null,
    }),
    insert: (row: Record<string, unknown>) => {
      inserted = row;
      return q;
    },
    single: async () => (insertError ? { data: null, error: insertError } : { data: { id: "new-id" }, error: null }),
  };
  return q;
}

vi.mock("@/lib/server/require-event-access", () => ({ requireEventAccess }));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: () => ({ from: (t: string) => query(t) }) }));

const { POST } = await import("./route");

const post = (body: unknown) => new Request("http://x/api/partitions", { method: "POST", body: JSON.stringify(body) });
const valid = { eventId: "ev1", sessionId: "s1", label: "  Main ", start_time: " 9:00 AM " };

beforeEach(() => {
  requireEventAccess.mockReset().mockResolvedValue({ userId: "u1", eventId: "ev1", role: "editor" });
  sessionRow = { id: "s1" };
  lastSort = null;
  insertError = null;
  inserted = null;
  filters.length = 0;
});

describe("POST /api/partitions", () => {
  it("requires editor access and returns a denial untouched", async () => {
    requireEventAccess.mockResolvedValue(NextResponse.json({ ok: false }, { status: 403 }));
    const res = await POST(post(valid));
    expect(requireEventAccess).toHaveBeenCalledWith("ev1", "editor");
    expect(res.status).toBe(403);
    expect(inserted).toBeNull();
  });

  it("rejects a missing session, a blank label and a non-string start time", async () => {
    expect((await POST(post({ ...valid, sessionId: undefined }))).status).toBe(400);
    expect((await POST(post({ ...valid, label: "   " }))).status).toBe(400);
    expect((await POST(post({ ...valid, start_time: 900 }))).status).toBe(400);
    expect(inserted).toBeNull();
  });

  it("404s when the session is not in this event", async () => {
    sessionRow = null;
    const res = await POST(post(valid));
    expect(res.status).toBe(404);
    expect(filters).toContainEqual(["sessions.event_id", "ev1"]);
    expect(inserted).toBeNull();
  });

  it("creates the section scoped to the event, trimmed, after the last one", async () => {
    lastSort = 2;
    const res = await POST(post(valid));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, id: "new-id" });
    expect(inserted).toEqual({ session_id: "s1", event_id: "ev1", label: "Main", sort_order: 3, start_time: "9:00 AM" });
  });

  it("starts at sort order 0 and stores no start time when none is given", async () => {
    await POST(post({ eventId: "ev1", sessionId: "s1", label: "Main" }));
    expect(inserted).toMatchObject({ sort_order: 0, start_time: null });
  });

  it("reports a database failure as 500 without leaking it", async () => {
    insertError = { message: "boom" };
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await POST(post(valid));
    spy.mockRestore();
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("boom");
  });
});
