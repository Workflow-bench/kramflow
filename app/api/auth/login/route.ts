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
    // Deliberately the same message whether the email doesn't exist or the
    // password is wrong — distinguishing them would let an attacker
    // enumerate valid operator emails.
    const message =
      error.message === "Email not confirmed"
        ? "Please confirm your email before logging in — check your inbox for the confirmation link."
        : "Incorrect email or password.";
    return NextResponse.json({ ok: false, error: message }, { status: 401 });
  }

  await recordSuccess("login", ip);
  return NextResponse.json({ ok: true });
}
