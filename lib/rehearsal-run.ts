// Per-viewer storage for a rehearsal run. Pure helpers, no React.
//
// A run is keyed by the signed-in user, the event and nothing shared, so another
// identity on the same browser never reads it. A stored run is only trusted when its
// own user, event, session and cue fingerprint match what is on screen now. Any
// mismatch is treated as no run at all.

import type { LiveState, Session } from "@/lib/types";

export const RUN_KEY_PREFIX = "kf-rehearsal-run:";

export interface StoredRun {
  userId: string;
  eventId: string;
  sessionId: string | null;
  // Fingerprint of the session's cue data when the run was recorded.
  fingerprint: string | null;
  state: LiveState;
  interacted: boolean;
}

export function runKey(userId: string, eventId: string): string {
  return `${RUN_KEY_PREFIX}${userId}:${eventId}`;
}

// Stable and small. Changes when any cue's order, title, or duration changes, and when
// a cue is added or removed. Not a security hash: it only detects stale data.
export function cueFingerprint(session: Session | null | undefined): string | null {
  if (!session) return null;
  const parts = session.items.map((p) => `${p.order}|${p.id}|${p.title}|${p.durationMinutes}`).join("\n");
  let h = 5381;
  for (let i = 0; i < parts.length; i++) h = ((h << 5) + h + parts.charCodeAt(i)) | 0;
  return `${session.items.length}:${(h >>> 0).toString(16)}`;
}

// Returns the run only if every identifier matches. Otherwise null (fail closed).
export function trustRun(
  raw: unknown,
  expect: { userId: string; eventId: string }
): StoredRun | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Partial<StoredRun>;
  if (r.userId !== expect.userId || r.eventId !== expect.eventId) return null;
  if (typeof r.interacted !== "boolean" || !r.state || typeof r.state !== "object") return null;
  return r as StoredRun;
}

// The run is still valid for the cue data on screen.
export function runMatchesSession(
  run: Pick<StoredRun, "sessionId" | "fingerprint">,
  session: Session | null | undefined
): boolean {
  if (run.sessionId === null) return true;
  if (!session || session.id !== run.sessionId) return false;
  return run.fingerprint === cueFingerprint(session);
}

// Removes every rehearsal run from this browser's session storage, for any identity.
// Called on sign-out and on account changes so the next identity starts clean.
export function clearAllRuns(storage: Pick<Storage, "length" | "key" | "removeItem">): number {
  const keys: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const k = storage.key(i);
    if (k && k.startsWith(RUN_KEY_PREFIX)) keys.push(k);
  }
  for (const k of keys) storage.removeItem(k);
  return keys.length;
}
