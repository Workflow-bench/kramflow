// In-memory per-IP lockout for the PIN endpoint (app/api/auth/route.ts). A
// 4-digit PIN is only 10,000 combinations — with zero throttling, a script
// could brute-force it in seconds.
//
// Deliberately IP-only, not per-browser: at a real event, many operator
// devices typically sit behind the same venue WiFi NAT, so a per-browser
// fingerprint would need an extra cookie round-trip for marginal benefit.
// The threshold (8) and lockout (starts at 30s, doubles per repeat offense,
// capped at 5min) are generous enough that a handful of shared-IP operators
// mistyping their PIN won't meaningfully affect each other, while still
// making automated brute-force of all 10,000 combinations impractical.
//
// In-memory means this resets on a server restart and doesn't share state
// across multiple serverless instances — an acceptable gap for this app's
// actual threat model (deterring casual/automated guessing for a private
// event tool, not defending against a sophisticated distributed attacker).

interface AttemptRecord {
  failures: number;
  lockedUntil: number | null;
  lockoutMs: number;
}

const attempts = new Map<string, AttemptRecord>();
const THRESHOLD = 8;
const BASE_LOCKOUT_MS = 30_000;
const MAX_LOCKOUT_MS = 5 * 60_000;

export function checkPinRateLimit(ip: string): { allowed: boolean; retryAfterSeconds: number } {
  const record = attempts.get(ip);
  if (!record?.lockedUntil) return { allowed: true, retryAfterSeconds: 0 };
  const remainingMs = record.lockedUntil - Date.now();
  if (remainingMs <= 0) return { allowed: true, retryAfterSeconds: 0 };
  return { allowed: false, retryAfterSeconds: Math.ceil(remainingMs / 1000) };
}

export function recordPinFailure(ip: string): void {
  const record = attempts.get(ip) ?? { failures: 0, lockedUntil: null, lockoutMs: BASE_LOCKOUT_MS };
  record.failures += 1;
  if (record.failures >= THRESHOLD) {
    record.lockedUntil = Date.now() + record.lockoutMs;
    record.lockoutMs = Math.min(record.lockoutMs * 2, MAX_LOCKOUT_MS);
    record.failures = 0;
  }
  attempts.set(ip, record);
}

export function recordPinSuccess(ip: string): void {
  attempts.delete(ip);
}

// NextRequest's `ip`/`geo` were removed in Next 15 — reading the standard
// forwarded-for header directly is the documented replacement.
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}
