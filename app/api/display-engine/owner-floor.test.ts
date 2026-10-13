import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// KF-001 owner floor. Each live-state mutation (hold, timer, speaker-ready, broadcast
// cancel) must refuse every non-owner with zero writes, and let the owner write
// exactly one row in the correct table. Real verifySessionAccess and real route
// handlers run; only the role resolver (requireEventAccess) and the database
// boundary are replaced. The role resolver applies the same rank order as the
// production module (viewer < editor < owner).

type Role = "anonymous" | "unrelated" | "viewer" | "editor" | "owner";
let role: Role;

const RANK = { viewer: 0, editor: 1, owner: 2 } as const;

vi.mock("@/lib/server/require-event-access", () => ({
  requireEventAccess: async (eventId: string | null, minRole: keyof typeof RANK = "viewer") => {
    if (role === "anonymous") return NextResponse.json({ ok: false }, { status: 401 });
    if (role === "unrelated") return NextResponse.json({ ok: false }, { status: 403 });
    if (RANK[role] < RANK[minRole]) return NextResponse.json({ ok: false }, { status: 403 });
    return { eventId: eventId ?? "event-a", userId: "user-1", role };
  },
}));

// Recording fake: every write is captured with its table; reads return a
// provisioned row so the owner path can complete.
const writes: { table: string; op: string }[] = [];
let lastPatch: Record<string, unknown> = {};
function chain(table: string) {
  const api: Record<string, unknown> = {};
  const self = () => api;
  const row = {
    event_id: "event-a",
    display_type: "presenter",
    hold: { active: false },
    timer: { running: false },
    timer_version: 0,
    speaker_ready: {},
    status: "scheduled",
  };
  for (const m of ["select", "eq", "in", "order", "limit", "neq", "gte", "lte", "is"]) api[m] = self;
  for (const op of ["update", "insert", "upsert", "delete"]) {
    api[op] = (patch?: Record<string, unknown>) => {
      writes.push({ table, op });
      if (patch) lastPatch = { ...lastPatch, ...patch };
      return api;
    };
  }
  // Reads reflect the last written patch, so a readback after a write sees it.
  const stored = () => ({ ...row, ...lastPatch });
  api.maybeSingle = async () => ({ data: stored(), error: null });
  api.single = async () => ({ data: stored(), error: null });
  api.then = (resolve: (v: unknown) => unknown) => resolve({ data: [stored()], error: null });
  return api;
}
vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: () => ({ from: (table: string) => chain(table) }),
}));

const { PATCH: hold } = await import("./hold/route");
const { PATCH: timer } = await import("./timer/route");
const { PATCH: speakerReady } = await import("./speaker-ready/route");
const { DELETE: cancelBroadcast } = await import("./broadcasts/[id]/route");
const { verifySessionAccess } = await import("@/lib/server/verify-display-access");

const patch = (body: Record<string, unknown>) =>
  new Request("http://x/api/display-engine/x", { method: "PATCH", body: JSON.stringify({ eventId: "event-a", ...body }) });

const routes = [
  { name: "hold", call: () => hold(patch({ displayType: "presenter", active: true })), table: "display_type_state" },
  { name: "timer", call: () => timer(patch({ displayType: "presenter", action: "start" })), table: "display_type_state" },
  { name: "speaker-ready", call: () => speakerReady(patch({ programId: "p1", ready: true })), table: "display_state" },
  {
    name: "broadcast cancel",
    call: () => cancelBroadcast(new Request("http://x/api/display-engine/broadcasts/b1?eventId=event-a", { method: "DELETE" }), { params: Promise.resolve({ id: "b1" }) }),
    table: "display_broadcasts",
  },
];

beforeEach(() => {
  writes.length = 0;
  lastPatch = {};
});

describe.each(routes)("owner floor: $name (KF-001)", ({ name, call, table }) => {
  it.each<Role>(["anonymous", "unrelated", "viewer", "editor"])("refuses %s with zero writes", async (r) => {
    role = r;
    const res = await call();
    expect([401, 403]).toContain(res.status);
    expect(writes).toHaveLength(0);
  });

  it("lets the owner write, all writes to the correct table", async () => {
    role = "owner";
    const res = await call();
    expect(res.status).toBe(200);
    // Exactly one mutating write of the expected kind. Hold and timer may first run the
    // idempotent display_type_state provisioning upsert (ignoreDuplicates); that is not a second mutation.
    const mutating = writes.filter((w) => w.op !== "upsert");
    expect(mutating).toHaveLength(1);
    expect(mutating[0].op).toBe(name === "broadcast cancel" ? "delete" : "update");
    expect(new Set(writes.map((w) => w.table))).toEqual(new Set([table]));
  });
});

describe("read access is retained below owner (KF-001)", () => {
  it.each<Role>(["viewer", "editor", "owner"])("%s can still read the event display state", async (r) => {
    role = r;
    const access = await verifySessionAccess("event-a");
    expect(access.ok).toBe(true);
  });

  it.each<Role>(["anonymous", "unrelated"])("%s cannot read the event display state", async (r) => {
    role = r;
    const access = await verifySessionAccess("event-a");
    expect(access.ok).toBe(false);
  });
});
