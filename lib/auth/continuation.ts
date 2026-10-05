import { safeNext } from "@/lib/safe-redirect";

// Context that carries a validated destination through login, signup, recovery and
// reauthentication (CD-F3, WIP-F2). Every untrusted value passes safeNext first.

// Invite tokens come from randomBytes(32).toString("base64url"): 43 characters of
// [A-Za-z0-9_-]. The wider 16–128 bound keeps older opaque tokens working. Anything else
// is refused before it can reach a path, so `?`, `#`, `/`, `\` and dot segments never
// change which route a token maps to.
export const INVITE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;

export function inviteDestination(token: string | null | undefined): string | null {
  if (!token || !INVITE_TOKEN_PATTERN.test(token)) return null;
  return `/invite/${encodeURIComponent(token)}`;
}

// A same-origin path, or null when absent or unsafe.
export function validatedNext(raw: string | null | undefined): string | null {
  const next = safeNext(raw, "");
  return next || null;
}

export function withNext(path: string, next: string | null): string {
  return next ? `${path}?next=${encodeURIComponent(next)}` : path;
}

// The destination recovery's callback lands on: set-password, carrying the validated next.
export function recoverySetPath(next: string | null | undefined): string {
  return withNext("/set-password", validatedNext(next));
}
