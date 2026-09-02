import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { checkRateLimit, getClientIp, recordFailure, recordSuccess } from "@/lib/server/rate-limit";

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const limit = await checkRateLimit("login", ip);
  if (!limit.allowed) {
    return NextResponse.json(
      { ok: false, error: "Too many attempts. Please wait and try again.", retryAfterSeconds: limit.retryAfterSeconds },
      { status: 429 }
    );
  }

  let body: { email?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!email || !password) {
    return NextResponse.json({ ok: false, error: "Enter your email and password." }, { status: 400 });
  }

  const supabase = await supabaseServer();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    await recordFailure("login", ip);
    // Older GoTrue versions returned a distinct "Email not confirmed" for
    // an unconfirmed account, which this used to special-case into its own
    // message. Verified directly against this project's Auth API (bypassing
    // this route entirely) that it no longer does — a wrong password, an
    // unconfirmed account, and an email that was never registered all now
    // return the identical generic error, deliberately, as anti-enumeration
    // hardening. The "Email not confirmed" branch is kept in case an older
    // GoTrue version ever returns it, but the generic message below can no
    // longer claim the password itself is what's wrong — the login page's
    // "resend confirmation email" link (app/login/page.tsx) is what
    // actually recovers an operator from the unconfirmed case now, since
    // this response alone can't tell them apart.
    const message =
      error.message === "Email not confirmed"
        ? "Please confirm your email before logging in — check your inbox for the confirmation link."
        : "Incorrect email or password, or your account hasn't been confirmed yet.";
    return NextResponse.json({ ok: false, error: message }, { status: 401 });
  }

  await recordSuccess("login", ip);
  return NextResponse.json({ ok: true });
}
