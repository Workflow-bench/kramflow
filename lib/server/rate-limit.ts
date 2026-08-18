// In-memory per-IP lockout, originally written for the 4-digit PIN endpoint
// (only 10,000 combinations — trivially brute-forceable with zero
// throttling) and now reused for the real login endpoint (app/api/auth/
// login/route.ts): a password is a much bigger space than a PIN, but
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
// In-memory means this resets on a server restart and doesn't share state
// across multiple serverless instances — an acceptable gap for this app's
// actual threat model (deterring casual/automated guessing for a private
// event tool, not defending against a sophisticated distributed attacker).

interface AttemptRecord {
  failures: number;
  lockedUntil: number | null;
  lockoutMs: number;
}

const THRESHOLD = 8;
const BASE_LOCKOUT_MS = 30_000;
const MAX_LOCKOUT_MS = 5 * 60_000;

// Keyed by an arbitrary bucket name (e.g. "login", "pin") plus IP, so
// different endpoints don't share one global counter per IP — a burst of
// failed logins shouldn't also lock someone out of an unrelated endpoint
// reusing this same module.
const buckets = new Map<string, Map<string, AttemptRecord>>();

function bucketFor(name: string): Map<string, AttemptRecord> {
  let bucket = buckets.get(name);
  if (!bucket) {
    bucket = new Map();
    buckets.set(name, bucket);
  }
  return bucket;
}

export function checkRateLimit(bucket: string, ip: string): { allowed: boolean; retryAfterSeconds: number } {
  const record = bucketFor(bucket).get(ip);
  if (!record?.lockedUntil) return { allowed: true, retryAfterSeconds: 0 };
  const remainingMs = record.lockedUntil - Date.now();
  if (remainingMs <= 0) return { allowed: true, retryAfterSeconds: 0 };
  return { allowed: false, retryAfterSeconds: Math.ceil(remainingMs / 1000) };
}

export function recordFailure(bucket: string, ip: string): void {
  const map = bucketFor(bucket);
  const record = map.get(ip) ?? { failures: 0, lockedUntil: null, lockoutMs: BASE_LOCKOUT_MS };
  record.failures += 1;
  if (record.failures >= THRESHOLD) {
    record.lockedUntil = Date.now() + record.lockoutMs;
    record.lockoutMs = Math.min(record.lockoutMs * 2, MAX_LOCKOUT_MS);
    record.failures = 0;
  }
  map.set(ip, record);
}

export function recordSuccess(bucket: string, ip: string): void {
  bucketFor(bucket).delete(ip);
}

// NextRequest's `ip`/`geo` were removed in Next 15 — reading the standard
// forwarded-for header directly is the documented replacement.
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}
