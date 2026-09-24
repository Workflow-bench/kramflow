import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requireEventAccess = vi.fn();
const guardAi = vi.fn();
const runStructured = vi.fn();
const commitCueSheet = vi.fn();

let programRows: Record<string, unknown>[];
let sessionRow: Record<string, unknown> | null;

function query(table: string) {
  const q = {
    select: () => q,
    eq: () => q,
    order: () => q,
    limit: async () => ({ data: programRows, error: null }),
    maybeSingle: async () => ({ data: table === "sessions" ? sessionRow : null, error: null }),
  };
  return q;
}

vi.mock("@/lib/server/require-event-access", () => ({ requireEventAccess }));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: () => ({ from: (t: string) => query(t) }) }));
vi.mock("@/lib/server/ai", async () => {
  class AiError extends Error {
    constructor(
      message: string,
      readonly status: number
    ) {
      super(message);
    }
  }
  return { runStructured, AiError, isAiConfigured: () => true };
});
vi.mock("@/lib/server/ai-guard", async () => {
  const { AiError } = await import("@/lib/server/ai");
  return {
    guardAi,
    aiErrorResponse: (err: unknown) =>
      NextResponse.json({ ok: false, error: (err as Error).message }, { status: err instanceof AiError ? err.status : 500 }),
  };
});
vi.mock("@/lib/server/cue-sheet-commit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/server/cue-sheet-commit")>();
  return { ...actual, commitCueSheet };
});

const alertRoute = await import("./alert-draft/route");
const reportRoute = await import("./session-report/route");
const reviewRoute = await import("./readiness-review/route");
const importRoute = await import("./cue-sheet-import/route");
const commitRoute = await import("./cue-sheet-import/commit/route");
const { AiError } = await import("@/lib/server/ai");

const json = (url: string, body: unknown) => new Request(`http://x${url}`, { method: "POST", body: JSON.stringify(body) });
const denied = () => NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

beforeEach(() => {
  requireEventAccess.mockReset().mockResolvedValue({ userId: "u1", eventId: "ev1", role: "owner" });
  guardAi.mockReset().mockResolvedValue(null);
  runStructured.mockReset();
  commitCueSheet.mockReset().mockResolvedValue({ ok: true, sessionsWritten: 1, programsWritten: 1 });
  programRows = [];
  sessionRow = { day_label: "Fri", session_label: "AM" };
});

describe("POST /api/ai/alert-draft", () => {
  const body = { eventId: "ev1", instruction: "Running 10 minutes behind" };

  it("requires owner access", async () => {
    await alertRoute.POST(json("/api/ai/alert-draft", body));
    expect(requireEventAccess).toHaveBeenCalledWith("ev1", "owner");
  });

  it("returns the access failure untouched and never calls the model", async () => {
    requireEventAccess.mockResolvedValue(denied());
    const res = await alertRoute.POST(json("/api/ai/alert-draft", body));
    expect(res.status).toBe(401);
    expect(runStructured).not.toHaveBeenCalled();
  });

  it("stops at the guard (unconfigured or rate limited)", async () => {
    guardAi.mockResolvedValue(NextResponse.json({ ok: false }, { status: 429 }));
    const res = await alertRoute.POST(json("/api/ai/alert-draft", body));
    expect(res.status).toBe(429);
    expect(runStructured).not.toHaveBeenCalled();
  });

  it("rejects a too-short instruction before spending a model call", async () => {
    const res = await alertRoute.POST(json("/api/ai/alert-draft", { eventId: "ev1", instruction: "x" }));
    expect(res.status).toBe(400);
    expect(guardAi).not.toHaveBeenCalled();
  });

  it("maps the model's draft to broadcast fields", async () => {
    runStructured.mockResolvedValue({ type: "warning", title: " Running late ", message: " Please stand by. ", priority: "high", audience: "green-room", acknowledgement_required: true });
    const res = await alertRoute.POST(json("/api/ai/alert-draft", body));
    expect(await res.json()).toEqual({
      ok: true,
      draft: { type: "warning", title: "Running late", message: "Please stand by.", priority: 3, audience: "green-room", acknowledgementRequired: true },
    });
  });

  it("surfaces an AI failure with its status", async () => {
    runStructured.mockRejectedValue(new AiError("busy", 429));
    const res = await alertRoute.POST(json("/api/ai/alert-draft", body));
    expect(res.status).toBe(429);
  });
});

describe("POST /api/ai/session-report", () => {
  const session = { label: "Fri • AM", isFinished: true, plannedMinutes: 60, actualMinutes: 70, startVarianceMinutes: 0, finishVarianceMinutes: 10, items: [] };

  it("allows a viewer", async () => {
    runStructured.mockResolvedValue({ headline: "h", summary: "s", went_well: [], lost_time: [], next_time: [] });
    const res = await reportRoute.POST(json("/api/ai/session-report", { eventId: "ev1", eventName: "Gala", sessions: [session] }));
    expect(requireEventAccess).toHaveBeenCalledWith("ev1", "viewer");
    expect(res.status).toBe(200);
  });

  it("rejects malformed figures", async () => {
    const res = await reportRoute.POST(json("/api/ai/session-report", { eventId: "ev1", eventName: "Gala", sessions: [] }));
    expect(res.status).toBe(400);
    expect(runStructured).not.toHaveBeenCalled();
  });
});

describe("POST /api/ai/readiness-review", () => {
  const row = (order: number, extra: Record<string, unknown> = {}) => ({
    sort_order: order, type: "item", name: `Item ${order}`, section_label: null, presenter: "Alex", presenter_contact: "+1 555 0100",
    duration: 5, start_time: null, end_time: null, audio_mics: false, audio_track: false, video_sidescreen: "none",
    video_ppt_needed: false, backdrop: false, remarks: null, presenter_requirement: null, status: "confirmed", ...extra,
  });

  it("requires a session id", async () => {
    const res = await reviewRoute.POST(json("/api/ai/readiness-review", { eventId: "ev1" }));
    expect(res.status).toBe(400);
  });

  it("404s for a session that isn't this event's", async () => {
    sessionRow = null;
    const res = await reviewRoute.POST(json("/api/ai/readiness-review", { eventId: "ev1", sessionId: "s" }));
    expect(res.status).toBe(404);
    expect(runStructured).not.toHaveBeenCalled();
  });

  it("422s on a session with no items", async () => {
    const res = await reviewRoute.POST(json("/api/ai/readiness-review", { eventId: "ev1", sessionId: "s" }));
    expect(res.status).toBe(422);
  });

  it("never sends a presenter's phone number to the model", async () => {
    programRows = [row(1)];
    runStructured.mockResolvedValue({ summary: "Fine.", findings: [] });
    await reviewRoute.POST(json("/api/ai/readiness-review", { eventId: "ev1", sessionId: "s" }));
    const prompt: string = runStructured.mock.calls[0][0].prompt;
    expect(prompt).not.toContain("555");
    expect(prompt).toContain('"has_presenter_contact":true');
  });

  it("drops references to items that don't exist", async () => {
    programRows = [row(1), row(2)];
    runStructured.mockResolvedValue({
      summary: "Two issues.",
      findings: [{ severity: "warn", title: "Overlap", detail: "d", item_orders: [1, 99, 2] }],
    });
    const res = await reviewRoute.POST(json("/api/ai/readiness-review", { eventId: "ev1", sessionId: "s" }));
    const data = await res.json();
    expect(data.findings[0].items).toEqual([{ order: 1, name: "Item 1" }, { order: 2, name: "Item 2" }]);
  });
});

describe("POST /api/ai/cue-sheet-import", () => {
  function form(entries: Record<string, string | File>) {
    const f = new FormData();
    for (const [k, v] of Object.entries(entries)) f.append(k, v);
    return new Request("http://x/api/ai/cue-sheet-import", { method: "POST", body: f });
  }

  const aiSheet = {
    sessions: [
      {
        day_label: "Fri", session_label: "AM",
        sections: [{ label: null, start_time: null, items: [{
          name: "Welcome", type: "item", presenter: null, description: null, duration_minutes: 5, start_time: null, end_time: null,
          presenter_requirement: null, presenter_contact: null, remarks: null, audio_mics: false, audio_track: false,
          video_sidescreen: "none", backdrop: false, video_ppt_needed: false, hall_lights: null, stage_lights: null,
          camera_angle: null, props: null, status: "confirmed",
        }] }],
      },
    ],
  };

  it("requires editor access and stops on denial", async () => {
    requireEventAccess.mockResolvedValue(denied());
    const res = await importRoute.POST(form({ eventId: "ev1", text: "6pm doors" }));
    expect(requireEventAccess).toHaveBeenCalledWith("ev1", "editor");
    expect(res.status).toBe(401);
    expect(runStructured).not.toHaveBeenCalled();
  });

  it("asks for a document", async () => {
    const res = await importRoute.POST(form({ eventId: "ev1" }));
    expect(res.status).toBe(400);
  });

  it("rejects an empty paste and an unsupported file type before the model", async () => {
    expect((await importRoute.POST(form({ eventId: "ev1", text: "   " }))).status).toBe(400);
    const res = await importRoute.POST(form({ eventId: "ev1", file: new File(["x"], "plan.pdf") }));
    expect(res.status).toBe(415);
    expect(runStructured).not.toHaveBeenCalled();
  });

  it("returns mapped rows for pasted text and sends it inside document tags", async () => {
    runStructured.mockResolvedValue(aiSheet);
    const res = await importRoute.POST(form({ eventId: "ev1", text: "9am Welcome 5 min" }));
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.sessions[0].id).toBe("fri-am");
    expect(data.programs[0]).toMatchObject({ name: "Welcome", duration: 5, sort_order: 1 });
    expect(data.errors).toEqual([]);
    expect(runStructured.mock.calls[0][0].prompt).toBe("<document>\n9am Welcome 5 min\n</document>");
  });

  it("reads a csv file", async () => {
    runStructured.mockResolvedValue(aiSheet);
    await importRoute.POST(form({ eventId: "ev1", file: new File(["a,b\n1,2"], "plan.csv") }));
    expect(runStructured.mock.calls[0][0].prompt).toContain("a,b\n1,2");
  });

  it("422s when nothing was found", async () => {
    runStructured.mockResolvedValue({ sessions: [] });
    const res = await importRoute.POST(form({ eventId: "ev1", text: "hello" }));
    expect(res.status).toBe(422);
  });
});

describe("POST /api/ai/cue-sheet-import/commit", () => {
  const sheet = () => ({
    sessions: [{ id: "fri-am", sheet_name: "", event_name: "", day_label: "Fri", session_label: "AM", sort_order: 0 }],
    partitions: [],
    programs: [{
      sort_order: 1, session_id: "fri-am", section_label: null, partition_id: null, type: "item", name: "Welcome", description: null,
      presenter: null, presenter_requirement: null, presenter_contact: null, duration: 5, start_time: null, end_time: null,
      audio_mics: false, audio_track: false, video_sidescreen: "none", backdrop: false, video_ppt_needed: false,
      hall_lights: null, stage_lights: null, camera_angle: null, props: null, curtains: null, remarks: null, status: "confirmed", color_tag: null,
    }],
  });

  it("requires editor access and writes nothing when denied", async () => {
    requireEventAccess.mockResolvedValue(denied());
    const res = await commitRoute.POST(json("/api/ai/cue-sheet-import/commit", { eventId: "ev1", sheet: sheet() }));
    expect(requireEventAccess).toHaveBeenCalledWith("ev1", "editor");
    expect(res.status).toBe(401);
    expect(commitCueSheet).not.toHaveBeenCalled();
  });

  it("commits a valid sheet under the caller's own event, not one named in the payload", async () => {
    const res = await commitRoute.POST(json("/api/ai/cue-sheet-import/commit", { eventId: "ev1", sheet: { ...sheet(), event_id: "other" } }));
    expect(res.status).toBe(200);
    expect(commitCueSheet.mock.calls[0][0]).toBe("ev1");
  });

  it("rejects rows that break the row rules", async () => {
    const s = sheet();
    s.programs[0].name = "";
    const res = await commitRoute.POST(json("/api/ai/cue-sheet-import/commit", { eventId: "ev1", sheet: s }));
    expect(res.status).toBe(400);
    expect(commitCueSheet).not.toHaveBeenCalled();
  });

  it("rejects an item that points at a session outside the payload", async () => {
    const s = sheet();
    s.programs[0].session_id = "someone-elses-session";
    const res = await commitRoute.POST(json("/api/ai/cue-sheet-import/commit", { eventId: "ev1", sheet: s }));
    expect(res.status).toBe(400);
    expect(commitCueSheet).not.toHaveBeenCalled();
  });

  it("rejects an empty import", async () => {
    const res = await commitRoute.POST(json("/api/ai/cue-sheet-import/commit", { eventId: "ev1", sheet: { sessions: [], partitions: [], programs: [] } }));
    expect(res.status).toBe(400);
  });

  it("passes a database failure through", async () => {
    commitCueSheet.mockResolvedValue({ ok: false, status: 500, error: "db down" });
    const res = await commitRoute.POST(json("/api/ai/cue-sheet-import/commit", { eventId: "ev1", sheet: sheet() }));
    expect(res.status).toBe(500);
  });
});
