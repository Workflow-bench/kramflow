// Controlled Supabase transport for the display store (KF-036.9). Shared by the node
// test (store.realtime.test.ts) and the production-excluded browser harness
// (app/(catalog)/dev/realtime). It implements only the calls the store makes. The
// test controls when each read is answered and when Realtime delivers each event.
// Evidence class: SOURCE/TEST/BROWSER with a fake client. Not remote proof.
export type Row = Record<string, unknown>;
export interface Handler { table: string; cb: (payload: unknown) => void }
export interface FakeChannel { name: string; handle: unknown; handlers: Handler[]; status: ((s: string) => void) | null }
// `deferred`: list reads (`await query`) wait in `pending` until the test releases them,
// so responses can be delivered out of order. The snapshot is taken at request time.
export interface FakeServer { tables: Record<string, Row[]>; channels: FakeChannel[]; deferred: boolean; pending: Array<() => void> }

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
      const snapshot = run();
      if (server.deferred) {
        return new Promise<unknown>((release) => server.pending.push(() => release({ data: snapshot, error: null }))).then(
          resolve,
          reject
        );
      }
      return Promise.resolve({ data: snapshot, error: null }).then(resolve, reject);
    },
  };
  return q;
}

export function fakeClient(server: FakeServer) {
  return {
    channel(name: string) {
      const entry: FakeChannel = { name, handle: null, handlers: [], status: null };
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
      entry.handle = ch;
      return ch;
    },
    removeChannel(handle: unknown) {
      server.channels = server.channels.filter((c) => c.handle !== handle);
    },
    from(table: string) {
      return query(server, table);
    },
  };
}

// Realtime delivers a change to every handler on each channel for that table.
export function emit(server: FakeServer, table: string) {
  for (const ch of server.channels) for (const h of ch.handlers) if (h.table === table) h.cb({});
}

export function setStatus(server: FakeServer, status: string) {
  for (const ch of server.channels) ch.status?.(status);
}

export const flush = async () => {
  for (let i = 0; i < 6; i++) await new Promise((r) => setTimeout(r, 0));
};

export function sentBroadcast(id: string, eventId: string): Row {
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

export function freshServer(eventId: string): FakeServer {
  return {
    channels: [],
    deferred: false,
    pending: [],
    tables: {
      display_state: [{ event_id: eventId, hold: { active: false }, timer: {}, timer_version: 0, speaker_ready: {}, updated_at: null }],
      display_registry: [],
      display_broadcasts: [],
      display_type_state: [{ event_id: eventId, display_type: "presenter", hold: { active: false }, timer: {} }],
    },
  };
}
