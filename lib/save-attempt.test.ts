import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SaveSession, readSaveAnswer, type ResponseLike, type SaveEffect } from "./save-attempt";
import type { SubmittedSnapshot } from "./save-check";

const DEADLINE = 20_000;

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** A response whose body is under the test's control. */
function response(status: number, body = deferred<unknown>()): ResponseLike & { body: ReturnType<typeof deferred<unknown>>; bodyReads: number } {
  const r = {
    ok: status >= 200 && status < 300,
    status,
    body,
    bodyReads: 0,
    json: () => {
      r.bodyReads++;
      return body.promise;
    },
  };
  return r;
}

function harness() {
  const effects: SaveEffect[] = [];
  const writes: string[] = [];
  const state = { saving: false, checking: false };
  const session = new SaveSession({
    deadlineMs: DEADLINE,
    emit: (e) => {
      effects.push(e);
      if (e.type === "saving") state.saving = e.value;
      if (e.type === "checking") state.checking = e.value;
    },
  });
  return {
    session,
    effects,
    writes,
    state,
    edit: () => session.noteEdit(),
    /** Each call is one POST; returns the deferred controlling it. */
    send: (label: string, d = deferred<ResponseLike>()) => () => {
      writes.push(label);
      return d.promise;
    },
    answers: () => effects.filter((e): e is Extract<SaveEffect, { type: "answer" }> => e.type === "answer"),
    checks: () => effects.filter((e): e is Extract<SaveEffect, { type: "check" }> => e.type === "check"),
  };
}

const A: SubmittedSnapshot = { name: "Cue A", sessionId: "s1" };
const B: SubmittedSnapshot = { name: "Cue B", sessionId: "s1" };

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("P2-01: the deadline covers the whole answer", () => {
  it("headers arrive at once but the error body never settles: recovers within the deadline, no second write", async () => {
    const h = harness();
    const req = deferred<ResponseLike>();
    const done = h.session.submit(A, h.send("POST A", req));
    const res = response(400); // body never resolves
    req.resolve(res);
    await vi.advanceTimersByTimeAsync(DEADLINE - 1);
    expect(h.state.saving).toBe(true);
    await vi.advanceTimersByTimeAsync(1);
    await done;
    expect(h.state.saving).toBe(false);
    expect(h.answers()).toEqual([expect.objectContaining({ kind: "failed", status: 400, mode: "current" })]);
    expect(h.writes).toEqual(["POST A"]);
  });

  it("a 5xx with a stalled body still recovers as outcome unknown", async () => {
    const h = harness();
    const req = deferred<ResponseLike>();
    const done = h.session.submit(A, h.send("POST A", req));
    req.resolve(response(504));
    await vi.advanceTimersByTimeAsync(DEADLINE);
    await done;
    expect(h.state.saving).toBe(false);
    expect(h.answers()[0].kind).toBe("unknown-server-error");
    expect(h.writes).toHaveLength(1);
  });

  it("a 2xx doesn't wait for a body at all", async () => {
    const h = harness();
    const req = deferred<ResponseLike>();
    const res = response(201);
    const done = h.session.submit(A, h.send("POST A", req));
    req.resolve(res);
    await done;
    expect(res.bodyReads).toBe(0);
    expect(h.answers()[0]).toMatchObject({ kind: "saved-close", revisionMatches: true });
  });

  it("headers that never arrive recover at the deadline (existing behavior kept)", async () => {
    const h = harness();
    const done = h.session.submit(A, h.send("POST A"));
    await vi.advanceTimersByTimeAsync(DEADLINE);
    await done;
    expect(h.state.saving).toBe(false);
    expect(h.effects).toContainEqual({ type: "unknown", reason: "timeout" });
    expect(h.writes).toEqual(["POST A"]);
  });

  it("readSaveAnswer gives up on a body once no time is left", async () => {
    const res = response(422);
    expect(await readSaveAnswer(res, 0)).toEqual({ ok: false, status: 422, bodyTimedOut: true });
    expect(res.bodyReads).toBe(0);
  });
});

describe("P2-02: answers are bound to their attempt after every await", () => {
  it("A times out, A's late headers arrive, A's body pauses, B is submitted, A's body resolves: B is unaffected, A is reported as earlier", async () => {
    const h = harness();
    const reqA = deferred<ResponseLike>();
    const doneA = h.session.submit(A, h.send("POST A", reqA));
    await vi.advanceTimersByTimeAsync(DEADLINE);
    await doneA;
    expect(h.effects).toContainEqual({ type: "unknown", reason: "timeout" });

    // A's headers arrive late with an error status whose body pauses.
    const resA = response(409);
    reqA.resolve(resA);
    await vi.advanceTimersByTimeAsync(0);
    expect(h.answers()).toHaveLength(0);

    // B is submitted and is still pending.
    const reqB = deferred<ResponseLike>();
    const doneB = h.session.submit(B, h.send("POST B", reqB));
    expect(h.state.saving).toBe(true);

    // A's body finally resolves while B is pending.
    resA.body.resolve({});
    await vi.advanceTimersByTimeAsync(0);
    expect(h.answers()).toEqual([expect.objectContaining({ mode: "earlier", kind: "earlier-error", status: 409 })]);
    expect(h.state.saving).toBe(true); // B is still the one being saved

    // B succeeds; it isn't confused with A.
    reqB.resolve(response(201));
    await doneB;
    const last = h.answers().at(-1)!;
    expect(last).toMatchObject({ mode: "current", status: 201 });
    expect(h.writes).toEqual(["POST A", "POST B"]);
  });

  it("an earlier attempt accepted late is counted, so B's success carries the duplicate-risk notice", async () => {
    const h = harness();
    const reqA = deferred<ResponseLike>();
    const doneA = h.session.submit(A, h.send("POST A", reqA));
    await vi.advanceTimersByTimeAsync(DEADLINE);
    await doneA;
    const reqB = deferred<ResponseLike>();
    const doneB = h.session.submit(B, h.send("POST B", reqB));
    reqA.resolve(response(201));
    await vi.advanceTimersByTimeAsync(0);
    expect(h.answers()[0]).toMatchObject({ mode: "earlier", kind: "earlier-accepted" });
    reqB.resolve(response(201));
    await doneB;
    expect(h.answers()[1]).toMatchObject({ mode: "current", kind: "saved-earlier-accepted" });
  });

  it("B succeeds while A is still unresolved: no silent close", async () => {
    const h = harness();
    const doneA = h.session.submit(A, h.send("POST A"));
    await vi.advanceTimersByTimeAsync(DEADLINE);
    await doneA;
    const reqB = deferred<ResponseLike>();
    const doneB = h.session.submit(B, h.send("POST B", reqB));
    reqB.resolve(response(201));
    await doneB;
    expect(h.answers()[0]).toMatchObject({ kind: "saved-earlier-pending" });
  });

  it("a check whose GET pauses across a newer submit can't replace the newer attempt's state", async () => {
    const h = harness();
    const doneA = h.session.submit(A, h.send("POST A"));
    await vi.advanceTimersByTimeAsync(DEADLINE);
    await doneA;

    const get = deferred<{ ok: boolean; json: () => Promise<unknown> }>();
    const methods: string[] = [];
    const fetchImpl = (_url: string, init?: { method?: string }) => {
      methods.push(init?.method ?? "GET");
      return get.promise;
    };
    const checkDone = h.session.check(fetchImpl, "evt", A);
    expect(h.state.checking).toBe(true);

    // A newer submit starts while the GET is paused.
    const reqB = deferred<ResponseLike>();
    const doneB = h.session.submit(B, h.send("POST B", reqB));
    expect(h.state.checking).toBe(false);

    get.resolve({ ok: true, json: async () => ({ programs: [] }) });
    await checkDone;
    expect(h.checks()).toHaveLength(0); // stale check reported nothing
    expect(h.state.checking).toBe(false);
    expect(h.state.saving).toBe(true); // B still pending, untouched
    expect(methods).toEqual(["GET"]);

    reqB.resolve(response(201));
    await doneB;
    expect(h.writes).toEqual(["POST A", "POST B"]);
  });

  it("only the latest of two overlapping checks reports", async () => {
    const h = harness();
    const doneA = h.session.submit(A, h.send("POST A"));
    await vi.advanceTimersByTimeAsync(DEADLINE);
    await doneA;
    const g1 = deferred<{ ok: boolean; json: () => Promise<unknown> }>();
    const g2 = deferred<{ ok: boolean; json: () => Promise<unknown> }>();
    const queue = [g1, g2];
    const fetchImpl = () => queue.shift()!.promise;
    const c1 = h.session.check(fetchImpl, "evt", A);
    const c2 = h.session.check(fetchImpl, "evt", A);
    g2.resolve({ ok: true, json: async () => ({ programs: [{ id: "x", name: "Cue A", version: 1 }] }) });
    await c2;
    g1.resolve({ ok: true, json: async () => ({ programs: [] }) });
    await c1;
    expect(h.checks()).toHaveLength(1);
    expect(h.checks()[0].result.kind).toBe("create-name-visible");
  });
});

describe("P2-03: a confirmed save only clears the revision that was sent", () => {
  it("submit A, time out, edit to B, A succeeds late: revision doesn't match (B stays unsaved)", async () => {
    const h = harness();
    const reqA = deferred<ResponseLike>();
    const doneA = h.session.submit(A, h.send("POST A", reqA));
    await vi.advanceTimersByTimeAsync(DEADLINE);
    await doneA;
    h.edit(); // the user types B
    reqA.resolve(response(201));
    await vi.advanceTimersByTimeAsync(0);
    expect(h.answers()).toEqual([expect.objectContaining({ mode: "late", kind: "saved-late", revisionMatches: false })]);
  });

  it("an unchanged draft confirmed late matches, so it can close normally", async () => {
    const h = harness();
    const reqA = deferred<ResponseLike>();
    const doneA = h.session.submit(A, h.send("POST A", reqA));
    await vi.advanceTimersByTimeAsync(DEADLINE);
    await doneA;
    reqA.resolve(response(201));
    await vi.advanceTimersByTimeAsync(0);
    expect(h.answers()[0]).toMatchObject({ kind: "saved-late", revisionMatches: true });
  });

  it("an edit during a normal in-time save is detected too", async () => {
    const h = harness();
    const req = deferred<ResponseLike>();
    const done = h.session.submit(A, h.send("POST A", req));
    h.edit();
    req.resolve(response(200));
    await done;
    expect(h.answers()[0]).toMatchObject({ mode: "current", kind: "saved-close", revisionMatches: false });
  });
});

describe("review follow-ups", () => {
  it("send() throwing synchronously recovers as unknown, without a second try", async () => {
    const h = harness();
    let calls = 0;
    await h.session.submit(A, () => {
      calls++;
      throw new TypeError("Failed to fetch");
    });
    expect(calls).toBe(1);
    expect(h.state.saving).toBe(false);
    expect(h.effects).toContainEqual({ type: "unknown", reason: "network" });
  });

  it("A's late error body stalls while B is submitted: A is bounded and reported as earlier, B unaffected", async () => {
    const h = harness();
    const reqA = deferred<ResponseLike>();
    const doneA = h.session.submit(A, h.send("POST A", reqA));
    await vi.advanceTimersByTimeAsync(DEADLINE);
    await doneA;
    reqA.resolve(response(400)); // body never arrives
    await vi.advanceTimersByTimeAsync(1000);
    const reqB = deferred<ResponseLike>();
    const doneB = h.session.submit(B, h.send("POST B", reqB));
    await vi.advanceTimersByTimeAsync(DEADLINE - 1000); // A's body deadline passes; B's hasn't
    expect(h.answers()).toEqual([expect.objectContaining({ mode: "earlier", kind: "earlier-error", bodyTimedOut: true })]);
    expect(h.state.saving).toBe(true); // B still pending; A didn't touch it
    reqB.resolve(response(201));
    await doneB;
    expect(h.writes).toEqual(["POST A", "POST B"]);
  });

  it("an earlier attempt still being read counts as pending, so B's success carries the duplicate-risk notice", async () => {
    const h = harness();
    const reqA = deferred<ResponseLike>();
    const doneA = h.session.submit(A, h.send("POST A", reqA));
    await vi.advanceTimersByTimeAsync(DEADLINE);
    await doneA;
    const resA = response(500); // late headers, body still being read
    reqA.resolve(resA);
    await vi.advanceTimersByTimeAsync(0);
    const reqB = deferred<ResponseLike>();
    const doneB = h.session.submit(B, h.send("POST B", reqB));
    reqB.resolve(response(201));
    await doneB;
    expect(h.answers().at(-1)).toMatchObject({ mode: "current", kind: "saved-earlier-pending" });
  });

  it("after the form detaches its handler, a late answer reaches only the detached handler", async () => {
    const h = harness();
    const reqA = deferred<ResponseLike>();
    const doneA = h.session.submit(A, h.send("POST A", reqA));
    await vi.advanceTimersByTimeAsync(DEADLINE);
    await doneA;
    const before = h.effects.length;
    const detached: SaveEffect[] = [];
    h.session.setHandler((e) => detached.push(e)); // what the form does on unmount
    reqA.resolve(response(201));
    await vi.advanceTimersByTimeAsync(0);
    expect(h.effects).toHaveLength(before);
    expect(detached).toEqual([expect.objectContaining({ type: "answer", kind: "saved-late", snapshot: A })]);
  });

  it("a handler that throws on the answer still unlocks saving", async () => {
    const h = harness();
    const req = deferred<ResponseLike>();
    const done = h.session.submit(A, h.send("POST A", req));
    let saving = true;
    h.session.setHandler((e) => {
      if (e.type === "saving") saving = e.value;
      if (e.type === "answer") throw new Error("render failed");
    });
    req.resolve(response(400, (() => { const d = deferred<unknown>(); d.resolve({}); return d; })()));
    await expect(done).rejects.toThrow("render failed");
    expect(saving).toBe(false);
  });
});

describe("P2-04: an unresolved earlier attempt survives a successful manual retry", () => {
  const E: SubmittedSnapshot = { name: "Cue A", sessionId: "s1", version: 3 }; // an edit

  async function timeOut(h: ReturnType<typeof harness>, snap: SubmittedSnapshot, req: ReturnType<typeof deferred<ResponseLike>>) {
    const done = h.session.submit(snap, h.send(`POST ${snap.name}`, req));
    await vi.advanceTimersByTimeAsync(DEADLINE);
    await done;
  }

  it("network rejection → explicit retry → 201 keeps the notice", async () => {
    const h = harness();
    const reqA = deferred<ResponseLike>();
    const doneA = h.session.submit(A, h.send("POST A", reqA));
    reqA.reject(new TypeError("Failed to fetch"));
    await doneA;
    expect(h.effects).toContainEqual({ type: "unknown", reason: "network" });
    const reqB = deferred<ResponseLike>();
    const doneB = h.session.submit(A, h.send("POST A (retry)", reqB));
    reqB.resolve(response(201));
    await doneB;
    expect(h.answers().at(-1)).toMatchObject({ kind: "saved-earlier-unresolved", earlierUnresolved: 1, revisionMatches: true });
    expect(h.writes).toEqual(["POST A", "POST A (retry)"]);
  });

  it("504 → explicit retry → 201 keeps the notice", async () => {
    const h = harness();
    const reqA = deferred<ResponseLike>();
    const doneA = h.session.submit(A, h.send("POST A", reqA));
    reqA.resolve(response(504, (() => { const d = deferred<unknown>(); d.resolve(null); return d; })()));
    await doneA;
    expect(h.answers()[0].kind).toBe("unknown-server-error");
    expect(h.answers()[0].earlierUnresolved).toBe(0); // never warns about itself
    const reqB = deferred<ResponseLike>();
    const doneB = h.session.submit(A, h.send("POST A (retry)", reqB));
    reqB.resolve(response(201));
    await doneB;
    expect(h.answers().at(-1)).toMatchObject({ kind: "saved-earlier-unresolved", earlierUnresolved: 1 });
    expect(h.writes).toHaveLength(2);
  });

  it("header timeout → later rejection → explicit retry → 201 keeps the notice", async () => {
    const h = harness();
    const reqA = deferred<ResponseLike>();
    await timeOut(h, A, reqA);
    reqA.reject(new TypeError("network error"));
    await vi.advanceTimersByTimeAsync(0);
    const reqB = deferred<ResponseLike>();
    const doneB = h.session.submit(A, h.send("POST A (retry)", reqB));
    reqB.resolve(response(201));
    await doneB;
    // No longer transport-pending, still unresolved.
    expect(h.answers().at(-1)).toMatchObject({ kind: "saved-earlier-unresolved", earlierUnresolved: 1 });
    expect(h.writes).toHaveLength(2);
  });

  it("header timeout → later 5xx → explicit retry → 201 keeps the notice", async () => {
    const h = harness();
    const reqA = deferred<ResponseLike>();
    await timeOut(h, A, reqA);
    const late = response(502);
    reqA.resolve(late);
    late.body.resolve(null);
    await vi.advanceTimersByTimeAsync(0);
    expect(h.answers()[0]).toMatchObject({ mode: "late", kind: "unknown-server-error" });
    const reqB = deferred<ResponseLike>();
    const doneB = h.session.submit(A, h.send("POST A (retry)", reqB));
    reqB.resolve(response(201));
    await doneB;
    expect(h.answers().at(-1)).toMatchObject({ kind: "saved-earlier-unresolved", earlierUnresolved: 1 });
    expect(h.writes).toHaveLength(2);
  });

  it("a timed-out A that later fails while B is pending still marks B's success", async () => {
    const h = harness();
    const reqA = deferred<ResponseLike>();
    await timeOut(h, A, reqA);
    const reqB = deferred<ResponseLike>();
    const doneB = h.session.submit(A, h.send("POST A (retry)", reqB));
    reqA.reject(new TypeError("network error")); // A settles as unknown while B waits
    await vi.advanceTimersByTimeAsync(0);
    reqB.resolve(response(201));
    await doneB;
    expect(h.answers().at(-1)).toMatchObject({ kind: "saved-earlier-unresolved" });
    expect(h.writes).toHaveLength(2);
  });

  it("a clean first-attempt success still closes normally", async () => {
    const h = harness();
    const req = deferred<ResponseLike>();
    const done = h.session.submit(A, h.send("POST A", req));
    req.resolve(response(201));
    await done;
    expect(h.answers()).toEqual([expect.objectContaining({ kind: "saved-close", earlierUnresolved: 0 })]);
    expect(h.writes).toHaveLength(1);
  });

  it("a definitive rejection before the retry leaves no warning", async () => {
    const h = harness();
    const reqA = deferred<ResponseLike>();
    const doneA = h.session.submit(A, h.send("POST A", reqA));
    const body = deferred<unknown>();
    body.resolve({ errors: { fieldErrors: { name: ["Required"] } } });
    reqA.resolve(response(400, body));
    await doneA;
    const reqB = deferred<ResponseLike>();
    const doneB = h.session.submit(A, h.send("POST A (retry)", reqB));
    reqB.resolve(response(201));
    await doneB;
    expect(h.answers().at(-1)).toMatchObject({ kind: "saved-close", earlierUnresolved: 0 });
    expect(h.writes).toHaveLength(2);
  });

  it("a timed-out A later confirmed OK is resolved (accepted), not 'unresolved'", async () => {
    const h = harness();
    const reqA = deferred<ResponseLike>();
    await timeOut(h, A, reqA);
    const reqB = deferred<ResponseLike>();
    const doneB = h.session.submit(A, h.send("POST A (retry)", reqB));
    reqA.resolve(response(201));
    await vi.advanceTimersByTimeAsync(0);
    reqB.resolve(response(201));
    await doneB;
    expect(h.answers().at(-1)).toMatchObject({ kind: "saved-earlier-accepted", earlierUnresolved: 0 });
    expect(h.writes).toHaveLength(2);
  });

  it("a timed-out A later definitively rejected (4xx) clears to a normal close", async () => {
    const h = harness();
    const reqA = deferred<ResponseLike>();
    await timeOut(h, A, reqA);
    const late = response(400);
    reqA.resolve(late);
    late.body.resolve({});
    await vi.advanceTimersByTimeAsync(0);
    const reqB = deferred<ResponseLike>();
    const doneB = h.session.submit(A, h.send("POST A (retry)", reqB));
    reqB.resolve(response(201));
    await doneB;
    expect(h.answers().at(-1)).toMatchObject({ kind: "saved-close", earlierUnresolved: 0 });
    expect(h.writes).toHaveLength(2);
  });

  it("an edit retried after a network failure closes normally (the version guard rules A out)", async () => {
    const h = harness();
    const reqA = deferred<ResponseLike>();
    const doneA = h.session.submit(E, h.send("PATCH A", reqA));
    reqA.reject(new TypeError("Failed to fetch"));
    await doneA;
    const reqB = deferred<ResponseLike>();
    const doneB = h.session.submit(E, h.send("PATCH A (retry)", reqB));
    reqB.resolve(response(200));
    await doneB;
    expect(h.answers().at(-1)).toMatchObject({ kind: "saved-close", earlierUnresolved: 0 });
    expect(h.writes).toHaveLength(2);
  });

  it("a late success of the current attempt still reports an older unresolved one", async () => {
    const h = harness();
    const reqA = deferred<ResponseLike>();
    const doneA = h.session.submit(A, h.send("POST A", reqA));
    reqA.reject(new TypeError("Failed to fetch"));
    await doneA;
    const reqB = deferred<ResponseLike>();
    await timeOut(h, A, reqB);
    reqB.resolve(response(201));
    await vi.advanceTimersByTimeAsync(0);
    expect(h.answers().at(-1)).toMatchObject({ mode: "late", kind: "saved-late", earlierUnresolved: 1 });
    expect(h.writes).toHaveLength(2);
  });

  it("an earlier 5xx arriving before B's answer gives B the unresolved notice", async () => {
    const h = harness();
    const reqA = deferred<ResponseLike>();
    await timeOut(h, A, reqA);
    const reqB = deferred<ResponseLike>();
    const doneB = h.session.submit(A, h.send("POST A (retry)", reqB));
    const late = response(504);
    late.body.resolve(null);
    reqA.resolve(late);
    await vi.advanceTimersByTimeAsync(0);
    expect(h.answers()[0]).toMatchObject({ mode: "earlier", kind: "earlier-error", status: 504 });
    reqB.resolve(response(201));
    await doneB;
    expect(h.answers().at(-1)).toMatchObject({ kind: "saved-earlier-unresolved", earlierUnresolved: 1 });
    expect(h.writes).toHaveLength(2);
  });

  it("B's 201 before A's late 504: B warns as pending, then A is reported as an earlier 5xx", async () => {
    const h = harness();
    const reqA = deferred<ResponseLike>();
    await timeOut(h, A, reqA);
    const reqB = deferred<ResponseLike>();
    const doneB = h.session.submit(A, h.send("POST A (retry)", reqB));
    reqB.resolve(response(201));
    await doneB;
    expect(h.answers()[0]).toMatchObject({ kind: "saved-earlier-pending" });
    const late = response(504);
    late.body.resolve(null);
    reqA.resolve(late);
    await vi.advanceTimersByTimeAsync(0);
    // The form words an earlier create 5xx as "without a confirmed outcome", never as a plain failure.
    expect(h.answers()[1]).toMatchObject({ mode: "earlier", kind: "earlier-error", status: 504 });
    expect(h.writes).toHaveLength(2);
  });

  it("an edit retried after a 5xx closes normally too", async () => {
    const h = harness();
    const reqA = deferred<ResponseLike>();
    const doneA = h.session.submit(E, h.send("PATCH A", reqA));
    const res = response(503);
    res.body.resolve(null);
    reqA.resolve(res);
    await doneA;
    const reqB = deferred<ResponseLike>();
    const doneB = h.session.submit(E, h.send("PATCH A (retry)", reqB));
    reqB.resolve(response(200));
    await doneB;
    expect(h.answers().at(-1)).toMatchObject({ kind: "saved-close", earlierUnresolved: 0 });
    expect(h.writes).toHaveLength(2);
  });

  it("a send() that throws before sending isn't counted as possibly added", async () => {
    const h = harness();
    await h.session.submit(A, () => {
      throw new TypeError("blocked");
    });
    const reqB = deferred<ResponseLike>();
    const doneB = h.session.submit(A, h.send("POST A (retry)", reqB));
    reqB.resolve(response(201));
    await doneB;
    expect(h.answers().at(-1)).toMatchObject({ kind: "saved-close", earlierUnresolved: 0 });
  });
});
