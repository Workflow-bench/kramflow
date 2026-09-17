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

// One of each character class guaranteed, rather than trusting a long
// enough random string to happen to include all of them — this is the
// actual value a brand-new collaborator logs in with, so it has to clear
// whatever password-strength rule the login form enforces on the very
// first attempt, not usually-but-not-always.
const TEMP_PASSWORD_LOWER = "abcdefghijkmnpqrstuvwxyz"; // no l/o — visually ambiguous in an email
const TEMP_PASSWORD_UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // no I/O
const TEMP_PASSWORD_DIGIT = "23456789"; // no 0/1
const TEMP_PASSWORD_SYMBOL = "!@#$%^&*";
const TEMP_PASSWORD_ALL = TEMP_PASSWORD_LOWER + TEMP_PASSWORD_UPPER + TEMP_PASSWORD_DIGIT + TEMP_PASSWORD_SYMBOL;
const TEMP_PASSWORD_LENGTH = 12;

function randomChar(alphabet: string): string {
  return alphabet[randomBytes(1)[0] % alphabet.length];
}

// A one-time login credential sent in the invite email — the first-login
// flow (app/set-password, gated by proxy.ts on the must_change_password
// app_metadata flag) forces it to be replaced before the account can do
// anything else, so this only ever needs to be strong enough to survive
// sitting in an inbox briefly, not to be a real long-term password.
export function generateTempPassword(): string {
  const required = [
    randomChar(TEMP_PASSWORD_LOWER),
    randomChar(TEMP_PASSWORD_UPPER),
    randomChar(TEMP_PASSWORD_DIGIT),
    randomChar(TEMP_PASSWORD_SYMBOL),
  ];
  const rest = Array.from({ length: TEMP_PASSWORD_LENGTH - required.length }, () => randomChar(TEMP_PASSWORD_ALL));
  const chars = [...required, ...rest];
  // Fisher-Yates, so the four guaranteed characters aren't always the
  // first four positions.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomBytes(1)[0] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
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
