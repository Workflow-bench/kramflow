import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";

// Per-IP lockout, originally written for the 4-digit PIN endpoint (only
// 10,000 combinations — trivially brute-forceable with zero throttling)
// and now reused for the real login endpoint (app/api/auth/login/
// route.ts): a password is a much bigger space than a PIN, but
// credential-stuffing / guessing against a known email is exactly the same
// shape of problem, so the same generic limiter applies.
//
// Deliberately IP-only, not per-account: at a real event, many operator
// devices typically sit behind the same venue WiFi NAT, so a per-browser
// fingerprint would need an extra cookie round-trip for marginal benefit,
// and per-account lockout would let an attacker lock a real operator out
// just by repeatedly guessing their email. The threshold (8) and lockout
// (starts at 30s, doubles per repeat offense, capped at 5min) are generous
// enough that a handful of shared-IP operators mistyping a password won't
// meaningfully affect each other, while still making automated brute-force
// impractical.
//
// Backed by supabase/migrations/0003_rate_limits.sql's rate_limit_attempts
// table + check_and_record_rate_limit RPC — was an in-memory Map, which
// reset on every restart and didn't share state across serverless
// instances (see docs/DEPLOYMENT.md's old callout). The RPC does the
// increment/lockout/doubling atomically server-side rather than as a
// read-then-write from here, which also closes a race two concurrent
// failed requests could otherwise hit.

const THRESHOLD = 8;
const BASE_LOCKOUT_MS = 30_000;
const MAX_LOCKOUT_MS = 5 * 60_000;

export async function checkRateLimit(bucket: string, ip: string): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("rate_limit_attempts")
    .select("locked_until")
    .eq("bucket", bucket)
    .eq("ip", ip)
    .maybeSingle();

  // Fails open on a DB error — losing rate-limiting temporarily is a much
  // smaller problem than a Supabase blip locking every operator out of
  // login. The RPC called from recordFailure still enforces the lockout
  // for any request that does complete this round trip successfully.
  if (error || !data?.locked_until) return { allowed: true, retryAfterSeconds: 0 };

  const remainingMs = new Date(data.locked_until).getTime() - Date.now();
  if (remainingMs <= 0) return { allowed: true, retryAfterSeconds: 0 };
  return { allowed: false, retryAfterSeconds: Math.ceil(remainingMs / 1000) };
}

async function record(bucket: string, ip: string, success: boolean): Promise<void> {
  const supabase = supabaseAdmin();
  const { error } = await supabase.rpc("check_and_record_rate_limit", {
    p_bucket: bucket,
    p_ip: ip,
    p_success: success,
    p_threshold: THRESHOLD,
    p_base_lockout_ms: BASE_LOCKOUT_MS,
    p_max_lockout_ms: MAX_LOCKOUT_MS,
  });
  // Same fail-open reasoning as checkRateLimit — a logging hook would be
  // the right place to notice this happening repeatedly, not a thrown
  // error on the login/signup path.
  if (error) console.error("rate-limit record failed:", error.message);
}

export function recordFailure(bucket: string, ip: string): Promise<void> {
  return record(bucket, ip, false);
}

export function recordSuccess(bucket: string, ip: string): Promise<void> {
  return record(bucket, ip, true);
}

// NextRequest's `ip`/`geo` were removed in Next 15 — reading the standard
// forwarded-for header directly is the documented replacement.
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}
