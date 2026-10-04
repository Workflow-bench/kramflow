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
let broadcastRow: { id: string; event_id: string; dismissed_at: string | null; status: string } | null;
const writes: { table: string; patch: unknown; filters?: [string, unknown][] }[] = [];

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
      maybeSingle: async () => ({ data: displayTypeStateRow ?? null, error: null }),
      // Provisioning inserts missing rows with ignoreDuplicates. These tests
      // keep the row as set in beforeEach, so the upsert is a no-op here.
      upsert: async () => ({ error: null }),
      // Audit remediation B003 (Codex B002 review, standards/evidence
      // correction): an earlier version of this mock initialized a
      // missing row via `displayTypeStateRow ?? {defaults}` on update —
      // real SQL UPDATE never does that; an absent row stays absent and
      // the write matches zero rows. Fixed to mirror that: an update
      // against a null row is recorded as an attempted write (for tests
      // that want to assert "no write was attempted" on a denied
      // request) but never fabricates the row, so this mock cannot be
      // used to claim missing-row persistence works (see KF-031 — it
      // stays a separate, open, not-fixed-here finding; every test in
      // this file that expects a 200 keeps a real row present via
      // beforeEach, which is what's actually being proven: authorization,
      // not persistence-from-nothing).
      then(resolve: (v: unknown) => unknown) {
        if (chain._op === "update" && chain._patch) {
          writes.push({ table, patch: chain._patch });
          if (displayTypeStateRow) {
            displayTypeStateRow = { ...displayTypeStateRow, ...chain._patch } as typeof displayTypeStateRow;
          }
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
      // Provisioning reads the event's shared row to seed display_type_state.
      maybeSingle: async () => ({ data: { hold: { active: false }, timer: {}, timer_version: 0 }, error: null }),
      update(patch: Record<string, unknown>) {
        chain._op = "update";
        chain._patch = patch;
        return chain;
      },
      eq() {
        return chain;
      },
      single: async () => (displayStateRow ? { data: displayStateRow, error: null } : { data: null, error: { code: "PGRST116" } }),
      // Same fix as display_type_state above — no UPDATE-as-UPSERT.
      then(resolve: (v: unknown) => unknown) {
        if (chain._op === "update" && chain._patch) {
          writes.push({ table, patch: chain._patch });
          if (displayStateRow) {
            displayStateRow = { ...displayStateRow, ...chain._patch } as typeof displayStateRow;
          }
        }
        return resolve({ data: null, error: null });
      },
    };
    return chain;
  }
  if (table === "display_broadcasts") {
    // Supports exactly the two shapes require-broadcast-display-access.ts
    // and dismiss/route.ts use:
    //   .select("event_id").eq("id", broadcastId).maybeSingle()
    //   .update({dismissed_at}).eq("id", id).eq("event_id", eventId)   (awaited directly)
    // The update path only "matches" (and is recorded as a persisted
    // write) when BOTH filters match the real row — real SQL, not a
    // string-agnostic mock — so a scoping bug (e.g. missing the
    // event_id filter) would show up as a write the test didn't expect.
    const chain = {
      _op: "select" as "select" | "update",
      _patch: null as Record<string, unknown> | null,
      _filters: [] as [string, unknown][],
      select() {
        return chain;
      },
      update(patch: Record<string, unknown>) {
        chain._op = "update";
        chain._patch = patch;
        return chain;
      },
      eq(column: string, value: unknown) {
        chain._filters.push([column, value]);
        return chain;
      },
      maybeSingle: async () => {
        if (!broadcastRow) return { data: null, error: null };
        const idFilter = chain._filters.find(([c]) => c === "id");
        if (idFilter && idFilter[1] !== broadcastRow.id) return { data: null, error: null };
        return { data: { event_id: broadcastRow.event_id }, error: null };
      },
      then(resolve: (v: unknown) => unknown) {
        if (chain._op === "update" && chain._patch) {
          const idFilter = chain._filters.find(([c]) => c === "id");
          const eventFilter = chain._filters.find(([c]) => c === "event_id");
          const matches =
            broadcastRow &&
            (!idFilter || idFilter[1] === broadcastRow.id) &&
            (!eventFilter || eventFilter[1] === broadcastRow.event_id);
          if (matches) {
            writes.push({ table, patch: chain._patch, filters: [...chain._filters] });
            broadcastRow = { ...broadcastRow!, ...chain._patch } as typeof broadcastRow;
          }
          // No row matched both filters — real UPDATE reports success
          // with zero rows affected, not an error; dismiss/route.ts
          // doesn't check affected-row count (pre-existing, unrelated to
          // this batch), so mirror that rather than inventing stricter
          // behavior this route doesn't actually have.
          return resolve({ error: null });
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
const dismiss = await import("./broadcasts/[id]/dismiss/route");

beforeEach(() => {
  mockUser = null;
  event = { id: "event-a", owner_id: "owner-1" };
  collaborator = null;
  displayTypeStateRow = { hold: null, timer: { mode: "countdown", source: "auto", startedAt: null, durationSeconds: 0, pausedAt: null, adjustmentSeconds: 0, thresholds: {} }, timer_version: 1 };
  displayStateRow = { speaker_ready: {} };
  broadcastRow = { id: "broadcast-1", event_id: "event-a", dismissed_at: null, status: "sent" };
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

// Audit remediation KF-001 / B002-F1 (Codex B002 review): the original
// dismiss evidence used a nonexistent broadcast id, which 404s before
// role authorization even runs (require-broadcast-display-access.ts
// resolves the broadcast first) — that proves nothing about the owner
// floor. This matrix uses a real, existing broadcast row for every
// identity, and asserts the row is byte-unchanged on every denial, not
// just that the HTTP status looked right.
const dismissParams = (id: string) => ({ params: Promise.resolve({ id }) });
const postDismiss = (id: string, body: Record<string, unknown>) =>
  dismiss.POST(new Request(`http://x/api/display-engine/broadcasts/${id}/dismiss`, { method: "POST", body: JSON.stringify(body) }), dismissParams(id));

describe.each(IDENTITIES)("POST /api/display-engine/broadcasts/[id]/dismiss — $label, existing broadcast", ({ setUp, expectStatus }) => {
  it(`returns ${expectStatus === 200 ? 200 : 404} (dismiss's own anti-enumeration shape) and leaves the row ${expectStatus === 200 ? "dismissed" : "byte-unchanged"}`, async () => {
    setUp();
    const res = await postDismiss("broadcast-1", { eventId: "event-a" });
    if (expectStatus === 200) {
      expect(res.status).toBe(200);
      expect(writes).toHaveLength(1);
      expect(writes[0].table).toBe("display_broadcasts");
      // exact scoping — the write's own filters named both the right id
      // and the right event, not just "an id"
      expect(writes[0].filters).toEqual(
        expect.arrayContaining([
          ["id", "broadcast-1"],
          ["event_id", "event-a"],
        ])
      );
      expect(broadcastRow?.dismissed_at).not.toBeNull();
    } else {
      // dismiss answers every denial as 404 "not found" (its own existing
      // anti-enumeration convention, unchanged by this batch) rather than
      // 403 — verified here, not assumed.
      expect(res.status).toBe(404);
      expect(writes).toHaveLength(0);
      expect(broadcastRow).toEqual({ id: "broadcast-1", event_id: "event-a", dismissed_at: null, status: "sent" });
    }
  });
});

describe("POST /api/display-engine/broadcasts/[id]/dismiss — identity/scoping edge cases (not role tests)", () => {
  it("404s a nonexistent broadcast id for an owner session, before role is even consulted", async () => {
    mockUser = userWith("owner-1");
    const res = await postDismiss("does-not-exist", { eventId: "event-a" });
    expect(res.status).toBe(404);
    expect(writes).toHaveLength(0);
  });

  it("404s a broadcast that belongs to a different event than the caller is authorized for", async () => {
    mockUser = userWith("owner-1");
    broadcastRow = { id: "broadcast-1", event_id: "event-OTHER", dismissed_at: null, status: "sent" };
    const res = await postDismiss("broadcast-1", { eventId: "event-a" });
    expect(res.status).toBe(404);
    expect(writes).toHaveLength(0);
    expect(broadcastRow.dismissed_at).toBeNull();
  });

  it("404s a missing/invalid eventId in the request body, distinct from a role denial", async () => {
    mockUser = userWith("owner-1");
    const res = await postDismiss("broadcast-1", {});
    expect(res.status).toBe(404);
    expect(writes).toHaveLength(0);
  });
});
