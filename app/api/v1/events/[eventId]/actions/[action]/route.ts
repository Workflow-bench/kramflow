import { NextResponse } from "next/server";
import { requireIntegrationCredential } from "@/lib/server/integration-credentials";

const ACTIONS = new Set(["start", "hold", "resume", "next"]);

// Audit remediation KF-003 / R3 (Codex Phase 1 review): this route used to
// forward an authenticated credential straight to runLiveAction with
// clientId `integration:<credentialId>`. That was NOT "unconditionally
// locked" the way the first Phase 1 pass claimed — three real gaps:
//
//   1. `body.clientId` on PATCH /api/live (app/api/live/route.ts) is
//      whatever string the caller sends, unvalidated. An owner (who
//      already has full show control) can call claimControl with
//      clientId set to the exact string this route builds
//      (`integration:<uuid>` — the uuid is visible in the GET
//      /integrations response body, not secret). That claim would then
//      let this route's *old* forwarded action satisfy the lease check.
//      Not a privilege escalation (it requires owner access to begin
//      with), but it makes "a credential can never acquire the lease"
//      false, which is what the release policy actually needs.
//   2. hold-when-already-paused and resume-when-already-not-paused used
//      to return `200 {ok:true,noop:true}` without ever reaching the
//      lease check at all — inconsistent with "Coming Soon" being a firm,
//      deterministic policy rather than "sometimes 423, sometimes 200".
//   3. Gating in the *old* location (after a live_state read, inside the
//      no-op branch) meant the safety property depended on getting every
//      branch right, rather than being a single unconditional check.
//
// Fix: gate immediately after credential authentication, before any
// live_state read or dispatch. No code path in this file can reach
// runLiveAction or mutate live/display state for any of the four actions,
// regardless of lease, no-op, or clientId-collision state. Credential
// authentication itself (missing/revoked/malformed/wrong-event/wrong-scope
// → 401, via requireIntegrationCredential) is unchanged — a caller with an
// invalid credential still gets 401, not 403 coming_soon, preserving the
// existing anti-enumeration ordering. requireIntegrationCredential's own
// best-effort `last_used_at` update still runs on a valid credential; that
// is authentication metadata, not a show mutation, and is deliberately
// left as-is.
//
// GET /api/v1/events/[eventId]/state (state:read scope) is a separate
// route, untouched — it never touched the controller lease and still
// works for any existing credential.
export async function POST(request: Request, { params }: { params: Promise<{ eventId: string; action: string }> }) {
  const { eventId, action } = await params;
  if (!ACTIONS.has(action)) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  const credential = await requireIntegrationCredential(request, eventId, "live:control");
  if (credential instanceof NextResponse) return credential;
  return NextResponse.json(
    {
      ok: false,
      error: "External API control actions are not available yet. Coming soon.",
      code: "coming_soon",
    },
    { status: 403 }
  );
}
