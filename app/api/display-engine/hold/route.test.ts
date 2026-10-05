import { beforeEach, describe, expect, it, vi } from "vitest";

// KF-031: a hold write must land on a real display_type_state row. These tests
// use a fake that matches the route's query shapes, and check that a write
// matching no row is refused rather than reported as ok.

const verifySessionAccess = vi.fn();
vi.mock("@/lib/server/verify-display-access", () => ({ verifySessionAccess }));

interface Row {
  event_id: string;
  display_type: string;
  hold: Record<string, unknown>;
  timer: Record<string, unknown>;
  timer_version: number;
}

let rows: Row[];
let sharedRows: Record<string, unknown>[];
let updateReturnsRows: boolean;

// `col->>field` reads a JSON field as text (PostgREST path), as the route uses it.
function valueAt(row: object, key: string): unknown {
  const r = row as Record<string, unknown>;
  if (!key.includes("->>")) return r[key];
  const [col, field] = key.split("->>");
  const json = r[col] as Record<string, unknown> | null | undefined;
  return json?.[field] ?? null;
}
function matches(row: object, filters: [string, unknown][]) {
  return filters.every(([k, v]) => valueAt(row, k) === (v ?? null));
}

// Concurrent writes that land between the route's read and its conditional update.
// Each entry runs once, immediately before the next update executes.
let interleaves: Array<() => void> = [];

function query(table: string) {
  const filters: [string, unknown][] = [];
  let op = "select";
  let patch: Record<string, unknown> | undefined;
  const list = () => (table === "display_type_state" ? rows : sharedRows);

  function updateResult() {
    const concurrent = interleaves.shift();
    if (concurrent) concurrent();
    if (!updateReturnsRows) return { data: [], error: null };
    const target = rows.find((r) => matches(r, filters));
    if (!target) return { data: [], error: null };
    Object.assign(target, patch);
    return { data: [{ hold: target.hold }], error: null };
  }

  const api = {
    select() {
      if (op === "update") return Promise.resolve(updateResult());
      return api;
    },
    update(p: Record<string, unknown>) {
      op = "update";
      patch = p;
      return api;
    },
    // Provisioning is a no-op here, so a test with no row still sees no row:
    // these tests isolate the route's own guard from the helper.
    upsert: async () => ({ error: null }),
    eq(col: string, val: unknown) {
      filters.push([col, val]);
      return api;
    },
    is(col: string, val: unknown) {
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
  new Request("http://x/api/display-engine/hold", { method: "PATCH", body: JSON.stringify(body) });

beforeEach(() => {
  interleaves = [];
  updateReturnsRows = true;
  verifySessionAccess.mockReset();
  verifySessionAccess.mockResolvedValue({ ok: true, eventId: "event-a" });
  sharedRows = [{ event_id: "event-a", hold: { active: false }, timer: {}, timer_version: 0 }];
  rows = [
    { event_id: "event-a", display_type: "presenter", hold: { active: false }, timer: {}, timer_version: 0 },
  ];
});

describe("hold route row guard (KF-031)", () => {
  it("activates hold on a provisioned row and reads back the change", async () => {
    const res = await PATCH(req({ eventId: "event-a", displayType: "presenter", active: true, message: "Stand by" }));
    expect(res.status).toBe(200);
    expect(rows[0].hold.active).toBe(true);
  });

  it("refuses to report success when the write matches no row", async () => {
    rows = [];
    updateReturnsRows = false;
    const res = await PATCH(req({ eventId: "event-a", displayType: "presenter", active: true }));
    expect(res.status).toBe(500);
    expect((await res.json()).ok).toBe(false);
  });

  it("refuses to deactivate when no row exists", async () => {
    rows = [];
    const res = await PATCH(req({ eventId: "event-a", displayType: "presenter", active: false }));
    expect(res.status).toBe(500);
  });

  it("fails the readback when the write does not change the stored hold", async () => {
    updateReturnsRows = false;
    const res = await PATCH(req({ eventId: "event-a", displayType: "presenter", active: true }));
    expect(res.status).toBe(500);
    expect(rows[0].hold.active).toBe(false);
  });

  it("is refused for a non-owner, without writing", async () => {
    verifySessionAccess.mockResolvedValue({ ok: false });
    const res = await PATCH(req({ eventId: "event-a", displayType: "presenter", active: true }));
    expect(res.status).toBe(403);
    expect(rows[0].hold.active).toBe(false);
  });

  describe("deactivation is a conditional write (lost-update fix)", () => {
    const activeM1 = { active: true, message: "M1", subMessage: "sub", continueClock: true, activatedAt: "2026-10-04T10:00:00Z" };
    const activation = (message: string, at: string) => () => {
      rows[0].hold = { active: true, message, subMessage: null, continueClock: false, activatedAt: at };
    };

    it("a concurrent activation between read and write is kept: retry deactivates it, message M2 survives", async () => {
      rows[0].hold = { ...activeM1 };
      interleaves = [activation("M2", "2026-10-04T10:05:00Z")];
      const res = await PATCH(req({ eventId: "event-a", displayType: "presenter", active: false }));
      expect(res.status).toBe(200);
      expect(rows[0].hold).toMatchObject({ active: false, message: "M2", activatedAt: null });
    });

    it("preserves unrelated hold fields on deactivation", async () => {
      rows[0].hold = { ...activeM1 };
      const res = await PATCH(req({ eventId: "event-a", displayType: "presenter", active: false }));
      expect(res.status).toBe(200);
      expect(rows[0].hold).toMatchObject({ active: false, message: "M1", subMessage: "sub", continueClock: true, activatedAt: null });
    });

    it("three conflicting writes in a row: refused with 409, and the route does not overwrite the last one", async () => {
      rows[0].hold = { ...activeM1 };
      interleaves = [
        activation("M2", "2026-10-04T10:05:00Z"),
        activation("M3", "2026-10-04T10:06:00Z"),
        activation("M4", "2026-10-04T10:07:00Z"),
      ];
      const res = await PATCH(req({ eventId: "event-a", displayType: "presenter", active: false }));
      expect(res.status).toBe(409);
      expect((await res.json()).ok).toBe(false);
      expect(rows[0].hold).toMatchObject({ active: true, message: "M4", activatedAt: "2026-10-04T10:07:00Z" });
    });

    it("an initial hold with no activatedAt (null witness) deactivates on the IS NULL branch", async () => {
      rows[0].hold = { active: true, message: "M0" };
      const res = await PATCH(req({ eventId: "event-a", displayType: "presenter", active: false }));
      expect(res.status).toBe(200);
      expect(rows[0].hold).toMatchObject({ active: false, message: "M0", activatedAt: null });
    });
  });
});
