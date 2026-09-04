import "server-only";
import { randomBytes } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase/server";
import type { EventRole } from "@/lib/server/require-event-access";

// Same opaque, DB-resolved token pattern as lib/server/share-links.ts, for
// the same reason: instant, single-invite revocation without a rotation
// that would kill every other pending invite too.
export function generateInviteToken(): string {
  return randomBytes(32).toString("base64url");
}

export const INVITE_EXPIRY_DAYS = 14;

export interface CollaboratorInviteRow {
  id: string;
  event_id: string;
  user_id: string | null;
  role: Exclude<EventRole, "owner">;
  invited_email: string;
  status: "pending" | "accepted";
  invite_token: string | null;
  invited_by: string | null;
  invite_expires_at: string | null;
  accepted_at: string | null;
  created_at: string;
}

export type ResolveInviteReason = "not_found" | "expired" | "already_accepted";

export type ResolveInviteResult =
  | { ok: true; invite: CollaboratorInviteRow; event: { id: string; name: string } }
  | { ok: false; reason: ResolveInviteReason };

// The one place both the /invite/[token] landing page and the accept route
// read a pending invite from — mirrors resolveShareLink()'s shape so the two
// token systems stay recognizably the same pattern even though they guard
// different things (display access vs. roster membership).
export async function resolveInvite(token: string): Promise<ResolveInviteResult> {
  const admin = supabaseAdmin();
  // Two plain queries rather than a PostgREST embed (`events(id, name)`) —
  // an embed needs the event_collaborators -> events foreign key registered
  // in PostgREST's schema cache, which this table can't be assumed to have
  // given schema.sql never had event_collaborators in it at all until this
  // feature (see the comment above the table definitions there).
  const { data, error } = await admin.from("event_collaborators").select("*").eq("invite_token", token).maybeSingle();
  if (error || !data) return { ok: false, reason: "not_found" };
  const invite = data as CollaboratorInviteRow;

  if (invite.status === "accepted") return { ok: false, reason: "already_accepted" };
  if (invite.invite_expires_at && new Date(invite.invite_expires_at).getTime() <= Date.now()) {
    return { ok: false, reason: "expired" };
  }

  const { data: event } = await admin.from("events").select("id, name").eq("id", invite.event_id).maybeSingle();
  if (!event) return { ok: false, reason: "not_found" };

  return { ok: true, invite, event };
}
