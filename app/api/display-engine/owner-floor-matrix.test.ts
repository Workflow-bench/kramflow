import { beforeEach, describe, expect, it, vi } from "vitest";

// Audit remediation KF-001 / R1 (Codex Phase 1 review): the existing
// token-authority.test.ts mocks requireEventAccess directly, which proves
// each route *asks* for the right role but — per the review — "is
// insufficient as the entire matrix: exercise actual guard logic and
// actual route handling together". This file does that: only the
// Supabase client is mocked (DB rows), so verifySessionAccess ->
// requireEventAccess -> the real owner/editor/viewer/unrelated/anonymous
// resolution all run for real, against the real hold/timer/speaker-ready
// route handlers. Denied calls must reach zero writes; the owner call
// must reach exactly one.

let mockUser: Record<string, unknown> | null;
let event: { id: string; owner_id: string } | null;
let collaborator: { role: string } | null;
let displayTypeStateRow: { hold: unknown; timer: unknown; timer_version: number } | null;
let displayStateRow: { speaker_ready: Record<string, boolean> } | null;
const writes: { table: string; patch: unknown }[] = [];

function userWith(id: string) {
  return { id, email: `${id}@example.com`, app_metadata: { must_change_password: false } };
}

// A minimal, chainable, awaitable fake matching exactly the query shapes
// require-event-access.ts / hold / timer / speaker-ready actually call —
// not a general-purpose Postgrest mock, deliberately narrow to what's
// exercised here so a shape this doesn't support fails loudly instead of
// silently returning nothing.
function tableFor(table: string) {
  if (table === "events") {
    return {
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: event, error: null }) }),
      }),
    };
  }
  if (table === "event_collaborators") {
    return {
      select: () => ({
        eq: () => ({
          eq: () => ({ maybeSingle: async () => ({ data: collaborator, error: null }) }),
        }),
      }),
    };
  }
  if (table === "display_type_state") {
    const chain = {
      _op: "select" as "select" | "update",
      _patch: null as Record<string, unknown> | null,
      select() {
        return chain;
      },
      update(patch: Record<string, unknown>) {
        chain._op = "update";
        chain._patch = patch;
        return chain;
      },
      eq() {
        return chain;
      },
      single: async () => (displayTypeStateRow ? { data: displayTypeStateRow, error: null } : { data: null, error: { code: "PGRST116" } }),
      then(resolve: (v: unknown) => unknown) {
        if (chain._op === "update" && chain._patch) {
          writes.push({ table, patch: chain._patch });
          displayTypeStateRow = { ...(displayTypeStateRow ?? { hold: null, timer: null, timer_version: 1 }), ...chain._patch } as typeof displayTypeStateRow;
          return resolve({ data: displayTypeStateRow ? [displayTypeStateRow] : [], error: null });
        }
        return resolve({ data: null, error: null });
      },
    };
    return chain;
  }
  if (table === "display_state") {
    const chain = {
      _op: "select" as "select" | "update",
      _patch: null as Record<string, unknown> | null,
      select() {
        return chain;
      },
      update(patch: Record<string, unknown>) {
        chain._op = "update";
        chain._patch = patch;
        return chain;
      },
      eq() {
        return chain;
      },
      single: async () => (displayStateRow ? { data: displayStateRow, error: null } : { data: null, error: { code: "PGRST116" } }),
      then(resolve: (v: unknown) => unknown) {
        if (chain._op === "update" && chain._patch) {
          writes.push({ table, patch: chain._patch });
          displayStateRow = { ...(displayStateRow ?? { speaker_ready: {} }), ...chain._patch } as typeof displayStateRow;
        }
        return resolve({ data: null, error: null });
      },
    };
    return chain;
  }
  throw new Error(`owner-floor-matrix.test.ts: unexpected table "${table}" — extend tableFor() if this is a real new call shape`);
}

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: async () => ({ auth: { getUser: async () => ({ data: { user: mockUser } }) } }),
  supabaseAdmin: () => ({ from: tableFor }),
}));

const hold = await import("./hold/route");
const timer = await import("./timer/route");
const speakerReady = await import("./speaker-ready/route");

beforeEach(() => {
  mockUser = null;
  event = { id: "event-a", owner_id: "owner-1" };
  collaborator = null;
  displayTypeStateRow = { hold: null, timer: { mode: "countdown", source: "auto", startedAt: null, durationSeconds: 0, pausedAt: null, adjustmentSeconds: 0, thresholds: {} }, timer_version: 1 };
  displayStateRow = { speaker_ready: {} };
  writes.length = 0;
});

interface Identity {
  label: string;
  setUp: () => void;
  expectStatus: number;
}

const IDENTITIES: Identity[] = [
  { label: "owner", setUp: () => { mockUser = userWith("owner-1"); }, expectStatus: 200 },
  { label: "editor", setUp: () => { mockUser = userWith("collab-1"); collaborator = { role: "editor" }; }, expectStatus: 403 },
  { label: "viewer", setUp: () => { mockUser = userWith("collab-1"); collaborator = { role: "viewer" }; }, expectStatus: 403 },
  { label: "unrelated authenticated user", setUp: () => { mockUser = userWith("stranger-1"); collaborator = null; }, expectStatus: 403 },
  { label: "anonymous", setUp: () => { mockUser = null; }, expectStatus: 403 },
];

describe.each(IDENTITIES)("PATCH /api/display-engine/hold — $label", ({ setUp, expectStatus }) => {
  it(`returns ${expectStatus} and writes ${expectStatus === 200 ? "exactly once" : "nothing"}`, async () => {
    setUp();
    const res = await hold.PATCH(
      new Request("http://x/api/display-engine/hold", {
        method: "PATCH",
        body: JSON.stringify({ eventId: "event-a", displayType: "presenter", active: true, message: "test" }),
      })
    );
    expect(res.status).toBe(expectStatus);
    if (expectStatus === 200) {
      expect(writes).toHaveLength(1);
      expect(writes[0].table).toBe("display_type_state");
    } else {
      expect(writes).toHaveLength(0);
    }
  });
});

describe.each(IDENTITIES)("PATCH /api/display-engine/timer — $label", ({ setUp, expectStatus }) => {
  it(`returns ${expectStatus} and writes ${expectStatus === 200 ? "exactly once" : "nothing"}`, async () => {
    setUp();
    const res = await timer.PATCH(
      new Request("http://x/api/display-engine/timer", {
        method: "PATCH",
        body: JSON.stringify({ eventId: "event-a", displayType: "presenter", action: "pause" }),
      })
    );
    expect(res.status).toBe(expectStatus);
    if (expectStatus === 200) {
      expect(writes).toHaveLength(1);
      expect(writes[0].table).toBe("display_type_state");
    } else {
      expect(writes).toHaveLength(0);
    }
  });
});

describe.each(IDENTITIES)("PATCH /api/display-engine/speaker-ready — $label", ({ setUp, expectStatus }) => {
  it(`returns ${expectStatus} and writes ${expectStatus === 200 ? "exactly once" : "nothing"}`, async () => {
    setUp();
    const res = await speakerReady.PATCH(
      new Request("http://x/api/display-engine/speaker-ready", {
        method: "PATCH",
        body: JSON.stringify({ eventId: "event-a", programId: "program-1", ready: true }),
      })
    );
    expect(res.status).toBe(expectStatus);
    if (expectStatus === 200) {
      expect(writes).toHaveLength(1);
      expect(writes[0].table).toBe("display_state");
      expect((writes[0].patch as { speaker_ready: Record<string, boolean> }).speaker_ready).toEqual({ "program-1": true });
    } else {
      expect(writes).toHaveLength(0);
    }
  });
});
