// The signed-in user's id as the browser knows it, for per-viewer client storage only
// (rehearsal runs). Set by the auth provider from the Supabase session. Never sent to a
// server by this module and never used for an authorization decision. A stale or unknown
// value fails closed: callers then persist nothing.
let currentUserId: string | null = null;
const EVENT = "kf-session-identity-change";

export function getSessionUserId(): string | null {
  return currentUserId;
}

export function setSessionUserId(id: string | null) {
  if (id === currentUserId) return;
  currentUserId = id;
  if (typeof window !== "undefined") window.dispatchEvent(new Event(EVENT));
}

export function subscribeSessionUserId(onChange: () => void): () => void {
  window.addEventListener(EVENT, onChange);
  return () => window.removeEventListener(EVENT, onChange);
}
