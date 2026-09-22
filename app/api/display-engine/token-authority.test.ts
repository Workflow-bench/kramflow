import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

// A Share Display token (and the six-digit TV code that resolves to one) is
// read-only. These tests drive the real route handlers with the token
// resolver and the session check mocked at their own boundaries, so the real
// verifyDisplayAccess / verifySessionAccess wiring is what is being tested.

const resolveShareLink = vi.fn();
const resolveShareLinkByTvCode = vi.fn();
const requireEventAccess = vi.fn();

const dbCalls: string[][] = [];
const ROW = {
  event_id: "event-a",
  timer: { mode: "countdown", source: "auto", startedAt: null, durationSeconds: 0, pausedAt: null, adjustmentSeconds: 0, thresholds: {} },
  timer_version: 1,
  hold: { active: false },
  speaker_ready: {},
  name: "Event A",
  venue: null,
};

function builder() {
  const ops: string[] = [];
  dbCalls.push(ops);
  const q: unknown = new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === "then") {
          const result =
            ops.includes("update") && ops.includes("select")
              ? { data: [{ timer_version: 2 }], error: null }
              : ops.includes("update")
                ? { data: null, error: null }
                : { data: ROW, error: null };
          return (resolve: (v: unknown) => unknown) => resolve(result);
        }
        return () => {
          ops.push(String(prop));
          return q;
        };
      },
    }
  );
  return q;
}

vi.mock("@/lib/server/share-links", () => ({ resolveShareLink, resolveShareLinkByTvCode }));
vi.mock("@/lib/server/require-event-access", () => ({ requireEventAccess }));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: () => ({ from: () => builder() }) }));
vi.mock("@/lib/data/sessions", () => ({ fetchSessions: async () => [] }));
vi.mock("@/lib/server/rate-limit", () => ({
  getClientIp: () => "1.2.3.4",
  reserveAttempt: async () => ({ allowed: true, retryAfterSeconds: 0 }),
  refundAttempt: async () => {},
}));

const timer = await import("./timer/route");
const hold = await import("./hold/route");
const speakerReady = await import("./speaker-ready/route");
const dismiss = await import("./broadcasts/[id]/dismiss/route");
const promote = await import("./broadcasts/[id]/promote/route");
const displayView = await import("../display-view/route");
const tvConnect = await import("../tv/connect/route");

const json = (body: unknown) => ({ method: "POST", body: JSON.stringify(body) });
const unauthenticated = () => NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
const sessionFor = (eventId: string) => ({ userId: "user-1", eventId, role: "viewer" as const });
const validToken = () => resolveShareLink.mockResolvedValue({ ok: true, link: { event_id: "event-a", token: "tok-a" } });
const wrote = () => dbCalls.some((ops) => ops.includes("update") || ops.includes("insert") || ops.includes("upsert"));

interface MutationCase {
  name: string;
  call: (extra: Record<string, unknown>) => Promise<Response>;
  // The same "not allowed" answer the route gave before this change.
  denied: number;
}

const params = { params: Promise.resolve({ id: "broadcast-1" }) };
const cases: MutationCase[] = [
  {
    name: "timer",
    denied: 403,
    call: (extra) =>
      timer.PATCH(new Request("http://x/api/display-engine/timer", { ...json({ displayType: "presenter", action: "pause", ...extra }), method: "PATCH" })),
  },
  {
    name: "hold",
    denied: 403,
    call: (extra) =>
      hold.PATCH(new Request("http://x/api/display-engine/hold", { ...json({ displayType: "presenter", active: true, ...extra }), method: "PATCH" })),
  },
  {
    name: "speaker-ready",
    denied: 403,
    call: (extra) =>
      speakerReady.PATCH(new Request("http://x/api/display-engine/speaker-ready", { ...json({ programId: "p1", ready: true, ...extra }), method: "PATCH" })),
  },
  {
    // Kept as 404: broadcast routes answer "not found" for anything the
    // caller may not touch, the same convention as the rest of the app.
    name: "broadcast dismiss",
    denied: 404,
    call: (extra) => dismiss.POST(new Request("http://x/api/display-engine/broadcasts/b1/dismiss", json({ ...extra })), params),
  },
];

beforeEach(() => {
  dbCalls.length = 0;
  resolveShareLink.mockReset();
  resolveShareLinkByTvCode.mockReset();
  requireEventAccess.mockReset().mockResolvedValue(unauthenticated());
});

describe.each(cases)("$name mutation authority", ({ call, denied }) => {
  it("rejects a valid Share Display token and writes nothing", async () => {
    validToken();
    const res = await call({ token: "tok-a" });
    expect(res.status).toBe(denied);
    expect(wrote()).toBe(false);
  });

  it("ignores a valid token even when an eventId rides along", async () => {
    validToken();
    const res = await call({ token: "tok-a", eventId: "event-a" });
    expect(res.status).toBe(denied);
    expect(wrote()).toBe(false);
  });

  it("rejects a revoked token", async () => {
    resolveShareLink.mockResolvedValue({ ok: false, reason: "revoked" });
    const res = await call({ token: "tok-a" });
    expect(res.status).toBe(denied);
    expect(wrote()).toBe(false);
  });

  it("rejects an expired token", async () => {
    resolveShareLink.mockResolvedValue({ ok: false, reason: "expired" });
    const res = await call({ token: "tok-a" });
    expect(res.status).toBe(denied);
    expect(wrote()).toBe(false);
  });

  it("never even resolves the token, so it cannot be probed through this route", async () => {
    validToken();
    await call({ token: "tok-a" });
    expect(resolveShareLink).not.toHaveBeenCalled();
  });

  it("rejects a session that has no access to the event", async () => {
    requireEventAccess.mockResolvedValue(NextResponse.json({ ok: false, error: "Event not found" }, { status: 404 }));
    const res = await call({ eventId: "event-other" });
    expect(res.status).toBe(denied);
    expect(wrote()).toBe(false);
  });

  it("still works for an authorized operator session", async () => {
    requireEventAccess.mockResolvedValue(sessionFor("event-a"));
    const res = await call({ eventId: "event-a" });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true });
    expect(requireEventAccess).toHaveBeenCalledWith("event-a", "viewer");
    expect(wrote()).toBe(true);
  });
});

describe("read-only behaviour a Share Display token keeps", () => {
  it("can read display state through display-view", async () => {
    validToken();
    const res = await displayView.GET(new Request("http://x/api/display-view?token=tok-a&displayType=general"));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, eventId: "event-a", eventName: "Event A" });
    expect(wrote()).toBe(false);
  });

  it("keeps the F-10 contract: a revoked, expired or unknown token gets 403 with a reason", async () => {
    for (const reason of ["revoked", "expired", "not_found"] as const) {
      resolveShareLink.mockResolvedValue({ ok: false, reason });
      const res = await displayView.GET(new Request("http://x/api/display-view?token=tok-a"));
      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({ ok: false, reason });
    }
  });

  it("still lets an operator session read the same view", async () => {
    requireEventAccess.mockResolvedValue(sessionFor("event-a"));
    const res = await displayView.GET(new Request("http://x/api/display-view?eventId=event-a"));
    expect(res.status).toBe(200);
  });
});

describe("scheduled broadcast promotion (token allowed, but only when due)", () => {
  it("filters on scheduled_for so a token cannot release a broadcast early", async () => {
    validToken();
    const res = await promote.POST(new Request("http://x/p", json({ token: "tok-a" })), params);
    expect(res.status).toBe(200);
    const update = dbCalls.find((ops) => ops.includes("update"));
    expect(update).toContain("lte");
    expect(update).toContain("eq");
  });

  it("rejects a revoked token", async () => {
    resolveShareLink.mockResolvedValue({ ok: false, reason: "revoked" });
    const res = await promote.POST(new Request("http://x/p", json({ token: "tok-a" })), params);
    expect(res.status).toBe(404);
    expect(wrote()).toBe(false);
  });
});

describe("six-digit TV code stays read-only", () => {
  it("resolves normally, and the token it hands back cannot mutate anything", async () => {
    resolveShareLinkByTvCode.mockResolvedValue({ ok: true, link: { token: "tok-a", event_id: "event-a", id: "s1" } });
    const res = await tvConnect.POST(new Request("http://x/api/tv/connect", json({ code: "482 731" })));
    expect(res.status).toBe(200);
    const { href } = (await res.json()) as { href: string };
    expect(href).toBe("/screens?token=tok-a");

    validToken();
    const token = new URL(href, "http://x").searchParams.get("token")!;
    for (const { call, denied } of cases) {
      const attempt = await call({ token });
      expect(attempt.status).toBe(denied);
    }
    expect(wrote()).toBe(false);
  });
});

// Fails when a new API route starts accepting Share Display tokens without
// someone deciding that on purpose and adding it here.
describe("routes that accept a Share Display token", () => {
  const TOKEN_ROUTES = [
    "app/api/display-view/route.ts",
    "app/api/display-engine/profiles/[id]/route.ts",
    "app/api/display-engine/registry/route.ts",
    "app/api/display-engine/broadcasts/[id]/promote/route.ts",
    "app/api/display-engine/broadcasts/[id]/acknowledge/route.ts",
  ];

  function routeFiles(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return routeFiles(full);
      return entry.name === "route.ts" ? [full] : [];
    });
  }

  it("is exactly the reviewed list", () => {
    const root = path.resolve(__dirname, "../../..");
    const found = routeFiles(path.join(root, "app/api"))
      .filter((file) => /verifyDisplayAccess|requireBroadcastDisplayAccess/.test(readFileSync(file, "utf8")))
      .map((file) => path.relative(root, file).split(path.sep).join("/"))
      .sort();
    expect(found).toEqual([...TOKEN_ROUTES].sort());
  });
});
