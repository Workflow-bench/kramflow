import { beforeEach, describe, expect, it, vi } from "vitest";

const logActivity = vi.fn();
const logActivityAs = vi.fn();
const requireEventAccess = vi.fn();

interface QueryCall {
  table: string;
  op?: string;
  filters: [string, unknown][];
  update?: Record<string, unknown>;
}

const calls: QueryCall[] = [];
let liveState: Record<string, unknown>;
let sessionRows: Record<string, unknown>[];
let programRows: Record<string, unknown>[];

function makeQuery(table: string) {
  const call: QueryCall = { table, filters: [] };
  calls.push(call);

  const query = {
    select() {
      call.op ??= "select";
      return query;
    },
    update(patch: Record<string, unknown>) {
      call.op = "update";
      call.update = patch;
      return query;
    },
    eq(column: string, value: unknown) {
      call.filters.push([column, value]);
      return query;
    },
    maybeSingle: async () => {
      if (table === "sessions") {
        return { data: findByFilters(sessionRows, call.filters) ?? null, error: null };
      }
      if (table === "programs") {
        return { data: findByFilters(programRows, call.filters) ?? null, error: null };
      }
      return { data: null, error: null };
    },
    single: async () => {
      if (table === "live_state") return { data: liveState, error: null };
      return { data: null, error: null };
    },
    selectAfterUpdate: async () => ({ data: [{ ...liveState, ...call.update }], error: null }),
  };

  // The route uses `.update(...).eq(...).eq(...).select("*")`, while read
  // queries use `.select(...).eq(...).single()`. Preserve both shapes.
  query.select = function select() {
    if (call.op === "update") return query.selectAfterUpdate();
    call.op ??= "select";
    return query;
  } as typeof query.select;

  return query;
}

function findByFilters(rows: Record<string, unknown>[], filters: [string, unknown][]) {
  return rows.find((row) => filters.every(([column, value]) => row[column] === value));
}

vi.mock("@/lib/server/require-event-access", () => ({ requireEventAccess }));
vi.mock("@/lib/server/activity-log", () => ({ logActivity, logActivityAs }));
vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: () => ({ from: (table: string) => makeQuery(table) }),
}));

const { runLiveAction } = await import("./route");

const actionRequest = (body: Record<string, unknown>) =>
  new Request("http://x/api/live", { method: "PATCH", body: JSON.stringify(body) });

function activeLiveState(overrides: Record<string, unknown> = {}) {
  return {
    active_session_id: "session-a",
    paused_at: null,
    alert: null,
    progress_by_session: { "session-a": { currentOrder: 1, startedAt: "2026-01-01T00:00:00.000Z" } },
    notes_overrides: {},
    item_actuals: {},
    version: 7,
    controller_id: "client-a",
    controller_claimed_at: new Date().toISOString(),
    ...overrides,
  };
}

beforeEach(() => {
  calls.length = 0;
  logActivity.mockReset();
  logActivityAs.mockReset();
  requireEventAccess.mockReset();
  liveState = activeLiveState();
  sessionRows = [{ id: "session-a", event_id: "event-a", day_label: "Day 1", session_label: "Morning" }];
  programRows = [
    { id: "program-1", event_id: "event-a", session_id: "session-a", sort_order: 1 },
    { id: "program-2", event_id: "event-a", session_id: "session-a", sort_order: 2 },
    { id: "foreign-program", event_id: "event-b", session_id: "session-a", sort_order: 2 },
  ];
});

describe("runLiveAction event-scoping regressions", () => {
  it("rejects selectSession when the session does not belong to the authorized event", async () => {
    sessionRows = [{ id: "foreign-session", event_id: "event-b" }];

    const res = await runLiveAction(
      actionRequest({ eventId: "event-a", action: "selectSession", sessionId: "foreign-session", clientId: "client-a" }),
      { eventId: "event-a", userId: "user-a" }
    );

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ ok: false, error: "Session not found" });
    expect(calls.find((call) => call.table === "live_state" && call.op === "update")).toBeUndefined();
    expect(logActivityAs).not.toHaveBeenCalled();
  });

  it("scopes selectSession lookup by event before updating live state", async () => {
    const res = await runLiveAction(
      actionRequest({ eventId: "event-a", action: "selectSession", sessionId: "session-a", clientId: "client-a" }),
      { eventId: "event-a", userId: "user-a" }
    );

    expect(res.status).toBe(200);
    const sessionQuery = calls.find((call) => call.table === "sessions");
    expect(sessionQuery?.filters).toContainEqual(["id", "session-a"]);
    expect(sessionQuery?.filters).toContainEqual(["event_id", "event-a"]);

    const update = calls.find((call) => call.table === "live_state" && call.op === "update");
    expect(update?.filters).toContainEqual(["event_id", "event-a"]);
    expect(update?.filters).toContainEqual(["version", 7]);
    expect(update?.update).toMatchObject({ active_session_id: "session-a", paused_at: null, version: 8 });
  });

  it("scopes program lookups by event during next so same-session foreign rows cannot be selected", async () => {
    const res = await runLiveAction(
      actionRequest({ eventId: "event-a", action: "next", maxOrder: 4, clientId: "client-a" }),
      { eventId: "event-a", userId: "user-a" }
    );

    expect(res.status).toBe(200);
    const programQueries = calls.filter((call) => call.table === "programs");
    expect(programQueries).toHaveLength(2);
    for (const query of programQueries) {
      expect(query.filters).toContainEqual(["event_id", "event-a"]);
      expect(query.filters).toContainEqual(["session_id", "session-a"]);
    }
    const update = calls.find((call) => call.table === "live_state" && call.op === "update");
    expect(update?.update?.item_actuals).toHaveProperty("program-2");
    expect(update?.update?.item_actuals).not.toHaveProperty("foreign-program");
  });

  it("requires an active control claim before sequencing actions can mutate state", async () => {
    liveState = activeLiveState({ controller_id: null, controller_claimed_at: null });

    const res = await runLiveAction(
      actionRequest({ eventId: "event-a", action: "next", maxOrder: 4, clientId: "client-a" }),
      { eventId: "event-a", userId: "user-a" }
    );

    expect(res.status).toBe(423);
    expect(await res.json()).toMatchObject({ ok: false, error: "locked" });
    expect(calls.find((call) => call.table === "live_state" && call.op === "update")).toBeUndefined();
  });
});
