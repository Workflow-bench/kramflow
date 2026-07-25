import { NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, createSessionToken } from "@/lib/server/auth-cookie";
import { checkPinRateLimit, getClientIp, recordPinFailure, recordPinSuccess } from "@/lib/server/rate-limit";

// Server-only: OPERATOR_PIN (no NEXT_PUBLIC_ prefix) never reaches the
// client bundle. Falls back to the documented default so the app works
// out of the box; production deployments should set a real value.
// See docs/DEPLOYMENT.md — this is a convenience gate, not real auth.
const OPERATOR_PIN = process.env.OPERATOR_PIN ?? "0065";

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const limit = checkPinRateLimit(ip);
  if (!limit.allowed) {
    return NextResponse.json(
      { ok: false, error: "Too many attempts", retryAfterSeconds: limit.retryAfterSeconds },
      { status: 429 }
    );
  }

  let pin: unknown;
  try {
    ({ pin } = await request.json());
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  if (typeof pin !== "string" || pin !== OPERATOR_PIN) {
    recordPinFailure(ip);
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  recordPinSuccess(ip);
  const res = NextResponse.json({ ok: true });
  // httpOnly, server-verifiable — the real enforcement layer for write API
  // routes. components/auth/auth-context.tsx's sessionStorage flag is still
  // what drives the PIN-screen UI; this cookie is what a write route
  // actually checks (lib/server/require-auth.ts). Session cookie (no
  // maxAge) to match sessionStorage's existing "clears on browser close"
  // behavior.
  res.cookies.set(AUTH_COOKIE_NAME, createSessionToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
  return res;
}

// Called from useAuth().lock() — clears the server-verifiable cookie so
// locking the UI actually revokes write access, not just the client-side
// sessionStorage flag driving the PIN screen.
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(AUTH_COOKIE_NAME);
  return res;
}
