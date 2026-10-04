import { describe, it, expect } from "vitest";
import {
  assertAllowedProjectUrl,
  assertLocalDevOrigin,
  readState,
  writeStateAtomic,
  runSetup,
  runCleanup,
  runMatrix,
  verifyFixtureOwnership,
  FIXTURE_RUN_ID,
  FIXTURE_NAME_PREFIX,
  FIXTURE_DISPLAY_TYPE,
  OWNER_EMAIL,
  VIEWER_EMAIL,
  EDITOR_EMAIL,
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
});

describe("assertLocalDevOrigin", () => {
  it("accepts localhost and 127.0.0.1", () => {
    expect(() => assertLocalDevOrigin("http://localhost:3000")).not.toThrow();
    expect(() => assertLocalDevOrigin("http://127.0.0.1:3000")).not.toThrow();
  });
  it("accepts a *.test dev host", () => {
    expect(() => assertLocalDevOrigin("http://kramflow.test")).not.toThrow();
  });
  it("rejects a real remote host — a session cookie must never leave the machine", () => {
    expect(() => assertLocalDevOrigin("https://kramflow.me")).toThrow(/Refusing to send session cookies/);
  });
  it("rejects a lookalike host embedding 'localhost' as a substring", () => {
    expect(() => assertLocalDevOrigin("https://localhost.evil.example")).toThrow(/Refusing to send session cookies/);
  });
  it("rejects a malformed URL", () => {
    expect(() => assertLocalDevOrigin("not a url")).toThrow(/not a valid URL/);
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
});

describe("writeStateAtomic", () => {
  it("writes to a temp path then renames over the target, never leaving a partial target file", async () => {
    const fs = makeFakeFs();
    await writeStateAtomic(fs, "/state.json", { a: 1 });
    expect(fs.files.has("/state.json")).toBe(true);
    expect(JSON.parse(fs.files.get("/state.json")!)).toEqual({ a: 1 });
    expect([...fs.files.keys()].some((k) => k.includes(".tmp"))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Schema-aware fake Supabase-like `db`. Each table enforces the SAME
// required-NOT-NULL columns and unique constraints as the real migrations
// (supabase/migrations/20260909091731_schema_base.sql,
// .../20260909091732_multitenant.sql, .../20260909091740_display_type_state.sql)
// so a regression that drops a required field or violates a uniqueness
// constraint fails the fake exactly as it would fail the real database
// (Codex B004 review, B004-S1: "the fake insert accepts any fields, masking
// the failure").
// ---------------------------------------------------------------------------
type Row = Record<string, unknown>;
type FakeResult = { data: unknown; error: { message: string } | null };
interface FakeQueryBuilder {
  insert(row: Row | Row[]): FakeQueryBuilder;
  select(cols?: string): FakeQueryBuilder;
  eq(col: string, val: unknown): FakeQueryBuilder;
  single(): FakeQueryBuilder;
  maybeSingle(): FakeQueryBuilder;
  delete(): FakeQueryBuilder;
  then(resolve: (result: FakeResult) => void): void;
}

const REQUIRED_COLUMNS: Record<string, string[]> = {
  events: ["name", "owner_id"],
  event_collaborators: ["event_id", "user_id", "role", "invited_email"],
  display_type_state: ["event_id", "display_type"],
  display_state: ["event_id"],
  display_broadcasts: ["event_id", "type", "title", "message", "target"],
};
const UNIQUE_KEYS: Record<string, string[] | null> = {
  events: null,
  event_collaborators: ["event_id", "user_id"],
  display_type_state: ["event_id", "display_type"],
  display_state: ["event_id"],
  display_broadcasts: null,
};

function makeFakeDb(seed: { events?: Row[]; event_collaborators?: Row[]; display_type_state?: Row[]; display_state?: Row[]; display_broadcasts?: Row[] } = {}) {
  const tables: Record<string, Row[]> = {
    events: seed.events ?? [],
    event_collaborators: seed.event_collaborators ?? [],
    display_type_state: seed.display_type_state ?? [],
    display_state: seed.display_state ?? [],
    display_broadcasts: seed.display_broadcasts ?? [],
  };
  const failNextDeleteFor = new Set<string>();
  const failNextInsertFor = new Set<string>();
  let idCounter = 1;

  function validateInsert(table: string, row: Row): string | null {
    const required = REQUIRED_COLUMNS[table] || [];
    for (const col of required) {
      if (row[col] === undefined || row[col] === null) {
        return `null value in column "${col}" violates not-null constraint on "${table}"`;
      }
    }
    const uniqueCols = UNIQUE_KEYS[table];
    if (uniqueCols) {
      const clashes = tables[table].some((existing) => uniqueCols.every((c) => existing[c] === row[c]));
      if (clashes) {
        return `duplicate key value violates unique constraint on "${table}" (${uniqueCols.join(", ")})`;
      }
    }
    return null;
  }

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
            if (failNextInsertFor.has(table)) {
              failNextInsertFor.delete(table);
              resolve({ data: null, error: { message: "transient insert failure" } });
              return;
            }
            for (const row of pendingInsert) {
              const err = validateInsert(table, row);
              if (err) {
                resolve({ data: null, error: { message: err } });
                return;
              }
            }
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
          // select — return deep clones, never live references, so a caller
          // that reads "before" and later reads "after" actually gets two
          // independent snapshots (a shared reference would make every
          // before/after diff silently vanish, since mutating the real row
          // would mutate the "before" snapshot too).
          const clone = (row: Row) => JSON.parse(JSON.stringify(row));
          const matches = tables[table].filter((row) => filters.every(([c, v]) => row[c] === v)).map(clone);
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
    failNextInsertFor,
    from: (table: string) => builder(table),
    listUsers: async () => ({
      data: {
        users: [
          { id: "owner-1", email: OWNER_EMAIL },
          { id: "viewer-1", email: VIEWER_EMAIL },
          { id: "editor-1", email: EDITOR_EMAIL },
        ],
      },
      error: null,
    }),
  };
}

describe("runSetup", () => {
  it("creates exactly one event, two collaborators, one display_type_state row, one display_state row, and one broadcast — each with every required column populated", async () => {
    const db = makeFakeDb();
    const fs = makeFakeFs();
    const state = await runSetup({ db, fs, statePath: "/state.json", log: () => {} });
    expect(state.phase).toBe("complete");
    expect(db.tables.events).toHaveLength(1);
    expect(db.tables.events[0].name).toContain(FIXTURE_NAME_PREFIX);
    expect(db.tables.event_collaborators).toHaveLength(2);
    for (const c of db.tables.event_collaborators) expect(c.invited_email).toBeTruthy();
    expect(db.tables.display_type_state).toHaveLength(1);
    expect(db.tables.display_type_state[0].display_type).toBe(FIXTURE_DISPLAY_TYPE);
    expect(db.tables.display_state).toHaveLength(1);
    expect(db.tables.display_broadcasts).toHaveLength(1);
    const broadcast = db.tables.display_broadcasts[0];
    expect(broadcast.message).toBeTruthy();
    expect(broadcast.target).toBeTruthy();
  });

  it("is idempotent: calling setup again after 'complete' creates no duplicate resources", async () => {
    const db = makeFakeDb();
    const fs = makeFakeFs();
    await runSetup({ db, fs, statePath: "/state.json", log: () => {} });
    await runSetup({ db, fs, statePath: "/state.json", log: () => {} });
    expect(db.tables.events).toHaveLength(1);
    expect(db.tables.display_type_state).toHaveLength(1);
    expect(db.tables.display_broadcasts).toHaveLength(1);
  });

  it("refuses to proceed on a malformed state file rather than creating a duplicate event", async () => {
    const db = makeFakeDb();
    const fs = makeFakeFs({ "/state.json": "{not json" });
    await expect(runSetup({ db, fs, statePath: "/state.json", log: () => {} })).rejects.toThrow(/manual recovery/);
    expect(db.tables.events).toHaveLength(0);
  });

  // Codex B004 review (B004-S1): the real display_broadcasts insert used to
  // omit required columns and would have failed against this exact schema.
  it("fails with a clear not-null error if a future edit ever drops message/target from the broadcast insert again (regression guard)", async () => {
    const db = makeFakeDb();
    const fs = makeFakeFs({
      "/state.json": JSON.stringify({ runId: FIXTURE_RUN_ID, phase: "display_state_created", eventId: "e1", ownerId: "owner-1", viewerId: "viewer-1", editorId: "editor-1", displayTypeStateId: "d1" }),
    });
    function dropRequiredColumns(row: Row): Row {
      const copy = { ...row };
      delete copy.message;
      delete copy.target;
      return copy;
    }
    const brokenDb = {
      ...db,
      from: (table: string) => {
        const real = db.from(table);
        if (table === "display_broadcasts") {
          const original = real.insert.bind(real);
          real.insert = (row: Row | Row[]) => original(Array.isArray(row) ? row.map(dropRequiredColumns) : dropRequiredColumns(row as Row));
        }
        return real;
      },
    };
    await expect(runSetup({ db: brokenDb, fs, statePath: "/state.json", log: () => {} })).rejects.toThrow(/not-null constraint/);
  });

  // Codex B004 review (B004-S2): a broadcast failure used to leave state
  // behind while having already created a SECOND display_type_state row on
  // retry (violating UNIQUE(event_id, display_type)), because display and
  // broadcast creation were bundled into one phase with one state save.
  it("resuming after a display-success/broadcast-failure does not create a duplicate display_type_state row, and a later successful retry reaches exactly one of each resource", async () => {
    const db = makeFakeDb();
    const fs = makeFakeFs();

    db.failNextInsertFor.add("display_broadcasts");
    await expect(runSetup({ db, fs, statePath: "/state.json", log: () => {} })).rejects.toThrow(/transient insert failure/);
    expect(db.tables.display_type_state).toHaveLength(1); // display row survived the broadcast failure
    expect(db.tables.display_broadcasts).toHaveLength(0);
    const midState = JSON.parse(fs.files.get("/state.json")!);
    expect(midState.phase).toBe("display_state_created"); // state correctly stopped BEFORE the failed broadcast step, not after

    const finalState = await runSetup({ db, fs, statePath: "/state.json", log: () => {} });
    expect(finalState.phase).toBe("complete");
    expect(db.tables.display_type_state).toHaveLength(1); // still exactly one — resumed/reused, not duplicated
    expect(db.tables.display_broadcasts).toHaveLength(1);
  });

  // Codex B004 review (B004-S2): collaborator insertion followed by a
  // state-save failure used to retry with a plain repeated insert.
  it("recovers from a collaborator-insert-succeeded-but-state-save-failed error without duplicating collaborators on retry", async () => {
    const db = makeFakeDb();
    const fs = makeFakeFs();
    const originalWrite = fs.writeFile.bind(fs);
    let failOnce = true;
    fs.writeFile = async (p: string, content: string) => {
      const parsed = JSON.parse(content);
      if (failOnce && parsed.phase === "collaborators_created") {
        failOnce = false;
        throw new Error("disk full");
      }
      return originalWrite(p, content);
    };
    await expect(runSetup({ db, fs, statePath: "/state.json", log: () => {} })).rejects.toThrow(/saving the recovery state file failed/);
    expect(db.tables.event_collaborators).toHaveLength(2); // the remote write really did succeed

    const finalState = await runSetup({ db, fs, statePath: "/state.json", log: () => {} });
    expect(finalState.phase).toBe("complete");
    expect(db.tables.event_collaborators).toHaveLength(2); // still exactly 2 — not duplicated by the retry
  });

  // Codex B004 review (B004-S2): a broadcast-success/state-save-failure
  // followed by retry must not insert a second broadcast.
  it("recovers from a broadcast-insert-succeeded-but-state-save-failed error without duplicating the broadcast on retry", async () => {
    const db = makeFakeDb();
    const fs = makeFakeFs();
    const originalWrite = fs.writeFile.bind(fs);
    let failOnce = true;
    fs.writeFile = async (p: string, content: string) => {
      const parsed = JSON.parse(content);
      if (failOnce && parsed.phase === "broadcast_created") {
        failOnce = false;
        throw new Error("disk full");
      }
      return originalWrite(p, content);
    };
    await expect(runSetup({ db, fs, statePath: "/state.json", log: () => {} })).rejects.toThrow(/saving the recovery state file failed/);
    expect(db.tables.display_broadcasts).toHaveLength(1);

    const finalState = await runSetup({ db, fs, statePath: "/state.json", log: () => {} });
    expect(finalState.phase).toBe("complete");
    expect(db.tables.display_broadcasts).toHaveLength(1); // still exactly 1
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
  it("refuses to authorize deletion when the database row's name lacks the fixture marker", async () => {
    const db = makeFakeDb({ events: [{ id: "e1", name: "Someone's real production-looking event", owner_id: "owner-1" }] });
    const result = await verifyFixtureOwnership({ db, state: { eventId: "e1", ownerId: "owner-1" } });
    expect(result.ok).toBe(false);
  });
  it("authorizes deletion when owner and name marker both match", async () => {
    const db = makeFakeDb({ events: [{ id: "e1", name: `${FIXTURE_NAME_PREFIX} live-matrix fixture event`, owner_id: "owner-1" }] });
    const result = await verifyFixtureOwnership({ db, state: { eventId: "e1", ownerId: "owner-1" } });
    expect(result).toEqual({ ok: true, alreadyGone: false });
  });
  it("treats an already-deleted event as a clean no-op, not an error", async () => {
    const db = makeFakeDb({ events: [] });
    const result = await verifyFixtureOwnership({ db, state: { eventId: "gone", ownerId: "owner-1" } });
    expect(result).toEqual({ ok: true, alreadyGone: true });
  });
});

describe("runCleanup", () => {
  it("deletes broadcast, display_state, display_type_state, collaborators, and the event, then removes the state file", async () => {
    const db = makeFakeDb({
      events: [{ id: "e1", name: `${FIXTURE_NAME_PREFIX} x`, owner_id: "owner-1" }],
      event_collaborators: [{ event_id: "e1", user_id: "viewer-1" }],
      display_type_state: [{ id: "d1", event_id: "e1" }],
      display_state: [{ id: "ds1", event_id: "e1" }],
      display_broadcasts: [{ id: "b1", event_id: "e1" }],
    });
    const state = { runId: FIXTURE_RUN_ID, phase: "complete", eventId: "e1", ownerId: "owner-1", viewerId: "viewer-1", editorId: "editor-1", displayTypeStateId: "d1", broadcastId: "b1" };
    const fs = makeFakeFs({ "/state.json": JSON.stringify(state) });
    await runCleanup({ db, fs, statePath: "/state.json", log: () => {} });
    expect(db.tables.events).toHaveLength(0);
    expect(db.tables.event_collaborators).toHaveLength(0);
    expect(db.tables.display_type_state).toHaveLength(0);
    expect(db.tables.display_state).toHaveLength(0);
    expect(db.tables.display_broadcasts).toHaveLength(0);
    expect(fs.files.has("/state.json")).toBe(false);
  });

  it("refuses to delete when ownership verification fails, and keeps the state file for a retry", async () => {
    const db = makeFakeDb({ events: [{ id: "e1", name: "unrelated event", owner_id: "someone-else" }] });
    const state = { runId: FIXTURE_RUN_ID, phase: "complete", eventId: "e1", ownerId: "owner-1", viewerId: "viewer-1", editorId: "editor-1", displayTypeStateId: "d1", broadcastId: "b1" };
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
    const db = makeFakeDb({ events: [{ id: "e1", name: `${FIXTURE_NAME_PREFIX} x`, owner_id: "owner-1" }] });
    const state = { runId: FIXTURE_RUN_ID, phase: "complete", eventId: "e1", ownerId: "owner-1", viewerId: "viewer-1", editorId: "editor-1", displayTypeStateId: "d1", broadcastId: "b1" };
    const fs = makeFakeFs({ "/state.json": JSON.stringify(state) });
    db.failNextDeleteFor.add("event_collaborators");
    await expect(runCleanup({ db, fs, statePath: "/state.json", log: () => {} })).rejects.toThrow(/transient failure/);
    expect(fs.files.has("/state.json")).toBe(true);
    await runCleanup({ db, fs, statePath: "/state.json", log: () => {} });
    expect(fs.files.has("/state.json")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// runMatrix: fake fetch + fake session-cookie seam only. Labeled explicitly
// as local/fake harness evidence, not remote/authenticated proof (Codex
// B005 prompt item 3: "label fake results accordingly").
// ---------------------------------------------------------------------------
describe("runMatrix (fake fetch + fake session seam — NOT remote proof)", () => {
  const state = { eventId: "e1", broadcastId: "b1" };

  function makeFakeFetch(statusFor: (identity: string, path: string) => number) {
    const calls: Array<{ url: string; redirect?: string; cookie?: string }> = [];
    const fakeFetch = async (url: string, init: RequestInit & { redirect?: string }) => {
      const cookie = (init.headers as Record<string, string>)?.Cookie;
      calls.push({ url, redirect: init.redirect, cookie });
      const identity = cookie?.split("=")[1] ?? "unknown";
      return { status: statusFor(identity, url) } as Response;
    };
    return { fakeFetch, calls };
  }

  async function fakeGetSessionCookie(email: string) {
    return `session=${email}`;
  }

  it("covers hold, timer, speaker-ready, and dismiss for all three identities (12 assertions)", async () => {
    const { fakeFetch } = makeFakeFetch((identity) => (identity === OWNER_EMAIL ? 200 : 403));
    const { ok, results } = await runMatrix({ baseUrl: "http://localhost:3000", state, getSessionCookie: fakeGetSessionCookie, fetchImpl: fakeFetch });
    expect(results).toHaveLength(12);
    expect(new Set(results.map((r) => r.action))).toEqual(new Set(["hold", "timer", "speaker-ready", "dismiss"]));
    expect(ok).toBe(true);
  });

  it("aggregates ok:false when any single assertion fails, even if the rest pass", async () => {
    const { fakeFetch } = makeFakeFetch((identity, url) => {
      if (identity === OWNER_EMAIL) return 200;
      if (url.includes("/hold")) return 200; // wrong — a denied role should never see 200
      return 403;
    });
    const { ok, results } = await runMatrix({ baseUrl: "http://localhost:3000", state, getSessionCookie: fakeGetSessionCookie, fetchImpl: fakeFetch });
    expect(ok).toBe(false);
    expect(results.some((r) => !r.pass)).toBe(true);
  });

  it("never follows a redirect — every call is made with redirect: 'manual'", async () => {
    const { fakeFetch, calls } = makeFakeFetch(() => 200);
    await runMatrix({ baseUrl: "http://localhost:3000", state, getSessionCookie: fakeGetSessionCookie, fetchImpl: fakeFetch });
    expect(calls.length).toBeGreaterThan(0);
    expect(calls.every((c) => c.redirect === "manual")).toBe(true);
  });

  it("refuses to run against a non-local base URL before ever calling getSessionCookie or fetch", async () => {
    let sessionCalled = false;
    const neverFetch = async () => {
      throw new Error("fetch should never be called");
    };
    await expect(
      runMatrix({
        baseUrl: "https://kramflow.me",
        state,
        getSessionCookie: async () => {
          sessionCalled = true;
          return "x";
        },
        fetchImpl: neverFetch,
      })
    ).rejects.toThrow(/Refusing to send session cookies/);
    expect(sessionCalled).toBe(false);
  });

  it("the default getSessionCookie throws a named error rather than fabricate a login flow", async () => {
    await expect(runMatrix({ baseUrl: "http://localhost:3000", state })).rejects.toThrow(/No session-cookie source configured/);
  });
});

// ---------------------------------------------------------------------------
// runMatrix's DB-level before/after readback: proves owner persistence and
// denied-identity non-mutation independently of the HTTP status code, using
// the same fake schema-aware db as the runSetup/runCleanup tests above
// (Codex B005 prompt item 2: "Prove owner persistence by independent
// readback and denied-write nonmutation by before/after comparison").
// ---------------------------------------------------------------------------
describe("runMatrix with db readback (fake fetch + fake db — NOT remote proof)", () => {
  async function fakeGetSessionCookie(email: string) {
    return `session=${email}`;
  }

  it("marks the owner's action as passing only when the DB row actually changed between before and after", async () => {
    const db = makeFakeDb({
      display_type_state: [{ id: "d1", event_id: "e1", display_type: FIXTURE_DISPLAY_TYPE, hold: { active: false }, timer: { mode: "program" } }],
      display_state: [{ id: "ds1", event_id: "e1", speaker_ready: {} }],
      display_broadcasts: [{ id: "b1", event_id: "e1", dismissed_at: null }],
    });
    let callCount = 0;
    const fakeFetch = async (url: string, init: RequestInit) => {
      const cookie = (init.headers as Record<string, string>)?.Cookie ?? "";
      callCount++;
      if (cookie.includes(OWNER_EMAIL)) {
        // Simulate the route's own DB write succeeding for the owner, mirroring
        // what the real PATCH handlers do before returning 200.
        if (url.includes("/hold")) db.tables.display_type_state[0].hold = { active: true };
        if (url.includes("/timer")) db.tables.display_type_state[0].timer = { mode: "clock" };
        if (url.includes("/speaker-ready")) db.tables.display_state[0].speaker_ready = { "x-program": true };
        if (url.includes("/dismiss")) db.tables.display_broadcasts[0].dismissed_at = new Date().toISOString();
        return { status: 200 } as Response;
      }
      return { status: 403 } as Response;
    };
    const state = { eventId: "e1", broadcastId: "b1" };
    const { ok, results } = await runMatrix({ baseUrl: "http://localhost:3000", state, db, getSessionCookie: fakeGetSessionCookie, fetchImpl: fakeFetch });
    expect(callCount).toBe(12);
    expect(ok).toBe(true);
    const ownerResults = results.filter((r) => r.identity === "owner");
    expect(ownerResults.every((r) => r.pass)).toBe(true);
    expect(ownerResults.every((r) => r.mutation?.includes("persisted"))).toBe(true);
    const deniedResults = results.filter((r) => r.identity !== "owner");
    expect(deniedResults.every((r) => r.pass)).toBe(true);
    expect(deniedResults.every((r) => r.mutation?.includes("no mutation"))).toBe(true);
  });

  it("fails the assertion if a denied identity's call reports 403 but the row was mutated anyway (the exact bug this readback exists to catch)", async () => {
    const db = makeFakeDb({
      display_type_state: [{ id: "d1", event_id: "e1", display_type: FIXTURE_DISPLAY_TYPE, hold: { active: false }, timer: { mode: "program" } }],
      display_state: [{ id: "ds1", event_id: "e1", speaker_ready: {} }],
      display_broadcasts: [{ id: "b1", event_id: "e1", dismissed_at: null }],
    });
    const fakeFetch = async (url: string, init: RequestInit) => {
      const cookie = (init.headers as Record<string, string>)?.Cookie ?? "";
      if (!cookie.includes(OWNER_EMAIL) && url.includes("/hold")) {
        // A denied identity's call still mutates the row, even though the
        // route reports 403 — e.g. a bug where authorization is checked
        // after the write. The status-only check would pass; the readback
        // must not.
        db.tables.display_type_state[0].hold = { active: true };
      }
      return { status: cookie.includes(OWNER_EMAIL) ? 200 : 403 } as Response;
    };
    const state = { eventId: "e1", broadcastId: "b1" };
    const { ok, results } = await runMatrix({ baseUrl: "http://localhost:3000", state, db, getSessionCookie: fakeGetSessionCookie, fetchImpl: fakeFetch });
    expect(ok).toBe(false);
    const brokenResult = results.find((r) => r.action === "hold" && r.identity !== "owner");
    expect(brokenResult?.pass).toBe(false);
    expect(brokenResult?.mutation).toContain("this is the bug this matrix exists to catch");
  });

  it("falls back to status-only assertions (no mutation field) when no db is supplied", async () => {
    const fakeFetch = async (_url: string, init: RequestInit) => {
      const cookie = (init.headers as Record<string, string>)?.Cookie ?? "";
      return { status: cookie.includes(OWNER_EMAIL) ? 200 : 403 } as Response;
    };
    const state = { eventId: "e1", broadcastId: "b1" };
    const { ok, results } = await runMatrix({ baseUrl: "http://localhost:3000", state, getSessionCookie: fakeGetSessionCookie, fetchImpl: fakeFetch });
    expect(ok).toBe(true);
    expect(results.every((r) => !("mutation" in r))).toBe(true);
  });
});
