import { NextResponse } from "next/server";
import { normalizeTvCode } from "@/lib/tv-code";
import { resolveShareLinkByTvCode } from "@/lib/server/share-links";
import { getClientIp, refundAttempt, reserveAttempt, type RateLimitPolicy } from "@/lib/server/rate-limit";

// POST { code } — the no-login TV entry point. Turns a six-digit code into
// the same /screens?token=... path a Share Display link or QR already opens.
// It creates no session and no second authorization model: the caller is
// handed exactly what the share link itself is, and everything after that
// (the display pages, F-10 revoked-link handling, polling) is the existing
// token path, unchanged.
//
// One million codes is a small space, so this endpoint is stricter than
// login. Attempts are reserved atomically BEFORE the lookup (a burst of
// parallel guesses cannot all slip past a read-then-write check), and a
// valid code hands its attempt back so several TVs on one venue network can
// connect without locking each other out. Wrong guesses are never refunded,
// and a valid code never resets the counter.
const BUCKET = "tv-code";
const POLICY: RateLimitPolicy = { threshold: 5, baseLockoutMs: 60_000, maxLockoutMs: 30 * 60_000 };
const DECAY_MS = 15 * 60_000;

// Deliberately one message for every failure to resolve: a wrong code, a
// revoked share, and an expired share must be indistinguishable.
const INVALID = "Invalid or expired code.";

const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
  const ip = getClientIp(request);

  const reservation = await reserveAttempt(BUCKET, ip, POLICY, DECAY_MS);
  if (!reservation.allowed) {
    return NextResponse.json(
      { ok: false, error: "Too many attempts. Wait a moment and try again.", retryAfterSeconds: reservation.retryAfterSeconds },
      { status: 429, headers: { ...NO_STORE, "Retry-After": String(reservation.retryAfterSeconds) } }
    );
  }

  let body: { code?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: INVALID }, { status: 400, headers: NO_STORE });
  }

  const code = normalizeTvCode(body.code);
  if (!code) return NextResponse.json({ ok: false, error: INVALID }, { status: 400, headers: NO_STORE });

  const result = await resolveShareLinkByTvCode(code);
  if (!result.ok) return NextResponse.json({ ok: false, error: INVALID }, { status: 404, headers: NO_STORE });

  await refundAttempt(BUCKET, ip);

  // Only the path the TV needs. No event, user, or share identifiers.
  return NextResponse.json(
    { ok: true, href: `/screens?token=${encodeURIComponent(result.link.token)}` },
    { headers: NO_STORE }
  );
}
