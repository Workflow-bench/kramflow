import { describe, expect, it, vi } from "vitest";
import {
  describeSaveCheck,
  fetchSessionRows,
  interpretSaveCheck,
  waitAtMost,
  classifySaveResponse,
  snapshotForCheck,
  type CheckedRow,
  type SubmittedSnapshot,
} from "./save-check";

// A tiny in-memory server for one session. Records every request method so
// tests can assert the check never writes.
function fakeServer(initial: CheckedRow[]) {
  let rows = [...initial];
  const methods: string[] = [];
  let failNext = false;
  const fetchImpl = vi.fn(async (_url: string, init?: { method?: string }) => {
    methods.push((init?.method ?? "GET").toUpperCase());
    if (failNext) {
      failNext = false;
      throw new TypeError("Failed to fetch");
    }
    return { ok: true, json: async () => ({ programs: rows }) };
  });
  return {
    fetchImpl,
    methods,
    commit: (row: CheckedRow) => {
      rows = [...rows.filter((r) => r.id !== row.id), row];
    },
    failNextRequest: () => {
      failNext = true;
    },
  };
}

async function check(server: ReturnType<typeof fakeServer>, snapshot: SubmittedSnapshot, programId?: string) {
  const rows = await fetchSessionRows(server.fetchImpl, "evt", snapshot.sessionId);
  const result = interpretSaveCheck(snapshot, programId, rows);
  return { result, text: describeSaveCheck(result, snapshot.name) };
}

// No message may claim a safe retry or attribute success/failure to this
// submission from what a single read shows.
function expectNoUnsupportedClaim(text: string) {
  expect(text).not.toMatch(/\bsafe\b/i);
  expect(text).not.toMatch(/probably|most likely|likely saved|didn[’']t save|did not save|was saved|(?<!whether )it saved\./i);
}

const create: SubmittedSnapshot = { name: "Keynote", sessionId: "s1" };

describe("save check (create)", () => {
  it("GET before a delayed commit reports absence without concluding it failed", async () => {
    const server = fakeServer([]);
    const first = await check(server, create);
    expect(first.result.kind).toBe("create-none-visible");
    expect(first.text).toMatch(/may still finish/);
    expect(first.text).toMatch(/can’t confirm/);
    expectNoUnsupportedClaim(first.text);

    // The original request commits after the first check.
    server.commit({ id: "new", name: "Keynote", version: 1 });
    const second = await check(server, create);
    expect(second.result).toEqual({ kind: "create-name-visible", count: 1, name: "Keynote" });
    expectNoUnsupportedClaim(second.text);
    expect(server.methods.every((m) => m === "GET")).toBe(true);
  });

  it("a pre-existing same-name cue is reported as an observation, not as this submission", async () => {
    const server = fakeServer([{ id: "old", name: "keynote ", version: 3 }]);
    const { result, text } = await check(server, create);
    expect(result.kind).toBe("create-name-visible");
    expect(text).toMatch(/could be this submission or an earlier cue/);
    expect(text).toMatch(/Inspect/);
    expectNoUnsupportedClaim(text);
  });

  it("several same-name cues are counted", async () => {
    const server = fakeServer([
      { id: "a", name: "Keynote", version: 1 },
      { id: "b", name: "Keynote", version: 1 },
    ]);
    const { result, text } = await check(server, create);
    expect(result).toEqual({ kind: "create-name-visible", count: 2, name: "Keynote" });
    expectNoUnsupportedClaim(text);
  });

  it("checks the submitted snapshot, not a draft edited after submit", async () => {
    const server = fakeServer([{ id: "x", name: "Keynote", version: 1 }]);
    const submitted: SubmittedSnapshot = { name: "Keynote", sessionId: "s1" };
    const editedDraft: SubmittedSnapshot = { name: "Keynote (revised)", sessionId: "s2" };
    const sent = snapshotForCheck(submitted, editedDraft);
    expect(sent).toBe(submitted);
    const { result, text } = await check(server, sent);
    expect(result.kind).toBe("create-name-visible");
    expect(text).not.toContain("revised");
    expect(server.fetchImpl.mock.calls[0][0]).toContain("sessionId=s1");
    // Before anything was submitted there is nothing else to compare against.
    expect(snapshotForCheck(null, editedDraft)).toBe(editedDraft);
  });
});

describe("save check (edit)", () => {
  const edit: SubmittedSnapshot = { name: "Keynote", sessionId: "s1", version: 4 };

  it("another editor's newer version is not attributed to this edit", async () => {
    const server = fakeServer([{ id: "p1", name: "Keynote", version: 5 }]);
    const { result, text } = await check(server, edit, "p1");
    expect(result).toEqual({ kind: "edit-version-changed", from: 4, to: 5 });
    expect(text).toMatch(/your edit or someone else’s/);
    expect(text).toMatch(/Compare/);
    expectNoUnsupportedClaim(text);
  });

  it("an unchanged version doesn't mean the edit failed", async () => {
    const server = fakeServer([{ id: "p1", name: "Keynote", version: 4 }]);
    const { result, text } = await check(server, edit, "p1");
    expect(result.kind).toBe("edit-version-unchanged");
    expect(text).toMatch(/may still finish/);
    expectNoUnsupportedClaim(text);
  });

  it("a missing row says reload, nothing more", async () => {
    const server = fakeServer([]);
    const { result, text } = await check(server, edit, "p1");
    expect(result.kind).toBe("edit-missing");
    expectNoUnsupportedClaim(text);
  });
});

describe("save check (failure and repetition)", () => {
  it("a failed check keeps the draft and claims nothing", async () => {
    const server = fakeServer([]);
    server.failNextRequest();
    const { result, text } = await check(server, create);
    expect(result.kind).toBe("check-failed");
    expect(text).toMatch(/draft is still here/);
    expectNoUnsupportedClaim(text);
  });

  it("a non-OK response is a failed check, not an empty session", async () => {
    const fetchImpl = vi.fn(async () => ({ ok: false, json: async () => ({}) }));
    expect(await fetchSessionRows(fetchImpl, "evt", "s1")).toBeNull();
  });

  it("repeated checks only ever read", async () => {
    const server = fakeServer([]);
    for (let i = 0; i < 4; i++) {
      const { text } = await check(server, create);
      expectNoUnsupportedClaim(text);
    }
    server.failNextRequest();
    await check(server, create);
    expect(server.methods).toEqual(["GET", "GET", "GET", "GET", "GET"]);
  });
});

describe("bounded save wait", () => {
  it("stops waiting without cancelling, and the late result is still observable", async () => {
    vi.useFakeTimers();
    let resolveRequest!: (v: string) => void;
    const request = new Promise<string>((r) => (resolveRequest = r));
    const race = waitAtMost(request, 20_000);
    await vi.advanceTimersByTimeAsync(20_000);
    expect(await race).toEqual({ settled: false });
    resolveRequest("committed-late");
    expect(await request).toBe("committed-late");
    vi.useRealTimers();
  });

  it("returns the value when the request settles in time", async () => {
    expect(await waitAtMost(Promise.resolve(1), 1000)).toEqual({ settled: true, value: 1 });
  });

  it("propagates a network error inside the wait", async () => {
    await expect(waitAtMost(Promise.reject(new TypeError("Failed to fetch")), 1000)).rejects.toThrow("Failed to fetch");
  });
});

describe("save answers", () => {
  const fresh = { pending: 0, earlierSaved: 0, unresolved: 0, hadUnknown: false };

  it("treats any 5xx as unknown, never as not saved", () => {
    for (const status of [500, 502, 503, 504]) {
      expect(classifySaveResponse({ ok: false, status }, "current", fresh)).toBe("unknown-server-error");
      expect(classifySaveResponse({ ok: false, status }, "late", fresh)).toBe("unknown-server-error");
    }
  });

  it("a 409 after an unknown outcome may be the user's own earlier attempt", () => {
    expect(classifySaveResponse({ ok: false, status: 409 }, "current", fresh)).toBe("conflict");
    expect(classifySaveResponse({ ok: false, status: 409 }, "current", { ...fresh, hadUnknown: true })).toBe(
      "conflict-maybe-own-attempt"
    );
  });

  it("a late success is reported, not dropped", () => {
    expect(classifySaveResponse({ ok: true, status: 201 }, "late", { ...fresh, hadUnknown: true })).toBe("saved-late");
  });

  it("an older attempt finishing after a resubmit is surfaced", () => {
    expect(classifySaveResponse({ ok: true, status: 201 }, "earlier", fresh)).toBe("earlier-accepted");
    expect(classifySaveResponse({ ok: false, status: 400 }, "earlier", fresh)).toBe("earlier-error");
  });

  it("doesn't close silently while an earlier attempt could add a second copy", () => {
    expect(classifySaveResponse({ ok: true, status: 201 }, "current", { ...fresh, pending: 1 })).toBe("saved-earlier-pending");
    expect(classifySaveResponse({ ok: true, status: 201 }, "current", { ...fresh, earlierSaved: 1 })).toBe("saved-earlier-accepted");
    expect(classifySaveResponse({ ok: true, status: 201 }, "current", fresh)).toBe("saved-close");
  });

  it("keeps 4xx validation failures definite", () => {
    expect(classifySaveResponse({ ok: false, status: 400 }, "current", fresh)).toBe("failed");
    expect(classifySaveResponse({ ok: false, status: 403 }, "current", fresh)).toBe("failed");
  });
});
