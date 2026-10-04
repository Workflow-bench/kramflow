import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { getClientIp, reserveAttempt } from "@/lib/server/rate-limit";
import { isValidEmail } from "@/lib/validation/email";
import { SITE_ORIGIN } from "@/lib/site-origin";
import { GENERIC_RESET_MESSAGE } from "@/lib/reset-message";

// Requests a password reset email. Every request that passes validation gets
// the same success response, whether or not the email has an account, so the
// endpoint cannot be used to learn which addresses are registered. A separate
// per-IP budget bounds how many reset emails one client can trigger. The
// redirect target is built from SITE_ORIGIN, never from the request's Host
// header, so a spoofed header cannot change where the reset link points.
const BUCKET = "reset";
const POLICY = { threshold: 5, baseLockoutMs: 60_000, maxLockoutMs: 15 * 60_000 };
const DECAY_MS = 15 * 60_000;

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const reservation = await reserveAttempt(BUCKET, ip, POLICY, DECAY_MS);
  if (!reservation.allowed) {
    return NextResponse.json(
      { ok: false, error: "Too many reset requests. Please wait and try again.", retryAfterSeconds: reservation.retryAfterSeconds },
      { status: 429 }
    );
  }

  let body: { email?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!isValidEmail(email)) {
    return NextResponse.json({ ok: false, error: "Enter a valid email address." }, { status: 400 });
  }

  const supabase = await supabaseServer();
  const redirectTo = `${SITE_ORIGIN}/auth/callback?next=${encodeURIComponent("/set-password")}`;
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  // A provider error is logged for the operator, never returned: returning it
  // would tell a caller that some addresses behave differently from others.
  if (error) console.error("[reset] resetPasswordForEmail failed:", error.message);

  return NextResponse.json({ ok: true, message: GENERIC_RESET_MESSAGE });
}
