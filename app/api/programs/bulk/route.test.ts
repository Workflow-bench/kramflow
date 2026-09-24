import { beforeEach, describe, expect, it, vi } from "vitest";

const requireEventAccess = vi.fn();
const logActivityAs = vi.fn();
const rpc = vi.fn();

interface QueryCall {
  table: string;
  filters: [string, unknown][];
  inFilter?: [string, unknown[]];
}

const calls: QueryCall[] = [];
let ownedPrograms: Record<string, unknown>[];
let partitionRows: Record<string, unknown>[];

function makeQuery(table: string) {
  const call: QueryCall = { table, filters: [] };
  calls.push(call);

  return {
    select() {
      return this;
    },
    eq(column: string, value: unknown) {
      call.filters.push([column, value]);
      return this;
    },
    in(column: string, values: unknown[]) {
      call.inFilter = [column, values];
      return Promise.resolve({ data: ownedPrograms.filter((row) => values.includes(row.id)), error: null });
    },
    maybeSingle: async () => ({ data: findByFilters(partitionRows, call.filters) ?? null, error: null }),
  };
}

function findByFilters(rows: Record<string, unknown>[], filters: [string, unknown][]) {
  return rows.find((row) => filters.every(([column, value]) => row[column] === value));
}

vi.mock("@/lib/server/require-event-access", () => ({ requireEventAccess }));
vi.mock("@/lib/server/activity-log", () => ({ logActivityAs }));
vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: () => ({
    from: (table: string) => makeQuery(table),
    rpc,
  }),
}));

const { PATCH } = await import("./route");

const patch = (body: Record<string, unknown>) =>
  PATCH(new Request("http://x/api/programs/bulk", { method: "PATCH", body: JSON.stringify(body) }));

beforeEach(() => {
  calls.length = 0;
  requireEventAccess.mockReset().mockResolvedValue({ eventId: "event-a", userId: "user-a", role: "editor" });
  logActivityAs.mockReset();
  rpc.mockReset().mockResolvedValue({ data: null, error: null });
  ownedPrograms = [
    { id: "program-1", event_id: "event-a" },
    { id: "program-2", event_id: "event-a" },
  ];
  partitionRows = [{ id: "partition-a", event_id: "event-a" }];
});

describe("PATCH /api/programs/bulk event-scoping regressions", () => {
  it("rejects moving selected programs to a partition outside the authorized event", async () => {
    partitionRows = [{ id: "partition-foreign", event_id: "event-b" }];

    const res = await patch({ eventId: "event-a", ids: ["program-1"], partitionId: "partition-foreign" });

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ ok: false, error: "Partition not found" });
    expect(rpc).not.toHaveBeenCalled();
    expect(logActivityAs).not.toHaveBeenCalled();
  });

  it("checks destination partition ownership before calling the bulk move RPC", async () => {
    const res = await patch({ eventId: "event-a", ids: ["program-1", "program-2"], partitionId: "partition-a" });

    expect(res.status).toBe(200);
    const partitionQuery = calls.find((call) => call.table === "partitions");
    expect(partitionQuery?.filters).toContainEqual(["id", "partition-a"]);
    expect(partitionQuery?.filters).toContainEqual(["event_id", "event-a"]);
    expect(rpc).toHaveBeenCalledWith("bulk_move_programs_to_partition", {
      p_event_id: "event-a",
      p_ids: ["program-1", "program-2"],
      p_partition_id: "partition-a",
    });
  });

  it("rejects selected program IDs that do not all belong to the authorized event", async () => {
    ownedPrograms = [{ id: "program-1", event_id: "event-a" }];

    const res = await patch({ eventId: "event-a", ids: ["program-1", "foreign-program"], partitionId: "partition-a" });

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ ok: false, error: "One or more items don't belong to this event" });
    expect(calls.find((call) => call.table === "partitions")).toBeUndefined();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("passes null partition moves through with the authorized event id", async () => {
    const res = await patch({ eventId: "event-a", ids: ["program-1"], partitionId: null });

    expect(res.status).toBe(200);
    expect(calls.find((call) => call.table === "partitions")).toBeUndefined();
    expect(rpc).toHaveBeenCalledWith("bulk_move_programs_to_partition", {
      p_event_id: "event-a",
      p_ids: ["program-1"],
      p_partition_id: null,
    });
  });
});
