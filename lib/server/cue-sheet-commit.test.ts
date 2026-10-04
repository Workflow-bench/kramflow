import { describe, it, expect, vi, beforeEach } from "vitest";

// Route-level contract for the atomic import (KF-006/007). The database
// transaction itself is covered by the migration's own SQL and a local
// emulator run; this test proves the app makes exactly one atomic call and
// maps failures generically without leaking database detail.

const rpc = vi.fn();
const from = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: () => ({ rpc, from }),
}));

import { commitCueSheet } from "./cue-sheet-commit";

const sheet = {
  sessions: [
    { id: "s1", sheet_name: "Sat", event_name: "E", day_label: "Sat", session_label: "AM", sort_order: 0 },
    { id: "s2-empty", sheet_name: "Sat", event_name: "E", day_label: "Sat", session_label: "PM", sort_order: 1 },
  ],
  partitions: [],
  programs: [
    {
      sort_order: 0, session_id: "s1", partition_id: null, section_label: null, type: "item", name: "Opening",
      description: null, presenter: null, presenter_requirement: null, presenter_contact: null, duration: 10,
      start_time: null, end_time: null, audio_mics: false, audio_track: false, video_sidescreen: null,
      backdrop: false, video_ppt_needed: false, hall_lights: null, stage_lights: null, camera_angle: null,
      props: null, curtains: null, remarks: null, status: null, color_tag: null,
    },
  ],
} as unknown as Parameters<typeof commitCueSheet>[2];

beforeEach(() => {
  rpc.mockReset();
  from.mockReset();
});

describe("commitCueSheet (single atomic RPC)", () => {
  it("makes exactly one rpc call with the actor, all sessions (including empty ones), and no direct table writes", async () => {
    rpc.mockResolvedValue({ data: { sessionsWritten: 2, programsWritten: 1 }, error: null });
    const result = await commitCueSheet("event-1", "user-1", sheet);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc.mock.calls[0][0]).toBe("import_cue_sheet");
    const args = rpc.mock.calls[0][1];
    expect(args.p_event_id).toBe("event-1");
    expect(args.p_actor_id).toBe("user-1");
    expect(args.p_sessions.map((s: { id: string }) => s.id)).toEqual(["s1", "s2-empty"]);
    expect(from).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: true, sessionsWritten: 2, programsWritten: 1 });
  });

  it("maps a database authorization rejection to 403 without detail", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "not_authorized" } });
    const result = await commitCueSheet("event-1", "user-2", sheet);
    expect(result).toEqual({ ok: false, status: 403, error: "Not allowed to import into this event." });
  });

  it("maps any other failure to a generic message and never echoes the database error", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "23505", message: "duplicate key value violates unique constraint sessions_pkey" } });
    const result = await commitCueSheet("event-1", "user-1", sheet);
    expect(result).toEqual({ ok: false, status: 500, error: "Import failed. Nothing was changed. Try again." });
    expect(JSON.stringify(result)).not.toContain("sessions_pkey");
  });
});
