import "server-only";
import { createHash, randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

export const INTEGRATION_SCOPES = ["state:read", "live:control"] as const;
export type IntegrationScope = (typeof INTEGRATION_SCOPES)[number];

export function createIntegrationToken(): string {
  return `kf_live_${randomBytes(32).toString("base64url")}`;
}

export function hashIntegrationToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function requireIntegrationCredential(request: Request, eventId: string, scope: IntegrationScope) {
  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!token || token.length > 256) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("integration_credentials")
    .select("id, event_id, label, scopes, revoked_at")
    .eq("token_hash", hashIntegrationToken(token))
    .maybeSingle();
  if (error || !data || data.event_id !== eventId || data.revoked_at || !Array.isArray(data.scopes) || !data.scopes.includes(scope)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  // Best-effort metadata only. A failure here must not turn a valid live
  // control request into a false authorization failure.
  void admin.from("integration_credentials").update({ last_used_at: new Date().toISOString() }).eq("id", data.id);
  return { id: data.id as string, eventId: data.event_id as string, label: data.label as string };
}
