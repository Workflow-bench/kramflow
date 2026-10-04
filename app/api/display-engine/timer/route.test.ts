import { beforeEach, describe, expect, it, vi } from "vitest";

// B007-S3: Timer on an event that has no display_type_state row yet. The route
// provisions the rows first (same model as Hold), then writes against them.
// Fake DB: rows are real objects, upsert inserts only missing rows, and an
// update reports the rows it actually matched.

const verifySessionAccess = vi.fn();
vi.mock("@/lib/server/verify-display-access", () => ({ verifySessionAccess }));

type Row = Record<string, unknown>;
let typeRows: Row[];
let sharedRow: Row | null;
let writes: { table: string; patch: Row }[];

function matches(row: Row, filters: [string, unknown][]) {
  return filters.every(([k, v]) => row[k] === v);
}

function query(table: string) {
  const filters: [string, unknown][] = [];
  let op: "select" | "update" = "select";
  let patch: Row = {};
  const list = () => (table === "display_type_state" ? typeRows : sharedRow ? [sharedRow] : []);

  function runUpdate() {
    const matched = typeRows.filter((r) => matches(r, filters));
    for (const row of matched) Object.assign(row, patch);
    writes.push({ table, patch });
    return { data: matched.map((r) => ({ timer_version: r.timer_version })), error: null };
  }

  const api = {
    select() {
      if (op === "update") return Promise.resolve(runUpdate());
      return api;
    },
    update(p: Row) {
      op = "update";
      patch = p;
      return api;
    },
    upsert: async (rows: Row[], options: { ignoreDuplicates?: boolean }) => {
      for (const r of rows) {
        const exists = typeRows.some((t) => t.event_id === r.event_id && t.display_type === r.display_type);
        if (!exists) typeRows.push({ ...r });
        else if (!options.ignoreDuplicates) Object.assign(typeRows.find((t) => t.event_id === r.event_id && t.display_type === r.display_type)!, r);
      }
      return { error: null };
    },
    eq(col: string, val: unknown) {
      filters.push([col, val]);
      return api;
    },
    maybeSingle: async () => ({ data: list().find((r) => matches(r, filters)) ?? null, error: null }),
    single: async () => {
      const found = list().find((r) => matches(r, filters));
      return found ? { data: found, error: null } : { data: null, error: { code: "PGRST116", message: "no rows" } };
    },
  };
  return api;
}

vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: () => ({ from: (table: string) => query(table) }),
}));

const { PATCH } = await import("./route");

const req = (body: Record<string, unknown>) =>
  new Request("http://x/api/display-engine/timer", { method: "PATCH", body: JSON.stringify(body) });

const baseTimer = { mode: "program", source: "auto", startedAt: null, durationSeconds: 300, pausedAt: null, adjustmentSeconds: 0, thresholds: {} };

beforeEach(() => {
  writes = [];
  verifySessionAccess.mockReset();
  verifySessionAccess.mockResolvedValue({ ok: true, eventId: "event-old" });
  // An older event: display_state exists, display_type_state has no rows.
  sharedRow = { event_id: "event-old", hold: { active: false }, timer: baseTimer, timer_version: 4 };
  typeRows = [];
});

describe("timer route on an event with no display_type_state rows (B007-S3)", () => {
  it("provisions the row and applies the first timer action", async () => {
    const res = await PATCH(req({ eventId: "event-old", displayType: "presenter", action: "setMode", mode: "countdown" }));
    expect(res.status).toBe(200);
    expect(typeRows).toHaveLength(4);
    const presenter = typeRows.find((r) => r.display_type === "presenter")!;
    expect((presenter.timer as Row).mode).toBe("countdown");
    expect(presenter.timer_version).toBe(5);
  });

  it("leaves the other display types' timers untouched", async () => {
    await PATCH(req({ eventId: "event-old", displayType: "presenter", action: "setMode", mode: "countdown" }));
    const av = typeRows.find((r) => r.display_type === "av")!;
    expect((av.timer as Row).mode).toBe("program");
    expect(av.timer_version).toBe(4);
  });

  it("refuses a non-owner without provisioning or writing", async () => {
    verifySessionAccess.mockResolvedValue({ ok: false });
    const res = await PATCH(req({ eventId: "event-old", displayType: "presenter", action: "setMode", mode: "countdown" }));
    expect(res.status).toBe(403);
    expect(typeRows).toHaveLength(0);
    expect(writes).toHaveLength(0);
  });

  it("fails loudly when the event has no display_state row to seed from", async () => {
    sharedRow = null;
    const res = await PATCH(req({ eventId: "event-old", displayType: "presenter", action: "setMode", mode: "countdown" }));
    expect(res.status).toBe(500);
    expect(writes).toHaveLength(0);
  });
});
