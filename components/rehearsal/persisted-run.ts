"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { LiveState } from "@/lib/types";
import { getSessionUserId, subscribeSessionUserId } from "@/lib/auth/session-identity";
import { RUN_KEY_PREFIX, runKey, trustRun, type StoredRun } from "@/lib/rehearsal-run";

// The rehearsal run survives in-app navigation (Back, forward, Link visits) and reloads,
// per viewer, in sessionStorage, keyed by the signed-in user and the event. With no known
// identity it is kept in memory only, for this page view, and never written to storage.
// Cleared by: Reset rehearsal (explicit discard), confirmed Exit, sign-out and account
// changes (auth provider calls clearAllRuns), and a cue-data change (the run no longer
// matches; see runMatchesSession in the view).
export type RehearsalRun = Omit<StoredRun, "userId" | "eventId">;

export const EMPTY_RUN_STATE: LiveState = {
  activeSessionId: "",
  progressBySession: {},
  pausedAt: null,
  alert: null,
  notesOverrides: {},
  controllerId: null,
  controllerClaimedAt: null,
  itemActuals: {},
};

const DEFAULT_RUN: RehearsalRun = { sessionId: null, fingerprint: null, state: EMPTY_RUN_STATE, interacted: false };
const RUN_EVENT = "kf-rehearsal-run-change";
const memory = new Map<string, RehearsalRun>();

function readRun(userId: string | null, eventId: string): RehearsalRun {
  if (userId === null) return memory.get(eventId) ?? DEFAULT_RUN;
  let raw: string | null = null;
  try {
    raw = window.sessionStorage.getItem(runKey(userId, eventId));
  } catch {
    return DEFAULT_RUN;
  }
  if (!raw) return DEFAULT_RUN;
  try {
    const trusted = trustRun(JSON.parse(raw), { userId, eventId });
    return trusted ? { ...trusted } : DEFAULT_RUN;
  } catch {
    return DEFAULT_RUN;
  }
}

function writeRun(userId: string | null, eventId: string, run: RehearsalRun) {
  if (userId === null) {
    memory.set(eventId, run);
  } else {
    try {
      const stored: StoredRun = { ...run, userId, eventId };
      window.sessionStorage.setItem(runKey(userId, eventId), JSON.stringify(stored));
    } catch {
      // Storage unavailable: the run lasts for this page view only.
    }
  }
  window.dispatchEvent(new Event(RUN_EVENT));
}

// Explicit discard for this event and identity (confirmed Exit).
export function clearRun(eventId: string) {
  const userId = getSessionUserId();
  memory.delete(eventId);
  if (userId !== null) {
    try {
      window.sessionStorage.removeItem(runKey(userId, eventId));
    } catch {
      // Nothing stored or storage unavailable.
    }
  }
  window.dispatchEvent(new Event(RUN_EVENT));
}

// The run is read through useSyncExternalStore so its snapshot is stable (same stored
// text, same object) and the view re-renders when the identity changes.
const cache = new Map<string, { raw: string | null; run: RehearsalRun }>();
function snapshot(userId: string | null, eventId: string): RehearsalRun {
  if (userId === null) return readRun(null, eventId);
  let raw: string | null = null;
  try {
    raw = window.sessionStorage.getItem(runKey(userId, eventId));
  } catch {
    return DEFAULT_RUN;
  }
  const hit = cache.get(runKey(userId, eventId));
  if (hit && hit.raw === raw) return hit.run;
  const run = readRun(userId, eventId);
  cache.set(runKey(userId, eventId), { raw, run });
  return run;
}

function subscribe(onChange: () => void) {
  window.addEventListener(RUN_EVENT, onChange);
  window.addEventListener("storage", onChange);
  const off = subscribeSessionUserId(onChange);
  return () => {
    window.removeEventListener(RUN_EVENT, onChange);
    window.removeEventListener("storage", onChange);
    off();
  };
}

// Drops every stored and in-memory rehearsal run. Called by the auth provider on
// sign-out, sign-in, and account changes, so the next identity starts clean.
export function resetRehearsalRuns() {
  memory.clear();
  cache.clear();
  try {
    const storage = window.sessionStorage;
    const keys: string[] = [];
    for (let i = 0; i < storage.length; i++) {
      const k = storage.key(i);
      if (k && k.startsWith(RUN_KEY_PREFIX)) keys.push(k);
    }
    for (const k of keys) storage.removeItem(k);
  } catch {
    // Storage unavailable: memory is already cleared.
  }
  window.dispatchEvent(new Event(RUN_EVENT));
}

export interface PersistedRunOptions {
  // The base a write starts from. The view returns a fresh run when the stored one
  // no longer matches the cue data on screen, so stale progress is never merged in.
  resolveBase?: (r: RehearsalRun) => RehearsalRun;
  // Fields stamped on every write: the session the run belongs to and its cue fingerprint.
  stamp?: (r: RehearsalRun) => Partial<RehearsalRun>;
}

export function usePersistedRun(eventId: string, options: PersistedRunOptions = {}) {
  const userId = useSyncExternalStore(subscribeSessionUserId, getSessionUserId, () => null);
  const run = useSyncExternalStore(
    subscribe,
    () => snapshot(userId, eventId),
    () => DEFAULT_RUN
  );
  const { resolveBase, stamp } = options;
  const update = useCallback(
    (next: (r: RehearsalRun) => RehearsalRun) => {
      const current = snapshot(userId, eventId);
      const base = resolveBase ? resolveBase(current) : current;
      const written = next(base);
      writeRun(userId, eventId, { ...written, ...(stamp ? stamp(written) : {}) });
    },
    [userId, eventId, resolveBase, stamp]
  );
  const setSessionId = useCallback((id: string | null) => update((r) => ({ ...r, sessionId: id })), [update]);
  const setFingerprint = useCallback((f: string | null) => update((r) => ({ ...r, fingerprint: f })), [update]);
  const setState = useCallback(
    (u: LiveState | ((s: LiveState) => LiveState)) =>
      update((r) => ({ ...r, state: typeof u === "function" ? u(r.state) : u })),
    [update]
  );
  const setInteracted = useCallback((v: boolean) => update((r) => ({ ...r, interacted: v })), [update]);
  return { run, userId, setSessionId, setFingerprint, setState, setInteracted };
}
