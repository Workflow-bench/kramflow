import "server-only";
import { randomBytes, randomInt } from "node:crypto";
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

// Six-digit TV code: a human-typeable way to reach the SAME share_links row a
// URL or QR already reaches (resolved by resolveShareLinkByTvCode below, then
// handed to the normal /screens?token=... path). It carries no event, user,
// or display information, and it is never the display secret. randomInt is
// uniform and CSPRNG-backed. Only 1,000,000 values exist, so a collision
// with another live share is real and is handled by the caller retrying on
// the partial unique index (supabase/migrations/0015_share_link_tv_code.sql).
export function generateTvCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export interface ShareLinkRow {
  id: string;
  token: string;
  tv_code: string | null;
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
  return validateShareLink(supabase, data as ShareLinkRow);
}

// Resolves a six-digit TV code to its share, then applies the exact same
// validity rule as a token lookup (validateShareLink). Only non-revoked rows
// are queried because the unique index is partial: a revoked share's code may
// since have been issued to another share, and this must never match the old
// one. Expiry needs no filter here, validateShareLink rejects it. Every
// failure is "not_found" on purpose, the caller must not be able to tell a
// wrong code from a revoked or expired one.
export async function resolveShareLinkByTvCode(code: string): Promise<ResolveShareLinkResult> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("share_links")
    .select("*")
    .eq("tv_code", code)
    .is("revoked_at", null)
    .maybeSingle();

  if (error || !data) return { ok: false, reason: "not_found" };
  const result = await validateShareLink(supabase, data as ShareLinkRow);
  return result.ok ? result : { ok: false, reason: "not_found" };
}

// The single validity rule (revoked, then expired), shared by every way of
// reaching a share so a link, its QR, and its TV code can never disagree.
async function validateShareLink(
  supabase: ReturnType<typeof supabaseAdmin>,
  link: ShareLinkRow
): Promise<ResolveShareLinkResult> {
  if (link.revoked_at) return { ok: false, reason: "revoked" };
  if (new Date(link.expires_at).getTime() <= Date.now()) return { ok: false, reason: "expired" };

  // Fire-and-forget — last_used_at is informational (surfaced on the
  // dashboard so an operator can tell a link is actually being used), not
  // part of the validity check, so a failed write here shouldn't fail the
  // request that's already been validated above.
  void supabase.from("share_links").update({ last_used_at: new Date().toISOString() }).eq("id", link.id);

  return { ok: true, link };
}
