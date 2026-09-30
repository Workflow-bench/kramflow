import { NextResponse } from "next/server";
import { requireEventAccess } from "@/lib/server/require-event-access";
import { supabaseAdmin } from "@/lib/supabase/server";

export async function GET(_request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const auth = await requireEventAccess(eventId, "owner");
  if (auth instanceof NextResponse) return auth;
  const { data, error } = await supabaseAdmin()
    .from("integration_credentials")
    .select("id, label, scopes, created_at, last_used_at, revoked_at")
    .eq("event_id", auth.eventId)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ ok: false, error: "Could not load integrations" }, { status: 500 });
  return NextResponse.json({ ok: true, credentials: data ?? [] });
}

// Creation is disabled — audit finding DEV-06 / SEC-notes: the v1 actions
// adapter (app/api/v1/events/[eventId]/actions/[action]/route.ts) forwards
// every credentialed action to runLiveAction with a synthetic
// `integration:<credentialId>` clientId, but that id can never satisfy the
// controller-lease check in app/api/live/route.ts (LOCKED_ACTIONS) —
// there's no claimControl/renew/release action exposed to an integration
// credential anywhere in this codebase (confirmed by grep, not inference),
// so start/hold/resume/next return 423 Locked unconditionally. Minting new
// credentials for a control surface that structurally cannot work is worse
// than not offering it. Re-enable this once a real integration lease
// lifecycle (claim, renew, release/expire, takeover, audit) exists and is
// tested — see KF-003 in docs/audit-remediation/KRAMFLOW_REMEDIATION_TRACKER.md.
// GET (list) and DELETE (revoke) stay open so an owner can still see and
// clean up credentials created before this was disabled.
export async function POST(_request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const auth = await requireEventAccess(eventId, "owner");
  if (auth instanceof NextResponse) return auth;
  return NextResponse.json(
    {
      ok: false,
      error: "External API control credentials are not available yet. Coming soon.",
      code: "coming_soon",
    },
    { status: 403 }
  );
}
