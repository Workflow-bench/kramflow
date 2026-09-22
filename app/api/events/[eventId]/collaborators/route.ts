import { NextResponse } from "next/server";
import { requireEventAccess } from "@/lib/server/require-event-access";
import { supabaseAdmin } from "@/lib/supabase/server";
import { generateInviteToken, generateTempPassword, INVITE_EXPIRY_DAYS } from "@/lib/server/collaborator-invites";
import { sendCollaboratorInviteToExistingAccountEmail, sendCollaboratorTempPasswordEmail } from "@/lib/server/email";
import { getUserDisplayName } from "@/lib/server/user-display-name";
import { logActivityAs } from "@/lib/server/activity-log";

// Report finding #26 / #25 — collaborator management. Every invite creates a
// 'pending' row with its own invite_token — the same no-login-required,
// DB-resolved token pattern share_links.token uses — and always requires an
// explicit accept, even when the email matches an existing, fully-onboarded
// Kramflow account: a revoke (the DELETE handler below) is a real removal,
// so re-inviting that email never silently re-grants access. What differs
// for a matched account is only that there's no password to set up — no
// temp password is created and their existing login is left untouched. An
// email that doesn't match a real account — or one that only exists because
// of a still-unclaimed prior invite — gets a temporary password created (or
// reissued) via the admin API instead. That account is real and confirmed
// immediately (no email-click step); app_metadata.must_change_password is
// what forces the temp password to be replaced on first login (proxy.ts +
// app/set-password) before it can do anything else. Sending isn't required
// for the invite to work either way: the owner always gets the accept link
// back in the response too, so it's copyable/shareable even if the email
// send fails.
export async function GET(_request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const auth = await requireEventAccess(eventId, "viewer");
  if (auth instanceof NextResponse) return auth;

  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("event_collaborators")
    .select("id, user_id, role, invited_email, status, invite_token, invite_expires_at, created_at")
    .eq("event_id", eventId)
    .order("created_at", { ascending: true });
  if (error) {
    console.error(error);
    return NextResponse.json({ ok: false, error: "Something went wrong. Try again." }, { status: 500 });
  }

  // invite_token is only ever useful to the person managing the roster
  // (this route already requires "viewer" to list, but the token is a real
  // access credential) — strip it for anyone below "owner" rather than
  // trusting every future caller of this GET to remember not to render it.
  const collaborators =
    auth.role === "owner" ? data : data?.map((c) => ({ ...c, invite_token: null }));

  return NextResponse.json({ ok: true, collaborators, yourRole: auth.role });
}

export async function POST(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  // Only the owner manages the roster — an editor granting themselves or
  // anyone else more access would defeat the point of having tiers at all.
  const auth = await requireEventAccess(eventId, "owner");
  if (auth instanceof NextResponse) return auth;

  let body: { email?: unknown; role?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const role = body.role === "editor" || body.role === "viewer" ? body.role : null;
  if (!email || !role) {
    return NextResponse.json({ ok: false, error: "A valid email and role (editor or viewer) are required." }, { status: 400 });
  }

  const admin = supabaseAdmin();

  // No direct getUserByEmail on this supabase-js version's admin API —
  // this project's real user count is small enough that a single
  // listUsers page comfortably covers it; would need real pagination
  // past a few thousand accounts.
  const { data: usersPage, error: listError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listError) {
    console.error(listError);
    return NextResponse.json({ ok: false, error: "Something went wrong. Try again." }, { status: 500 });
  }
  const found = usersPage.users.find((u) => u.email?.toLowerCase() === email);
  if (found?.id === auth.userId) {
    return NextResponse.json({ ok: false, error: "You already own this event." }, { status: 400 });
  }
  // A user row can exist but still be on their original temp password
  // (must_change_password never cleared — they were invited, maybe to a
  // different event, but never actually logged in yet). That's "no real
  // account yet," not "add immediately as accepted": re-inviting must
  // reissue a fresh temp password and go through the pending-row/resend
  // path again, not silently mark them accepted without ever having
  // completed first login.
  const match = found && !found.app_metadata?.must_change_password ? found : null;

  const { data: event, error: eventError } = await admin.from("events").select("name").eq("id", eventId).single();
  if (eventError || !event) return NextResponse.json({ ok: false, error: "Event not found." }, { status: 404 });

  const inviterName = await getUserDisplayName(admin, auth.userId);

  // Every invite — first-time, or a revoke-then-reinvite of someone who'd
  // accepted before — goes through the same pending/accept step, whether or
  // not the email already belongs to a real Kramflow account. A revoke is a
  // genuine removal (DELETE below hard-deletes the row), so being invited
  // again never silently re-grants access; the recipient always has to
  // click accept. Re-inviting the same still-pending email reuses the row
  // rather than erroring on event_collaborators_pending_email_idx — that
  // index is partial (WHERE status = 'pending'), which PostgREST's
  // upsert() can't target directly (its ON CONFLICT inference needs the
  // same predicate, and the JS client has no way to pass one), so the
  // reuse check is done explicitly instead of relying on ON CONFLICT.
  const token = generateInviteToken();
  const expiresAt = new Date(Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const pendingFields = {
    role,
    invited_email: email,
    status: "pending" as const,
    invite_token: token,
    invited_by: auth.userId,
    invite_expires_at: expiresAt,
  };

  const { data: existingPending } = await admin
    .from("event_collaborators")
    .select("id")
    .eq("event_id", eventId)
    .eq("invited_email", email)
    .eq("status", "pending")
    .maybeSingle();

  const { error: inviteError } = existingPending
    ? await admin.from("event_collaborators").update(pendingFields).eq("id", existingPending.id)
    : await admin.from("event_collaborators").insert({ event_id: eventId, user_id: null, ...pendingFields });
  if (inviteError) {
    console.error(inviteError);
    return NextResponse.json({ ok: false, error: "Something went wrong. Try again." }, { status: 500 });
  }
  await logActivityAs(admin, eventId, auth.userId, "collaboratorInvite", `Invited ${email} as ${role}`);

  const origin = new URL(request.url).origin;
  const acceptUrl = `${origin}/invite/${token}`;

  if (match) {
    // Already a real, confirmed account — no password to reset, nothing to
    // set up. They still have to accept like anyone else; this only skips
    // the account/temp-password step below.
    const emailResult = await sendCollaboratorInviteToExistingAccountEmail({
      to: email,
      eventName: event.name,
      role,
      inviterName,
      acceptUrl,
    });
    return NextResponse.json({ ok: true, status: "pending", acceptUrl, emailSent: emailResult.sent });
  }

  // No usable account yet — create (or reissue the temp password on an
  // unclaimed one from a prior invite) rather than waiting for a self-serve
  // signup. email_confirm: true means it's a real, usable account
  // immediately; must_change_password is what stops it being usable for
  // anything beyond logging in and setting a real password (enforced in
  // proxy.ts, cleared by app/api/auth/set-password/route.ts).
  const tempPassword = generateTempPassword();
  const { error: accountError } = found
    ? await admin.auth.admin.updateUserById(found.id, {
        password: tempPassword,
        app_metadata: { must_change_password: true },
      })
    : await admin.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
        app_metadata: { must_change_password: true },
      });
  if (accountError) {
    console.error(accountError);
    return NextResponse.json({ ok: false, error: "Something went wrong. Try again." }, { status: 500 });
  }

  const loginUrl = `${origin}/login?next=${encodeURIComponent(`/invite/${token}`)}&email=${encodeURIComponent(email)}`;
  const emailResult = await sendCollaboratorTempPasswordEmail({
    to: email,
    eventName: event.name,
    role,
    inviterName,
    tempPassword,
    loginUrl,
  });

  return NextResponse.json({ ok: true, status: "pending", acceptUrl, emailSent: emailResult.sent });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const auth = await requireEventAccess(eventId, "owner");
  if (auth instanceof NextResponse) return auth;

  const url = new URL(request.url);
  const userId = url.searchParams.get("userId");
  // Pending invites have no user_id yet, so they're revoked by row id
  // instead — same "revoke is a delete, scoped to exactly one row" model
  // as accepted collaborators and share_links.
  const inviteId = url.searchParams.get("inviteId");
  if (!userId && !inviteId) {
    return NextResponse.json({ ok: false, error: "userId or inviteId is required" }, { status: 400 });
  }

  const admin = supabaseAdmin();
  // Captured before the delete — the row (and the email/role it names) is
  // gone afterward, and the activity entry should say who was removed.
  const lookup = admin.from("event_collaborators").select("invited_email, role, status").eq("event_id", eventId);
  const { data: existing } = userId ? await lookup.eq("user_id", userId).maybeSingle() : await lookup.eq("id", inviteId!).maybeSingle();

  const query = admin.from("event_collaborators").delete().eq("event_id", eventId);
  const { error } = userId ? await query.eq("user_id", userId) : await query.eq("id", inviteId!);
  if (error) {
    console.error(error);
    return NextResponse.json({ ok: false, error: "Something went wrong. Try again." }, { status: 500 });
  }
  const label = existing ? `${existing.invited_email} (${existing.role})` : "a collaborator";
  const action = existing?.status === "pending" ? "Revoked invite for" : "Removed";
  await logActivityAs(admin, eventId, auth.userId, "collaboratorRemove", `${action} ${label}`);
  return NextResponse.json({ ok: true });
}
