// The browser's view of the signed-in user, for per-viewer client storage only (rehearsal
// runs). Three states: unknown (before the first auth result), signed out (confirmed), and a
// user id. Never sent to a server and never used for an authorization decision.
let state: string | null | undefined = undefined;
const EVENT = "kf-session-identity-change";

// The user id to key client storage with. Unknown and signed-out both return null, and
// callers fail closed (no persistence) on null.
export function getSessionUserId(): string | null {
  return typeof state === "string" ? state : null;
}

// The raw state, for policy decisions: undefined = unknown, null = confirmed signed out.
export function getRawSessionUserId(): string | null | undefined {
  return state;
}

export function setSessionUserId(id: string | null) {
  if (id === state) return;
  state = id;
  if (typeof window !== "undefined") window.dispatchEvent(new Event(EVENT));
}

export function subscribeSessionUserId(onChange: () => void): () => void {
  window.addEventListener(EVENT, onChange);
  return () => window.removeEventListener(EVENT, onChange);
}
