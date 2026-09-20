import type { ShareLinkInvalidReason } from "@/lib/server/share-links";

// The reasons app/api/display-view/route.ts's `reason` field carries for a
// definitive, permanent access denial: an operator has to issue a new link to
// undo it. Anything else (a real 500, a network error) is transient and must
// keep retrying.
export type AccessDenialReason = ShareLinkInvalidReason | "no_token";

const ACCESS_DENIAL_REASONS: ReadonlySet<string> = new Set<AccessDenialReason>([
  "not_found",
  "revoked",
  "expired",
  "no_token",
]);

export function isDefinitiveAccessDenial(reason: unknown): reason is AccessDenialReason {
  return typeof reason === "string" && ACCESS_DENIAL_REASONS.has(reason);
}

export interface AccessGate {
  accessDenied: boolean;
}

// Wraps a request a display makes on its own behalf (register, heartbeat) so
// it is simply not sent once access is definitively denied. Such a request can
// never succeed again and only produces a 403 and a console error every few
// seconds. While access is valid the wrapped function runs untouched.
export function whileAccessValid<A extends unknown[], R>(
  gate: AccessGate,
  send: (...args: A) => Promise<R>
): (...args: A) => Promise<R | null> {
  return (...args) => (gate.accessDenied ? Promise.resolve(null) : send(...args));
}
