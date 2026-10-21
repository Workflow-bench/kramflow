import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

// Audit remediation KF-003 (DEV-06): credential creation is disabled — no
// integration credential can ever acquire the controller lease
// (app/api/live/route.ts's LOCKED_ACTIONS), so minting new ones is worse
// than not offering it. GET (list) and DELETE (revoke) stay open.

const requireEventAccess = vi.fn();
const insert = vi.fn();

vi.mock("@/lib/server/require-event-access", () => ({ requireEventAccess }));
vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({ order: async () => ({ data: [], error: null }) }),
      }),
      insert,
    }),
  }),
}));

const { GET, POST } = await import("./route");

beforeEach(() => {
  requireEventAccess.mockReset();
  insert.mockReset();
});

describe("POST /api/events/[eventId]/integrations", () => {
  it("refuses to create a credential even for the event owner", async () => {
    requireEventAccess.mockResolvedValue({ userId: "owner-1", eventId: "event-a", role: "owner" });

    const res = await POST(
      new Request("http://x/api/events/event-a/integrations", {
        method: "POST",
        body: JSON.stringify({ label: "FOH Stream Deck" }),
      }),
      { params: Promise.resolve({ eventId: "event-a" }) }
    );

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({
      ok: false,
      error: "External API control credentials are not available yet. Coming soon.",
      code: "coming_soon",
    });
    expect(insert).not.toHaveBeenCalled();
  });

  it("short-circuits on requireEventAccess's own denial rather than reaching the coming-soon response", async () => {
    requireEventAccess.mockResolvedValue(
      NextResponse.json({ ok: false, error: "This requires owner access. You have viewer access to this event." }, { status: 403 })
    );

    const res = await POST(
      new Request("http://x/api/events/event-a/integrations", { method: "POST", body: JSON.stringify({ label: "x" }) }),
      { params: Promise.resolve({ eventId: "event-a" }) }
    );

    expect(await res.json()).toMatchObject({ error: "This requires owner access. You have viewer access to this event." });
    expect(insert).not.toHaveBeenCalled();
  });
});

describe("GET /api/events/[eventId]/integrations", () => {
  it("still lists existing credentials for the owner", async () => {
    requireEventAccess.mockResolvedValue({ userId: "owner-1", eventId: "event-a", role: "owner" });

    const res = await GET(new Request("http://x/api/events/event-a/integrations"), {
      params: Promise.resolve({ eventId: "event-a" }),
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, credentials: [] });
  });
});
