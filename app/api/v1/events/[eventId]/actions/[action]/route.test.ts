import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

// Audit remediation KF-003 / R3 (Codex Phase 1 review): prove the Coming
// Soon gate is unconditional — a valid credential never reaches
// runLiveAction or reads live_state, regardless of no-op or lease state,
// and an invalid credential still gets the original 401 (not 403
// coming_soon, which would leak "this credential would otherwise have
// worked").

const requireIntegrationCredential = vi.fn();
const runLiveAction = vi.fn();
const from = vi.fn();

vi.mock("@/lib/server/integration-credentials", () => ({ requireIntegrationCredential }));
vi.mock("@/app/api/live/route", () => ({ runLiveAction }));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: () => ({ from }) }));

const { POST } = await import("./route");

const params = (action: string) => ({ params: Promise.resolve({ eventId: "event-a", action }) });
const post = (action: string) =>
  POST(new Request(`http://x/api/v1/events/event-a/actions/${action}`, { method: "POST" }), params(action));

const validCredential = { id: "cred-1", eventId: "event-a", label: "FOH Stream Deck" };

beforeEach(() => {
  requireIntegrationCredential.mockReset();
  runLiveAction.mockReset();
  from.mockReset();
});

describe.each(["start", "hold", "resume", "next"])("POST /actions/%s", (action) => {
  it("returns 403 coming_soon for a fully valid credential, no live dispatch or state read", async () => {
    requireIntegrationCredential.mockResolvedValue(validCredential);

    const res = await post(action);

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({
      ok: false,
      error: "External API control actions are not available yet. Coming soon.",
      code: "coming_soon",
    });
    expect(runLiveAction).not.toHaveBeenCalled();
    expect(from).not.toHaveBeenCalled();
  });

  it("stays coming_soon even when live_state would have looked like a no-op (hold-already-paused / resume-already-running)", async () => {
    requireIntegrationCredential.mockResolvedValue(validCredential);
    // If the route still read live_state the old way, this would resolve
    // to the no-op branch — the point is it never gets there to check.
    from.mockReturnValue({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { active_session_id: "s1", paused_at: new Date().toISOString() }, error: null }) }) }),
    });

    const res = await post(action);

    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("coming_soon");
    expect(runLiveAction).not.toHaveBeenCalled();
    expect(from).not.toHaveBeenCalled();
  });

  it("stays coming_soon even when this credential's synthetic clientId would have matched an active lease", async () => {
    requireIntegrationCredential.mockResolvedValue(validCredential);
    // Simulates the clientId-collision path the Codex review found (an
    // owner can claimControl with clientId === `integration:<credentialId>`
    // via PATCH /api/live directly). Proves it's moot here: this route
    // doesn't construct that clientId or call runLiveAction at all anymore.
    from.mockReturnValue({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: { active_session_id: "s1", paused_at: null, controller_id: `integration:${validCredential.id}`, controller_claimed_at: new Date().toISOString() },
            error: null,
          }),
        }),
      }),
    });

    const res = await post(action);

    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("coming_soon");
    expect(runLiveAction).not.toHaveBeenCalled();
  });

  it("preserves the original 401 for an invalid credential — never reaches coming_soon", async () => {
    requireIntegrationCredential.mockResolvedValue(
      NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
    );

    const res = await post(action);

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ ok: false, error: "Unauthorized" });
    expect(runLiveAction).not.toHaveBeenCalled();
    expect(from).not.toHaveBeenCalled();
  });
});

describe("POST /actions/[action] — unknown action", () => {
  it("404s before even checking the credential", async () => {
    const res = await post("claimControl");
    expect(res.status).toBe(404);
    expect(requireIntegrationCredential).not.toHaveBeenCalled();
  });
});
