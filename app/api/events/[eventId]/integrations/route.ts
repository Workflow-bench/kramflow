import { NextResponse } from "next/server";
import { requireEventAccess } from "@/lib/server/require-event-access";
import { createIntegrationToken, hashIntegrationToken, INTEGRATION_SCOPES } from "@/lib/server/integration-credentials";
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

export async function POST(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const auth = await requireEventAccess(eventId, "owner");
  if (auth instanceof NextResponse) return auth;
  let body: { label?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 }); }
  const label = typeof body.label === "string" ? body.label.trim().slice(0, 80) : "";
  if (!label) return NextResponse.json({ ok: false, error: "A label is required" }, { status: 400 });
  const token = createIntegrationToken();
  const { data, error } = await supabaseAdmin()
    .from("integration_credentials")
    .insert({ event_id: auth.eventId, label, token_hash: hashIntegrationToken(token), scopes: [...INTEGRATION_SCOPES], created_by: auth.userId })
    .select("id, label, scopes, created_at, last_used_at, revoked_at")
    .single();
  if (error) return NextResponse.json({ ok: false, error: "Could not create integration" }, { status: 500 });
  return NextResponse.json({ ok: true, credential: data, token }, { status: 201 });
}
