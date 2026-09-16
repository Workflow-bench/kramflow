import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const maybeSingle = vi.fn();
const eqEventId = vi.fn(() => ({ maybeSingle }));
const eqId = vi.fn(() => ({ eq: eqEventId, maybeSingle }));
const select = vi.fn(() => ({ eq: eqId }));
const from = vi.fn(() => ({ select }));
const verifyDisplayAccess = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: () => ({ from }),
}));

vi.mock("@/lib/server/verify-display-access", () => ({
  verifyDisplayAccess,
}));

const { requireBroadcastDisplayAccess } = await import("./require-broadcast-display-access");

beforeEach(() => {
  maybeSingle.mockReset();
  verifyDisplayAccess.mockReset();
});

describe("requireBroadcastDisplayAccess", () => {
  it("allows a caller whose token resolves to the broadcast event", async () => {
    maybeSingle.mockResolvedValue({ data: { event_id: "event-a" }, error: null });
    verifyDisplayAccess.mockResolvedValue({ ok: true, via: "token", eventId: "event-a" });

    await expect(requireBroadcastDisplayAccess("broadcast-1", "token-a", undefined)).resolves.toEqual({
      eventId: "event-a",
    });
  });

  it("rejects a caller authorized for a different event", async () => {
    maybeSingle.mockResolvedValue({ data: { event_id: "event-b" }, error: null });
    verifyDisplayAccess.mockResolvedValue({ ok: true, via: "token", eventId: "event-a" });

    const result = await requireBroadcastDisplayAccess("broadcast-1", "token-a", undefined);

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(404);
  });

  it("rejects a request without valid display access", async () => {
    maybeSingle.mockResolvedValue({ data: { event_id: "event-a" }, error: null });
    verifyDisplayAccess.mockResolvedValue({ ok: false, reason: "not_found" });

    const result = await requireBroadcastDisplayAccess("broadcast-1", "bad-token", undefined);

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(404);
  });
});
