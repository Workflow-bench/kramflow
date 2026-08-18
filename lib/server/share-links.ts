import "server-only";
import { randomBytes } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase/server";

// Share-link tokens: the no-login side of "generate a link + QR tied to
// the event, someone on a TV opens it, picks a screen, sees a live
// read-only view — no login required." See supabase/schema.sql's
// share_links comment for why this is an opaque, DB-resolved token rather
// than a stateless signed URL (StageTimer's model) — the short version is
// instant, single-link revocation without touching any other link.
//
// 32 random bytes, base64url-encoded — ~43 characters, URL-safe with no
// padding, and 256 bits of entropy is comfortably unguessable (StageTimer's
// own signed URLs, by comparison, carry a similarly-sized HMAC signature —
// this is at least that strong, just verified by DB lookup instead of
// cryptographic signature check).
export function generateShareToken(): string {
  return randomBytes(32).toString("base64url");
}

export interface ShareLinkRow {
  id: string;
  token: string;
  event_id: string;
  label: string | null;
  created_by: string | null;
  created_at: string;
  expires_at: string;
  revoked_at: string | null;
  last_used_at: string | null;
}

export type ShareLinkInvalidReason = "not_found" | "revoked" | "expired";

export type ResolveShareLinkResult = { ok: true; link: ShareLinkRow } | { ok: false; reason: ShareLinkInvalidReason };

// The authoritative check — called from the /screens picker and from each
// display page's server-side gate (lib/server/verify-display-access.ts).
// Always goes through the service-role client: share_links has zero RLS
// policies (see schema), so an anon/browser client could never read it
// even if a page tried to check it client-side. That's deliberate — it
// forces every check through this one server-side path.
export async function resolveShareLink(token: string): Promise<ResolveShareLinkResult> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase.from("share_links").select("*").eq("token", token).maybeSingle();

  if (error || !data) return { ok: false, reason: "not_found" };
  const link = data as ShareLinkRow;

  if (link.revoked_at) return { ok: false, reason: "revoked" };
  if (new Date(link.expires_at).getTime() <= Date.now()) return { ok: false, reason: "expired" };

  // Fire-and-forget — last_used_at is informational (surfaced on the
  // dashboard so an operator can tell a link is actually being used), not
  // part of the validity check, so a failed write here shouldn't fail the
  // request that's already been validated above.
  void supabase.from("share_links").update({ last_used_at: new Date().toISOString() }).eq("id", link.id);

  return { ok: true, link };
}
