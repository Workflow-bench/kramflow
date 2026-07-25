"use client";

import { useSyncExternalStore } from "react";
import type { Alert, LiveState } from "./types";
import { supabaseBrowser } from "./supabase/client";

// Live-state store — Supabase-backed (see supabase/schema.sql's `live_state`
// singleton row and docs/ARCHITECTURE.md's "State flow"). Public shape is
// unchanged from the pre-Supabase localStorage/BroadcastChannel version on
// purpose: every action here is the same fetch-and-call surface
// (`start()`, `next()`, ...), so no consuming component needed to change
// for this swap — including the Display Engine (`lib/display-engine/*`),
// which reads this same `useEventStore()`.
//
// Reads: hydrate once from Supabase, then stay current via Realtime on the
// `live_state` row. Writes: POST to app/api/live/route.ts (PATCH), which
// applies the mutation server-side and appends an activity_log row — the
// Realtime subscription is what brings the result back into this store,
// not the fetch response itself (kept deliberately optimistic-free for
// correctness; the round trip is well under the ~1s propagation target).

const initialState: LiveState = {
  activeSessionId: "",
  progressBySession: {},
  pausedAt: null,
  alert: null,
  notesOverrides: {},
};

let cachedState: LiveState = initialState;
let initialized = false;
let hydrating = false;
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

interface LiveStateRow {
  active_session_id: string | null;
  paused_at: string | null;
  alert: Alert | null;
  progress_by_session: LiveState["progressBySession"];
  notes_overrides: LiveState["notesOverrides"];
}

function mapRow(row: LiveStateRow): LiveState {
  return {
    activeSessionId: row.active_session_id ?? "",
    progressBySession: row.progress_by_session ?? {},
    pausedAt: row.paused_at,
    alert: row.alert,
    notesOverrides: row.notes_overrides ?? {},
  };
}

async function hydrate() {
  if (hydrating) return;
  hydrating = true;
  try {
    const { data, error } = await supabaseBrowser().from("live_state").select("*").eq("id", 1).single();
    if (error) throw error;
    cachedState = mapRow(data as LiveStateRow);
    notify();
  } catch (err) {
    console.error("[store] hydrate failed:", err);
  } finally {
    hydrating = false;
  }
}

function ensureBrowserListeners() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;

  supabaseBrowser()
    .channel("live-state-sync")
    .on("postgres_changes", { event: "*", schema: "public", table: "live_state" }, (payload) => {
      cachedState = mapRow(payload.new as LiveStateRow);
      notify();
    })
    .subscribe();
}

function subscribe(callback: () => void): () => void {
  ensureBrowserListeners();
  listeners.add(callback);

  if (!hydrating && cachedState === initialState) {
    hydrate().then(callback);
  }

  return () => listeners.delete(callback);
}

function getSnapshot(): LiveState {
  return cachedState;
}

function getServerSnapshot(): LiveState {
  return initialState;
}

// Retries once on 409 — app/api/live/route.ts returns that when its
// optimistic-concurrency check finds live_state changed between its read
// and write (two near-simultaneous actions). The route always recomputes
// from a fresh read, so simply resending the same action succeeds once the
// other write has landed; a second conflict in a row is astronomically
// unlikely for single-operator-driven actions, so this doesn't loop.
//
// Returns a boolean (not just void) so callers that need to distinguish a
// real failure from a real success — to show an error instead of a false
// "it worked" — can await this and branch on the result.
async function sendAction(body: Record<string, unknown>, attempt = 0): Promise<boolean> {
  try {
    const res = await fetch("/api/live", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.status === 409 && attempt < 2) return sendAction(body, attempt + 1);
    if (!res.ok) {
      console.error("[store] action failed:", body.action, res.status);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[store] action failed:", body.action, err);
    return false;
  }
}

// Every action now returns sendAction's promise (previously discarded —
// fire-and-forget) so callers that need to disable a button until the
// request lands (double-submit prevention) can await it. Callers that
// don't care can keep calling these exactly as before.
function selectSession(sessionId: string) {
  return sendAction({ action: "selectSession", sessionId });
}

function start() {
  return sendAction({ action: "start" });
}

function next(maxOrder: number) {
  return sendAction({ action: "next", maxOrder });
}

function previous(minOrder: number) {
  return sendAction({ action: "previous", minOrder });
}

function jumpTo(order: number) {
  return sendAction({ action: "jumpTo", order });
}

function finish(maxOrder: number) {
  return sendAction({ action: "finish", maxOrder });
}

function togglePause() {
  return sendAction({ action: "togglePause" });
}

function setAlert(alert: Alert) {
  return sendAction({ action: "setAlert", alert });
}

function dismissAlert() {
  return sendAction({ action: "dismissAlert" });
}

function setNotes(programId: string, notes: string) {
  return sendAction({ action: "setNotes", programId, notes });
}

function reset() {
  return sendAction({ action: "reset" });
}

export function useEventStore() {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return {
    state,
    selectSession,
    start,
    next,
    previous,
    jumpTo,
    finish,
    togglePause,
    setAlert,
    dismissAlert,
    setNotes,
    reset,
  };
}
