"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { LiveState } from "@/lib/types";

// The rehearsal run (chosen session, progress, whether the operator acted) survives
// in-app history navigation (Back/forward, Link visits) through per-viewer
// sessionStorage. It is not shared and never reaches the server or a display.
// It is cleared only by an explicit discard: "Run again" resets it in place, and a
// confirmed Exit clears it. Leaving by Back does not discard meaningful progress.
export interface RehearsalRun {
  sessionId: string | null;
  state: LiveState;
  interacted: boolean;
}

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

const DEFAULT_RUN: RehearsalRun = { sessionId: null, state: EMPTY_RUN_STATE, interacted: false };
const EVENT = "kf-rehearsal-run-change";
const keyFor = (eventId: string) => `kf-rehearsal-run:${eventId}`;

const cache = new Map<string, { raw: string | null; run: RehearsalRun }>();

function readRun(eventId: string): RehearsalRun {
  let raw: string | null = null;
  try {
    raw = window.sessionStorage.getItem(keyFor(eventId));
  } catch {
    return DEFAULT_RUN;
  }
  const hit = cache.get(eventId);
  if (hit && hit.raw === raw) return hit.run;
  let run = DEFAULT_RUN;
  if (raw) {
    try {
      run = { ...DEFAULT_RUN, ...(JSON.parse(raw) as Partial<RehearsalRun>) };
    } catch {
      run = DEFAULT_RUN;
    }
  }
  cache.set(eventId, { raw, run });
  return run;
}

function writeRun(eventId: string, run: RehearsalRun) {
  try {
    window.sessionStorage.setItem(keyFor(eventId), JSON.stringify(run));
  } catch {
    // Storage unavailable: the run lasts for this page view only.
  }
  window.dispatchEvent(new Event(EVENT));
}

export function clearRun(eventId: string) {
  try {
    window.sessionStorage.removeItem(keyFor(eventId));
  } catch {
    // Nothing stored or storage unavailable.
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

// Same shape as the React state setters it replaces, so the view body is unchanged.
export function usePersistedRun(eventId: string) {
  const run = useSyncExternalStore(subscribe, () => readRun(eventId), () => DEFAULT_RUN);
  const update = useCallback(
    (next: (r: RehearsalRun) => RehearsalRun) => writeRun(eventId, next(readRun(eventId))),
    [eventId]
  );
  const setSessionId = useCallback((id: string | null) => update((r) => ({ ...r, sessionId: id })), [update]);
  const setState = useCallback(
    (u: LiveState | ((s: LiveState) => LiveState)) =>
      update((r) => ({ ...r, state: typeof u === "function" ? u(r.state) : u })),
    [update]
  );
  const setInteracted = useCallback((v: boolean) => update((r) => ({ ...r, interacted: v })), [update]);
  return { run, setSessionId, setState, setInteracted };
}
