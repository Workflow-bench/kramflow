import { NextResponse } from "next/server";
import { supabaseAdmin, supabaseServer } from "@/lib/supabase/server";

const MIN_PASSWORD_LENGTH = 8;

// The one place a temp password (issued by app/api/events/[eventId]/
// collaborators/route.ts) gets replaced with a real one. Requires an
// actual signed-in session — not a token in the URL — since the person is
// already logged in with the temp password by the time proxy.ts redirects
// them here; there's nothing else to prove identity with, and nothing else
// needed to.
export async function POST(request: Request) {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "You need to be logged in." }, { status: 401 });
  }

  let body: { password?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }

  const password = typeof body.password === "string" ? body.password : "";
  if (password.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json(
      { ok: false, error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` },
      { status: 400 }
    );
  }

  // Admin API, not supabase.auth.updateUser() from the user's own session —
  // clearing must_change_password (app_metadata) can only be done with the
  // service-role key; a client-side updateUser() call can only ever touch
  // user_metadata, which the user could otherwise clear themselves without
  // actually having changed anything.
  const admin = supabaseAdmin();
  const { error } = await admin.auth.admin.updateUserById(user.id, {
    password,
    app_metadata: { must_change_password: false },
  });
  if (error) {
    console.error(error);
    return NextResponse.json({ ok: false, error: "Something went wrong. Try again." }, { status: 500 });
  }

  // An admin password change invalidates the session that was active when
  // this request came in (confirmed live — the old cookies stopped passing
  // supabase.auth.getUser() immediately after) — sign back in with the new
  // password on the same cookie-aware client so the redirect this response
  // triggers lands on a session that's actually still valid, instead of
  // proxy.ts bouncing it straight back to /login.
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: user.email!,
    password,
  });
  if (signInError) {
    console.error(signInError);
    // The password itself was changed successfully — only the follow-up
    // sign-in failed — so send them to log in with it fresh rather than
    // reporting the whole operation as failed.
    return NextResponse.json({ ok: true, reauthFailed: true });
  }

  return NextResponse.json({ ok: true });
}
