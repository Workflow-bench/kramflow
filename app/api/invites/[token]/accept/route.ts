import { NextResponse } from "next/server";
import { resolveInvite } from "@/lib/server/collaborator-invites";
import { supabaseAdmin, supabaseServer } from "@/lib/supabase/server";
import { requirePasswordCurrent } from "@/lib/server/require-auth";

// The only place a pending event_collaborators row ever becomes an accepted
// one. Requires a real signed-in session (not just a valid token) — the
// token alone only proves "this invite exists," not "this visitor is the
// person it was sent to"; that's why it's cross-checked against the
// session's own email below rather than trusted from the URL.
//
// Audit remediation KF-002 / R2 (Codex Phase 1 review): this route used to
// do its own raw getUser() and stop there, on the theory that accepting an
// invite addressed to this exact email was a narrow, structurally-safe
// exception to the must_change_password boundary — the same category as
// login/logout/set-password. Codex correctly rejected that: the master
// remediation contract and the original Fix Guide both require invitation
// acceptance to fail until the temporary password is replaced, and
// matching the invite's email does not satisfy "replaced the temporary
// password." A flagged session must be able to log in, log out, and set a
// new password — nothing else, membership acceptance included. Checked
// here, before resolveInvite() ever runs, so a flagged caller learns
// nothing about the token's validity either.
export async function POST(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "You need to be logged in to accept an invite." }, { status: 401 });
  }
  const blocked = requirePasswordCurrent(user);
  if (blocked) return blocked;

  const resolved = await resolveInvite(token);
  if (!resolved.ok) {
    const messages: Record<typeof resolved.reason, string> = {
      not_found: "This invite isn't recognized.",
      expired: "This invite has expired. Ask the event owner to send a new one.",
      already_accepted: "This invite has already been accepted.",
    };
    return NextResponse.json({ ok: false, error: messages[resolved.reason] }, { status: 404 });
  }

  const { invite, event } = resolved;
  if (invite.invited_email.toLowerCase() !== user.email?.toLowerCase()) {
    return NextResponse.json(
      { ok: false, error: `This invite was sent to ${invite.invited_email}, but you're logged in as ${user.email}.` },
      { status: 403 }
    );
  }

  const admin = supabaseAdmin();
  // invite_token is deliberately left in place, not nulled — resolveInvite()
  // already refuses any further action on an accepted row (the
  // already_accepted branch above), so there's nothing left for the token
  // to authorize. Keeping it is what lets a stale/reused link resolve to
  // "this invite has already been accepted" instead of "not recognized,"
  // which read as if the link were simply wrong rather than already used
  // (QA finding: nulling it made the already_accepted branch unreachable).
  const { error } = await admin
    .from("event_collaborators")
    .update({
      user_id: user.id,
      status: "accepted",
      accepted_at: new Date().toISOString(),
    })
    .eq("id", invite.id);
  // A pre-existing accepted row for this (event, user) pair — from being
  // invited, removed, and invited again under a still-live old token, say —
  // would collide with the event_id,user_id unique constraint. Surface it
  // as "already a member" rather than a raw 500.
  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ ok: false, error: "You're already a collaborator on this event." }, { status: 409 });
    }
    console.error(error);
    return NextResponse.json({ ok: false, error: "Something went wrong. Try again." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, eventId: event.id, eventName: event.name });
}
