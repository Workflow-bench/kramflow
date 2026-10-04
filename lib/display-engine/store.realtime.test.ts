import { beforeEach, describe, expect, it } from "vitest";
import { __testing } from "./store";
import type { DisplayEngineIdentity } from "./context";

// KF-036.9 through the REAL store module. The Supabase client is replaced by a
// fake that implements only the calls the store makes: from().select().eq()
// .order()/single()/maybeSingle(), and channel().on().subscribe(). The fake server
// holds the table rows; the test controls when Realtime delivers each event.
//
// Race under test: the store reads a hydrate snapshot, a broadcast changes before
// the channel is SUBSCRIBED, and Realtime does not replay that change. The first
// SUBSCRIBED must refetch so the active broadcast appears without another mutation.
//
// Evidence class: SOURCE/TEST with a fake Supabase client. Not remote proof.

type Row = Record<string, unknown>;
interface Handler { table: string; cb: (payload: unknown) => void }
interface FakeChannel { name: string; handlers: Handler[]; status: ((s: string) => void) | null }
interface FakeServer { tables: Record<string, Row[]>; channels: FakeChannel[] }

function query(server: FakeServer, table: string) {
  const filters: Array<[string, unknown]> = [];
  const run = (): Row[] =>
    (server.tables[table] ?? []).filter((r) => filters.every(([c, v]) => r[c] === v)).map((r) => ({ ...r }));
  const q = {
    select() {
      return q;
    },
    eq(column: string, value: unknown) {
      filters.push([column, value]);
      return q;
    },
    order() {
      return q;
    },
    single: async () => {
      const rows = run();
      return rows.length ? { data: rows[0], error: null } : { data: null, error: { message: "no rows" } };
    },
    maybeSingle: async () => ({ data: run()[0] ?? null, error: null }),
    then(resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) {
      return Promise.resolve({ data: run(), error: null }).then(resolve, reject);
    },
  };
  return q;
}

function fakeClient(server: FakeServer) {
  return {
    channel(name: string) {
      const entry: FakeChannel = { name, handlers: [], status: null };
      server.channels.push(entry);
      const ch = {
        on(_type: string, filter: { table?: string }, cb: (payload: unknown) => void) {
          entry.handlers.push({ table: filter.table ?? "", cb });
          return ch;
        },
        subscribe(cb: (s: string) => void) {
          entry.status = cb;
          return ch;
        },
      };
      return ch;
    },
    from(table: string) {
      return query(server, table);
    },
  };
}

// Realtime delivers a change to every handler on a channel for that table.
function emit(server: FakeServer, table: string) {
  for (const ch of server.channels) for (const h of ch.handlers) if (h.table === table) h.cb({});
}
function setStatus(server: FakeServer, status: string) {
  for (const ch of server.channels) ch.status?.(status);
}

const flush = async () => {
  for (let i = 0; i < 6; i++) await new Promise((r) => setTimeout(r, 0));
};

function sentBroadcast(id: string, eventId: string): Row {
  return {
    id,
    event_id: eventId,
    status: "sent",
    type: "notice",
    title: "Stand by",
    message: "Please stand by",
    icon: null,
    priority: "normal",
    target: "all",
    created_at: "2026-10-04T10:00:00.000Z",
    expires_at: null,
    duration_seconds: null,
    acknowledgement_required: false,
    persistent: false,
    acknowledged_by: [],
    dismissed_at: null,
  };
}

function freshServer(eventId: string): FakeServer {
  return {
    channels: [],
    tables: {
      display_state: [{ event_id: eventId, hold: { active: false }, timer: {}, timer_version: 0, speaker_ready: {}, updated_at: null }],
      display_registry: [],
      display_broadcasts: [],
      display_type_state: [{ event_id: eventId, display_type: "presenter", hold: { active: false }, timer: {} }],
    },
  };
}

function activeIds(identity: DisplayEngineIdentity): string[] {
  const inst = __testing.getInstance(identity);
  return inst.cachedState.broadcasts.active.map((m) => m.id);
}

beforeEach(() => {
  // The store only opens remote channels when it sees a window. A minimal stub
  // is enough: the realtime path does not read anything else from it.
  (globalThis as unknown as { window: unknown }).window = {
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    addEventListener: () => {},
    removeEventListener: () => {},
    location: { href: "http://localhost/" },
  };
  __testing.reset();
});

describe("first-connect race through the real store (KF-036.9)", () => {
  it("a broadcast sent between hydrate and the first SUBSCRIBED is visible without another mutation", async () => {
    const eventId = "11111111-0000-0000-0000-000000000001";
    const identity: DisplayEngineIdentity = { eventId, displayType: "presenter" };
    const server = freshServer(eventId);
    __testing.setRemoteClient(() => fakeClient(server) as never);

    // 1. Subscribe: starts the channel and the hydrate read.
    __testing.subscribe(__testing.getInstance(identity), () => {});
    await flush();
    expect(activeIds(identity)).toEqual([]); // hydrate saw no broadcast

    // 2. A broadcast is sent after the snapshot, before SUBSCRIBED. Realtime does
    //    not replay it, so no event reaches the channel.
    server.tables.display_broadcasts.push(sentBroadcast("b-1", eventId));

    // 3. The first SUBSCRIBED.
    setStatus(server, "SUBSCRIBED");
    await flush();

    expect(activeIds(identity)).toEqual(["b-1"]);
  });

  it("a later SUBSCRIBED after a reconnect also refetches and shows the change", async () => {
    const eventId = "11111111-0000-0000-0000-000000000002";
    const identity: DisplayEngineIdentity = { eventId, displayType: "presenter" };
    const server = freshServer(eventId);
    __testing.setRemoteClient(() => fakeClient(server) as never);
    __testing.subscribe(__testing.getInstance(identity), () => {});
    await flush();
    setStatus(server, "SUBSCRIBED");
    await flush();
    // Connection drops; a change lands; the socket reconnects.
    server.tables.display_broadcasts.push(sentBroadcast("b-2", eventId));
    setStatus(server, "CHANNEL_ERROR");
    setStatus(server, "SUBSCRIBED");
    await flush();
    expect(activeIds(identity)).toEqual(["b-2"]);
  });

  it("a channel error does not refetch: the snapshot stays until a real SUBSCRIBED", async () => {
    const eventId = "11111111-0000-0000-0000-000000000003";
    const identity: DisplayEngineIdentity = { eventId, displayType: "presenter" };
    const server = freshServer(eventId);
    __testing.setRemoteClient(() => fakeClient(server) as never);
    __testing.subscribe(__testing.getInstance(identity), () => {});
    await flush();
    server.tables.display_broadcasts.push(sentBroadcast("b-3", eventId));
    setStatus(server, "CHANNEL_ERROR");
    await flush();
    expect(activeIds(identity)).toEqual([]);
  });

  it("identity change: a second event gets its own instance and channel, and sees only its own broadcasts", async () => {
    const a = "11111111-0000-0000-0000-00000000000a";
    const b = "11111111-0000-0000-0000-00000000000b";
    const serverA = freshServer(a);
    const serverB = freshServer(b);
    serverB.tables.display_broadcasts.push(sentBroadcast("b-other", b));
    __testing.setRemoteClient(() => fakeClient(serverA) as never);
    const idA: DisplayEngineIdentity = { eventId: a, displayType: "presenter" };
    __testing.subscribe(__testing.getInstance(idA), () => {});
    await flush();
    setStatus(serverA, "SUBSCRIBED");
    await flush();
    expect(activeIds(idA)).toEqual([]);
    // Event B's broadcast is not visible under event A's identity.
    __testing.setRemoteClient(() => fakeClient(serverB) as never);
    const idB: DisplayEngineIdentity = { eventId: b, displayType: "presenter" };
    __testing.subscribe(__testing.getInstance(idB), () => {});
    await flush();
    expect(activeIds(idB)).toEqual(["b-other"]);
    expect(activeIds(idA)).toEqual([]);
  });

  it("cleanup: the unsubscribe function removes the listener and leaves no callback on the instance", async () => {
    const eventId = "11111111-0000-0000-0000-00000000000c";
    const identity: DisplayEngineIdentity = { eventId, displayType: "presenter" };
    const server = freshServer(eventId);
    __testing.setRemoteClient(() => fakeClient(server) as never);
    const inst = __testing.getInstance(identity);
    const unsubscribe = __testing.subscribe(inst, () => {});
    await flush();
    const before = inst.listeners.size;
    unsubscribe();
    expect(inst.listeners.size).toBe(before - 1);
  });
});
