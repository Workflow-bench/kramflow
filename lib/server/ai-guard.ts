import "server-only";
import { NextResponse } from "next/server";
import { AiError, isAiConfigured } from "@/lib/server/ai";
import { reserveAttempt, type RateLimitPolicy } from "@/lib/server/rate-limit";

// Shared gate for every /api/ai route, run after requireEventAccess. Two
// jobs: answer 503 when no ANTHROPIC_API_KEY is set (so the UI can hide or
// disable AI affordances instead of erroring), and cap how fast one user
// can spend model calls.
//
// The limiter is the existing Postgres-backed one, keyed by user id instead
// of IP: every call counts as an attempt and the bucket locks after
// `threshold` calls inside the decay window. That's a burn-rate guard
// against loops and abuse, not a quota — a per-plan monthly cap would slot
// in next to plan-limits.ts when billing exists.
const POLICY: RateLimitPolicy = {
  threshold: 20,
  baseLockoutMs: 60_000,
  maxLockoutMs: 10 * 60_000,
};
const DECAY_MS = 10 * 60_000;

export async function guardAi(userId: string, feature: string): Promise<NextResponse | null> {
  if (!isAiConfigured()) {
    return NextResponse.json({ ok: false, error: "AI features aren't set up on this server." }, { status: 503 });
  }
  const limit = await reserveAttempt(`ai:${feature}`, userId, POLICY, DECAY_MS);
  if (!limit.allowed) {
    return NextResponse.json(
      { ok: false, error: `Too many AI requests. Try again in ${limit.retryAfterSeconds}s.` },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }
  return null;
}

export function aiErrorResponse(err: unknown): NextResponse {
  if (err instanceof AiError) {
    return NextResponse.json({ ok: false, error: err.message }, { status: err.status });
  }
  console.error("Unexpected AI route error:", err);
  return NextResponse.json({ ok: false, error: "Something went wrong. Try again." }, { status: 500 });
}
