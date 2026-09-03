import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { checkRateLimit, getClientIp, recordFailure, recordSuccess } from "@/lib/server/rate-limit";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Resends the signup confirmation email. Exists because login/route.ts can
// no longer reliably tell an operator *why* signInWithPassword failed:
// current GoTrue returns the identical "Invalid login credentials" for a
// wrong password, an unconfirmed account, AND an email that was never
// registered at all (anti-enumeration hardening — verified directly
// against this project's /auth/v1/token endpoint, bypassing this app's own
// error mapping, since it used to special-case a distinct "Email not
// confirmed" message that GoTrue simply doesn't send anymore). An operator
// stuck on a real unconfirmed account has no way to tell that apart from a
// typo'd password from the error message alone — this gives them a next
// step regardless of which one it actually was.
//
// Deliberately returns the same generic success response whether the
// email exists, is already confirmed, or was just resent — matching
// GoTrue's own anti-enumeration behavior rather than undoing it here.
export async function POST(request: Request) {
  const ip = getClientIp(request);
  const limit = await checkRateLimit("resend", ip);
  if (!limit.allowed) {
    return NextResponse.json(
      { ok: false, error: "Too many attempts. Please wait and try again.", retryAfterSeconds: limit.retryAfterSeconds },
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
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ ok: false, error: "Enter a valid email address." }, { status: 400 });
  }

  const supabase = await supabaseServer();
  const { error } = await supabase.auth.resend({ type: "signup", email });

  // Only a genuine rate limit is worth surfacing distinctly — anything else
  // (already confirmed, no such account, etc.) stays behind the same
  // generic success response so this endpoint doesn't become the thing
  // that leaks what /login and /signup deliberately don't.
  if (error?.message.toLowerCase().includes("rate limit")) {
    await recordFailure("resend", ip);
    return NextResponse.json(
      { ok: false, error: "Too many attempts right now. Please wait a few minutes and try again." },
      { status: 429 }
    );
  }

  await recordSuccess("resend", ip);
  return NextResponse.json({ ok: true });
}
