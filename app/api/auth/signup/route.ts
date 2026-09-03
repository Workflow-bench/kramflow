import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { checkRateLimit, getClientIp, recordFailure, recordSuccess } from "@/lib/server/rate-limit";

// Real per-operator accounts, replacing the single shared PIN (see
// docs/DEPLOYMENT.md's own "Hardening authentication" section, which named
// Supabase Auth as the upgrade path). Password hashing, session tokens, and
// expiry are all handled by Supabase's GoTrue service — this route is a
// thin wrapper that validates input and forwards to it.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

// Supabase/GoTrue's own error messages are written for logs, not for an
// end user mid-signup — e.g. a raw "email rate limit exceeded" string was
// previously passed straight through to the UI. Anything recognized maps to
// real product copy; anything unrecognized falls back to a generic message
// rather than ever surfacing GoTrue's internal wording verbatim.
function friendlySignupError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("already registered") || lower.includes("already exists")) {
    return "An account with that email already exists. Try logging in instead.";
  }
  if (lower.includes("rate limit")) {
    return "Too many signup attempts right now. Please wait a few minutes and try again.";
  }
  if (lower.includes("password")) {
    return "That password doesn't meet the requirements. Use at least 8 characters.";
  }
  if (lower.includes("email")) {
    return "That email address couldn't be used. Check it and try again.";
  }
  return "Something went wrong creating your account. Please try again.";
}

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const limit = await checkRateLimit("signup", ip);
  if (!limit.allowed) {
    return NextResponse.json(
      { ok: false, error: "Too many attempts. Please wait and try again.", retryAfterSeconds: limit.retryAfterSeconds },
      { status: 429 }
    );
  }

  let body: { email?: unknown; password?: unknown; name?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ ok: false, error: "Enter a valid email address." }, { status: 400 });
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json(
      { ok: false, error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` },
      { status: 400 }
    );
  }

  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: name ? { data: { name } } : undefined,
  });

  if (error) {
    await recordFailure("signup", ip);
    return NextResponse.json({ ok: false, error: friendlySignupError(error.message) }, { status: 400 });
  }

  await recordSuccess("signup", ip);

  // Two real outcomes depending on the Supabase project's Auth settings
  // (dashboard-configured, not something this app controls): if "Confirm
  // email" is off, signUp() already returns an active session and the
  // operator is logged in immediately. If it's on, session is null until
  // they click the confirmation link — surfaced distinctly so the client
  // shows "check your email" instead of silently failing to redirect.
  return NextResponse.json({ ok: true, needsEmailConfirmation: !data.session });
}
