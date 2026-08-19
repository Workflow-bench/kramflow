import { NextResponse } from "next/server";
import { requireEventAccess } from "@/lib/server/require-event-access";
import { supabaseAdmin } from "@/lib/supabase/server";

// Report finding #26 / #25 — minimum-viable collaborator management.
// Invite-by-email against an *existing* Kramflow account only (no email
// invitations to non-users yet — that's a real gap, flagged separately as
// finding #25's fuller "team-member invite" ask, out of scope for this
// pass) — matches this being explicitly scoped as role-permission
// groundwork, not a full invite system.
export async function GET(_request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const auth = await requireEventAccess(eventId, "viewer");
  if (auth instanceof NextResponse) return auth;

  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("event_collaborators")
    .select("user_id, role, invited_email, created_at")
    .eq("event_id", eventId)
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, collaborators: data, yourRole: auth.role });
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
  if (listError) return NextResponse.json({ ok: false, error: listError.message }, { status: 500 });
  const match = usersPage.users.find((u) => u.email?.toLowerCase() === email);
  if (!match) {
    return NextResponse.json(
      { ok: false, error: "No Kramflow account found with that email — they need to sign up first." },
      { status: 404 }
    );
  }
  if (match.id === auth.userId) {
    return NextResponse.json({ ok: false, error: "You already own this event." }, { status: 400 });
  }

  const { error: insertError } = await admin
    .from("event_collaborators")
    .upsert({ event_id: eventId, user_id: match.id, role, invited_email: email }, { onConflict: "event_id,user_id" });
  if (insertError) return NextResponse.json({ ok: false, error: insertError.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const auth = await requireEventAccess(eventId, "owner");
  if (auth instanceof NextResponse) return auth;

  const userId = new URL(request.url).searchParams.get("userId");
  if (!userId) return NextResponse.json({ ok: false, error: "userId is required" }, { status: 400 });

  const admin = supabaseAdmin();
  const { error } = await admin.from("event_collaborators").delete().eq("event_id", eventId).eq("user_id", userId);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
