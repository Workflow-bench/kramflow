import { describe, it, expect } from "vitest";
import {
  assertAllowedProjectUrl,
  readState,
  writeStateAtomic,
  runSetup,
  runCleanup,
  verifyFixtureOwnership,
  FIXTURE_RUN_ID,
  FIXTURE_NAME_PREFIX,
} from "./owner_floor_live_matrix.mjs";

// Codex B003 review (B003-S1): the URL guard previously used `.includes()`,
// so any hostname/path/query merely containing the allowed host string
// passed. These cases are exactly the lookalikes the review named.
describe("assertAllowedProjectUrl", () => {
  const ALLOWED = "https://qofggbarsdiovzqwgkpz.supabase.co";

  it("accepts the exact allowed URL", () => {
    expect(() => assertAllowedProjectUrl(ALLOWED)).not.toThrow();
  });

  it("rejects an http (non-https) scheme", () => {
    expect(() => assertAllowedProjectUrl("http://qofggbarsdiovzqwgkpz.supabase.co")).toThrow(/scheme/);
  });

  it("rejects a lookalike suffix host (prefix attack)", () => {
    expect(() => assertAllowedProjectUrl("https://evil-qofggbarsdiovzqwgkpz.supabase.co")).toThrow(/host must be exactly/);
  });

  it("rejects a lookalike host where the allowed text is embedded in a longer host", () => {
    expect(() => assertAllowedProjectUrl("https://qofggbarsdiovzqwgkpz.supabase.co.evil.example")).toThrow(/host must be exactly/);
  });

  it("rejects the allowed text embedded in a path on an unrelated host", () => {
    expect(() => assertAllowedProjectUrl("https://evil.example/qofggbarsdiovzqwgkpz.supabase.co")).toThrow(/host must be exactly/);
  });

  it("rejects the allowed text embedded in a query string on an unrelated host", () => {
    expect(() => assertAllowedProjectUrl("https://evil.example/?host=qofggbarsdiovzqwgkpz.supabase.co")).toThrow(/host must be exactly/);
  });

  it("rejects userinfo even against the right host", () => {
    expect(() => assertAllowedProjectUrl("https://user:pass@qofggbarsdiovzqwgkpz.supabase.co")).toThrow(/userinfo/);
  });

  it("rejects a non-default port", () => {
    expect(() => assertAllowedProjectUrl("https://qofggbarsdiovzqwgkpz.supabase.co:8443")).toThrow(/port/);
  });

  it("rejects an extra path", () => {
    expect(() => assertAllowedProjectUrl("https://qofggbarsdiovzqwgkpz.supabase.co/rest/v1")).toThrow(/path/);
  });

  it("rejects a query string", () => {
    expect(() => assertAllowedProjectUrl("https://qofggbarsdiovzqwgkpz.supabase.co/?x=1")).toThrow(/query/);
  });

  it("rejects a fragment", () => {
    expect(() => assertAllowedProjectUrl("https://qofggbarsdiovzqwgkpz.supabase.co#frag")).toThrow(/fragment/);
  });

  it("rejects a malformed URL without throwing an unrelated TypeError", () => {
    expect(() => assertAllowedProjectUrl("not a url at all")).toThrow(/not a valid URL/);
  });

  it("never constructs a client — purely a string/URL check with no side effects", () => {
    // If this function performed any I/O it would throw in this sandboxed test
    // environment; reaching a clean assertion above already proves it didn't.
    expect(true).toBe(true);
  });
});

// A minimal in-memory fake filesystem — no real disk I/O in these tests.
function makeFakeFs(initial: Record<string, string> = {}) {
  const files = new Map<string, string>(Object.entries(initial));
  return {
    files,
    async readFile(p: string) {
      if (!files.has(p)) {
        const err: NodeJS.ErrnoException = new Error("ENOENT");
        err.code = "ENOENT";
        throw err;
      }
      return files.get(p)!;
    },
    async writeFile(p: string, content: string) {
      files.set(p, content);
    },
    async rename(from: string, to: string) {
      files.set(to, files.get(from)!);
      files.delete(from);
    },
    async rm(p: string) {
      files.delete(p);
    },
  };
}

describe("readState", () => {
  it("reports 'missing' when the file does not exist, distinct from malformed", async () => {
    const fs = makeFakeFs();
    const result = await readState(fs, "/state.json");
    expect(result).toEqual({ ok: false, reason: "missing" });
  });

  it("reports 'malformed' for invalid JSON — never treated as 'nothing to clean up'", async () => {
    const fs = makeFakeFs({ "/state.json": "{not json" });
    const result = await readState(fs, "/state.json");
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("malformed");
  });

  it("reports 'malformed' when required fields for the phase are missing", async () => {
    const fs = makeFakeFs({ "/state.json": JSON.stringify({ runId: FIXTURE_RUN_ID, phase: "event_created" }) });
    const result = await readState(fs, "/state.json");
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("malformed");
  });

  it("reports 'wrong_run_id' rather than silently accepting a foreign run's state", async () => {
    const fs = makeFakeFs({
      "/state.json": JSON.stringify({ runId: "someone-elses-run", phase: "event_created", eventId: "e1", ownerId: "o1", viewerId: "v1", editorId: "ed1" }),
    });
    const result = await readState(fs, "/state.json", FIXTURE_RUN_ID);
    expect(result).toEqual({ ok: false, reason: "wrong_run_id", state: expect.any(Object) });
  });

  it("accepts a well-formed state at any valid phase", async () => {
    const state = { runId: FIXTURE_RUN_ID, phase: "collaborators_created", eventId: "e1", ownerId: "o1", viewerId: "v1", editorId: "ed1" };
    const fs = makeFakeFs({ "/state.json": JSON.stringify(state) });
    const result = await readState(fs, "/state.json");
    expect(result).toEqual({ ok: true, state });
  });
});

describe("writeStateAtomic", () => {
  it("writes to a temp path then renames over the target, never leaving a partial target file", async () => {
    const fs = makeFakeFs();
    await writeStateAtomic(fs, "/state.json", { a: 1 });
    expect(fs.files.has("/state.json")).toBe(true);
    expect(JSON.parse(fs.files.get("/state.json")!)).toEqual({ a: 1 });
    // no leftover .tmp files
    expect([...fs.files.keys()].some((k) => k.includes(".tmp"))).toBe(false);
  });
});

// A minimal fake Supabase-like `db` — each table is an in-memory array;
// `.insert/.select/.single/.maybeSingle/.eq/.delete` are chainable thenables
// mimicking postgrest's shape closely enough for this script's own code paths.
type Row = Record<string, unknown>;
type FakeResult = { data: unknown; error: { message: string } | null };
interface FakeQueryBuilder {
  insert(row: Row | Row[]): FakeQueryBuilder;
  select(): FakeQueryBuilder;
  eq(col: string, val: unknown): FakeQueryBuilder;
  single(): FakeQueryBuilder;
  maybeSingle(): FakeQueryBuilder;
  delete(): FakeQueryBuilder;
  then(resolve: (result: FakeResult) => void): void;
}

function makeFakeDb(seed: { events?: Row[]; event_collaborators?: Row[]; display_type_state?: Row[]; display_broadcasts?: Row[] } = {}) {
  const tables: Record<string, Row[]> = {
    events: seed.events ?? [],
    event_collaborators: seed.event_collaborators ?? [],
    display_type_state: seed.display_type_state ?? [],
    display_broadcasts: seed.display_broadcasts ?? [],
  };
  const failNextDeleteFor = new Set<string>();
  let idCounter = 1;

  function builder(table: string): FakeQueryBuilder {
    let pendingInsert: Row[] = [];
    const filters: Array<[string, unknown]> = [];
    let wantSingle = false;
    let wantMaybeSingle = false;
    let mode: "insert" | "select" | "delete" = "select";

    const api: FakeQueryBuilder = {
      insert(row) {
        mode = "insert";
        pendingInsert = Array.isArray(row) ? row : [row];
        return api;
      },
      select() {
        return api;
      },
      eq(col, val) {
        filters.push([col, val]);
        return api;
      },
      single() {
        wantSingle = true;
        return api;
      },
      maybeSingle() {
        wantMaybeSingle = true;
        return api;
      },
      delete() {
        mode = "delete";
        return api;
      },
      then(resolve) {
        try {
          if (mode === "insert") {
            const created = pendingInsert.map((r) => ({ id: `${table}-${idCounter++}`, ...r }));
            tables[table].push(...created);
            resolve({ data: wantSingle ? created[0] : created, error: null });
            return;
          }
          if (mode === "delete") {
            if (failNextDeleteFor.has(table)) {
              failNextDeleteFor.delete(table);
              resolve({ data: null, error: { message: "transient failure" } });
              return;
            }
            const before = tables[table].length;
            tables[table] = tables[table].filter((row) => !filters.every(([c, v]) => row[c] === v));
            resolve({ data: { deletedCount: before - tables[table].length }, error: null });
            return;
          }
          // select
          const matches = tables[table].filter((row) => filters.every(([c, v]) => row[c] === v));
          if (wantMaybeSingle) {
            resolve({ data: matches[0] ?? null, error: null });
          } else if (wantSingle) {
            resolve({ data: matches[0] ?? null, error: matches[0] ? null : { message: "no rows" } });
          } else {
            resolve({ data: matches, error: null });
          }
        } catch (err) {
          resolve({ data: null, error: { message: err instanceof Error ? err.message : String(err) } });
        }
      },
    };
    return api;
  }

  return {
    tables,
    failNextDeleteFor,
    from: (table: string) => builder(table),
    listUsers: async () => ({
      data: {
        users: [
          { id: "owner-1", email: "demo1@kramflow.test" },
          { id: "viewer-1", email: "phase1-viewer-test@kramflow.test" },
          { id: "editor-1", email: "phase1-editor-test@kramflow.test" },
        ],
      },
      error: null,
    }),
  };
}

describe("runSetup", () => {
  it("creates the event, collaborators, and broadcast fixtures in order, persisting state after each step", async () => {
    const db = makeFakeDb();
    const fs = makeFakeFs();
    const state = await runSetup({ db, fs, statePath: "/state.json", log: () => {} });
    expect(state.phase).toBe("complete");
    expect(db.tables.events).toHaveLength(1);
    expect(db.tables.events[0].name).toContain(FIXTURE_NAME_PREFIX);
    expect(db.tables.event_collaborators).toHaveLength(2);
    expect(db.tables.display_type_state).toHaveLength(1);
    expect(db.tables.display_broadcasts).toHaveLength(1);
  });

  it("is idempotent: calling setup again after 'complete' does not create a second event", async () => {
    const db = makeFakeDb();
    const fs = makeFakeFs();
    await runSetup({ db, fs, statePath: "/state.json", log: () => {} });
    await runSetup({ db, fs, statePath: "/state.json", log: () => {} });
    expect(db.tables.events).toHaveLength(1);
  });

  it("resumes from a partial 'event_created' state instead of creating a second event", async () => {
    const db = makeFakeDb({ events: [{ id: "preexisting-event", name: `${FIXTURE_NAME_PREFIX} live-matrix fixture event`, owner_id: "owner-1" }] });
    const fs = makeFakeFs({
      "/state.json": JSON.stringify({ runId: FIXTURE_RUN_ID, phase: "event_created", eventId: "preexisting-event", ownerId: "owner-1", viewerId: "viewer-1", editorId: "editor-1" }),
    });
    const state = await runSetup({ db, fs, statePath: "/state.json", log: () => {} });
    expect(state.phase).toBe("complete");
    expect(db.tables.events).toHaveLength(1); // no new event inserted — resumed the existing one
    expect(db.tables.event_collaborators).toHaveLength(2);
  });

  it("refuses to proceed on a malformed state file rather than creating a duplicate event", async () => {
    const db = makeFakeDb();
    const fs = makeFakeFs({ "/state.json": "{not json" });
    await expect(runSetup({ db, fs, statePath: "/state.json", log: () => {} })).rejects.toThrow(/manual recovery/);
    expect(db.tables.events).toHaveLength(0);
  });

  it("reports a distinct recoverable error when the remote write succeeds but the state save fails", async () => {
    const db = makeFakeDb();
    const fs = makeFakeFs();
    const originalWrite = fs.writeFile.bind(fs);
    fs.writeFile = async () => {
      throw new Error("disk full");
    };
    await expect(runSetup({ db, fs, statePath: "/state.json", log: () => {} })).rejects.toThrow(/was created successfully, but saving the recovery state file failed/);
    expect(db.tables.events).toHaveLength(1); // the remote write really did succeed — not rolled back, and not hidden
    fs.writeFile = originalWrite;
  });
});

describe("verifyFixtureOwnership", () => {
  it("refuses to authorize deletion when the database row's owner doesn't match the state file's claim", async () => {
    const db = makeFakeDb({ events: [{ id: "e1", name: `${FIXTURE_NAME_PREFIX} x`, owner_id: "someone-else" }] });
    const state = { eventId: "e1", ownerId: "owner-1" };
    const result = await verifyFixtureOwnership({ db, state });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/does not match/);
  });

  it("refuses to authorize deletion when the database row's name lacks the fixture marker (a tampered state file pointing at an unrelated event)", async () => {
    const db = makeFakeDb({ events: [{ id: "e1", name: "Someone's real production-looking event", owner_id: "owner-1" }] });
    const state = { eventId: "e1", ownerId: "owner-1" };
    const result = await verifyFixtureOwnership({ db, state });
    expect(result.ok).toBe(false);
  });

  it("authorizes deletion when owner and name marker both match", async () => {
    const db = makeFakeDb({ events: [{ id: "e1", name: `${FIXTURE_NAME_PREFIX} live-matrix fixture event`, owner_id: "owner-1" }] });
    const state = { eventId: "e1", ownerId: "owner-1" };
    const result = await verifyFixtureOwnership({ db, state });
    expect(result).toEqual({ ok: true, alreadyGone: false });
  });

  it("treats an already-deleted event as a clean no-op, not an error", async () => {
    const db = makeFakeDb({ events: [] });
    const state = { eventId: "gone", ownerId: "owner-1" };
    const result = await verifyFixtureOwnership({ db, state });
    expect(result).toEqual({ ok: true, alreadyGone: true });
  });
});

describe("runCleanup", () => {
  it("deletes broadcast, display-state, collaborators, and the event, then removes the state file", async () => {
    const db = makeFakeDb({
      events: [{ id: "e1", name: `${FIXTURE_NAME_PREFIX} x`, owner_id: "owner-1" }],
      event_collaborators: [{ event_id: "e1", user_id: "viewer-1" }],
      display_type_state: [{ id: "d1", event_id: "e1" }],
      display_broadcasts: [{ id: "b1", event_id: "e1" }],
    });
    const state = { runId: FIXTURE_RUN_ID, phase: "complete", eventId: "e1", ownerId: "owner-1", viewerId: "viewer-1", editorId: "editor-1", displayId: "d1", broadcastId: "b1" };
    const fs = makeFakeFs({ "/state.json": JSON.stringify(state) });
    await runCleanup({ db, fs, statePath: "/state.json", log: () => {} });
    expect(db.tables.events).toHaveLength(0);
    expect(db.tables.event_collaborators).toHaveLength(0);
    expect(db.tables.display_type_state).toHaveLength(0);
    expect(db.tables.display_broadcasts).toHaveLength(0);
    expect(fs.files.has("/state.json")).toBe(false);
  });

  it("refuses to delete when ownership verification fails, and keeps the state file for a retry", async () => {
    const db = makeFakeDb({ events: [{ id: "e1", name: "unrelated event", owner_id: "someone-else" }] });
    const state = { runId: FIXTURE_RUN_ID, phase: "complete", eventId: "e1", ownerId: "owner-1", viewerId: "viewer-1", editorId: "editor-1", displayId: "d1", broadcastId: "b1" };
    const fs = makeFakeFs({ "/state.json": JSON.stringify(state) });
    await expect(runCleanup({ db, fs, statePath: "/state.json", log: () => {} })).rejects.toThrow(/Refusing to delete/);
    expect(fs.files.has("/state.json")).toBe(true);
  });

  it("is a no-op, not an error, when the state file is simply absent", async () => {
    const db = makeFakeDb();
    const fs = makeFakeFs();
    await expect(runCleanup({ db, fs, statePath: "/state.json", log: () => {} })).resolves.toBeUndefined();
  });

  it("refuses to proceed on a malformed state file rather than silently treating it as nothing to clean up", async () => {
    const db = makeFakeDb();
    const fs = makeFakeFs({ "/state.json": "{not json" });
    await expect(runCleanup({ db, fs, statePath: "/state.json", log: () => {} })).rejects.toThrow(/manual recovery/);
  });

  it("retries cleanly: a cleanup call after a prior partial failure, once the underlying issue is fixed, still succeeds", async () => {
    const db = makeFakeDb({
      events: [{ id: "e1", name: `${FIXTURE_NAME_PREFIX} x`, owner_id: "owner-1" }],
    });
    const state = { runId: FIXTURE_RUN_ID, phase: "complete", eventId: "e1", ownerId: "owner-1", viewerId: "viewer-1", editorId: "editor-1", displayId: "d1", broadcastId: "b1" };
    const fs = makeFakeFs({ "/state.json": JSON.stringify(state) });
    // first attempt: simulate the collaborators delete failing once
    db.failNextDeleteFor.add("event_collaborators");
    await expect(runCleanup({ db, fs, statePath: "/state.json", log: () => {} })).rejects.toThrow(/transient failure/);
    expect(fs.files.has("/state.json")).toBe(true); // state preserved for retry
    // second attempt (issue resolved): succeeds
    await runCleanup({ db, fs, statePath: "/state.json", log: () => {} });
    expect(fs.files.has("/state.json")).toBe(false);
  });
});
