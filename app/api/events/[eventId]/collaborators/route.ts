import { NextResponse } from "next/server";
import { requireEventAccess } from "@/lib/server/require-event-access";
import { supabaseAdmin } from "@/lib/supabase/server";
import { generateInviteToken, INVITE_EXPIRY_DAYS } from "@/lib/server/collaborator-invites";
import { getUserDisplayName } from "@/lib/server/user-display-name";
import { logActivityAs } from "@/lib/server/activity-log";

// Report finding #26 / #25 — collaborator management. An email that matches
// an existing, *confirmed* Kramflow account is added immediately (status
// 'accepted'); one that doesn't gets a 'pending' row with its own
// invite_token — the same no-login-required, DB-resolved token pattern
// share_links.token uses — and a real invite email sent through Supabase
// Auth's own inviteUserByEmail (not a separate email provider — see
// app/auth/callback/route.ts for the link it sends). Sending isn't required
// for the invite to work: the owner always gets the accept link back in the
// response too, so it's copyable/shareable even if the email send fails.
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
  // A user row can exist but be unconfirmed — e.g. a prior invite via
  // Supabase's own inviteUserByEmail below already created the auth.users
  // row, but they never clicked the email link to set a password. That's
  // "no real account yet," not "add immediately as accepted": re-inviting
  // must go through the same pending-row + resend path as a first-time
  // invite, not silently mark them accepted without ever having consented.
  const match = found?.email_confirmed_at ? found : null;

  const { data: event, error: eventError } = await admin.from("events").select("name").eq("id", eventId).single();
  if (eventError || !event) return NextResponse.json({ ok: false, error: "Event not found." }, { status: 404 });

  const inviterName = await getUserDisplayName(admin, auth.userId);

  if (match) {
    const { error: insertError } = await admin
      .from("event_collaborators")
      .upsert(
        { event_id: eventId, user_id: match.id, role, invited_email: email, status: "accepted", accepted_at: new Date().toISOString() },
        { onConflict: "event_id,user_id" }
      );
    if (insertError) {
      console.error(insertError);
      return NextResponse.json({ ok: false, error: "Something went wrong. Try again." }, { status: 500 });
    }
    await logActivityAs(admin, eventId, auth.userId, "collaboratorAdd", `Added ${email} as ${role}`);
    return NextResponse.json({ ok: true, status: "accepted" });
  }

  // No account yet — create (or refresh) a pending invite row instead of
  // 404ing. Re-inviting the same still-pending email reuses the row rather
  // than erroring on event_collaborators_pending_email_idx — that index is
  // partial (WHERE status = 'pending'), which PostgREST's upsert() can't
  // target directly (its ON CONFLICT inference needs the same predicate,
  // and the JS client has no way to pass one), so the reuse check is done
  // explicitly instead of relying on ON CONFLICT.
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

  // Supabase's own invite mail — no separate email provider. The link it
  // sends completes at app/auth/callback/route.ts (PKCE code exchange),
  // which then hands off to /invite/[token]'s existing auto-accept path
  // (the visitor is signed in by then, so it just works). `data` populates
  // the Supabase email template's `{{ .Data.* }}` variables if the default
  // template is customized in the dashboard to use them; the stock template
  // ignores it, so this degrades to a generic "You've been invited" email
  // rather than failing.
  const origin = new URL(request.url).origin;
  const acceptUrl = `${origin}/invite/${token}`;
  const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent(`/invite/${token}`)}`;
  const { error: inviteEmailError } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo,
    data: { eventName: event.name, role, inviterName },
  });
  if (inviteEmailError) console.error("inviteUserByEmail failed:", inviteEmailError);

  return NextResponse.json({ ok: true, status: "pending", acceptUrl, emailSent: !inviteEmailError });
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
