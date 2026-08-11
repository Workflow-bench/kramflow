"use client";

import { useSyncExternalStore } from "react";
import type { Alert, LiveState } from "./types";
import { supabaseBrowser } from "./supabase/client";
import { getClientId } from "./client-id";

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
  controllerId: null,
  controllerClaimedAt: null,
};

let cachedState: LiveState = initialState;
let initialized = false;
let hydrating = false;
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

// Connection health, separate from LiveState itself (which mirrors the DB
// row shape 1:1 via mapRow — this isn't part of that). QA_REPORT_ROUND2.md
// R2-BUG-3: after a simulated backend outage, public displays (which only
// ever passively listen) recovered on their own, but the operator dashboard
// kept showing stale state and needed a manual reload — the Realtime
// subscription has no status callback at all here, so a channel that
// errors out or times out just silently stops delivering updates, forever,
// with nothing re-subscribing and nothing telling the operator their view
// might be stale. `connectionStatus` surfaces that state; the reconnect
// handling below (subscribe-status callback + visibilitychange) is what
// actually fixes the desync, not just reports it.
export type ConnectionStatus = "connected" | "reconnecting" | "disconnected";
let connectionStatus: ConnectionStatus = "connected";
const connectionListeners = new Set<() => void>();

function setConnectionStatus(next: ConnectionStatus) {
  if (connectionStatus === next) return;
  connectionStatus = next;
  for (const listener of connectionListeners) listener();
}

function subscribeConnection(callback: () => void): () => void {
  connectionListeners.add(callback);
  return () => connectionListeners.delete(callback);
}

function getConnectionSnapshot(): ConnectionStatus {
  return connectionStatus;
}

function getConnectionServerSnapshot(): ConnectionStatus {
  return "connected";
}

export function useConnectionStatus(): ConnectionStatus {
  return useSyncExternalStore(subscribeConnection, getConnectionSnapshot, getConnectionServerSnapshot);
}

interface LiveStateRow {
  active_session_id: string | null;
  paused_at: string | null;
  alert: Alert | null;
  progress_by_session: LiveState["progressBySession"];
  notes_overrides: LiveState["notesOverrides"];
  controller_id: string | null;
  controller_claimed_at: string | null;
}

function mapRow(row: LiveStateRow): LiveState {
  return {
    activeSessionId: row.active_session_id ?? "",
    progressBySession: row.progress_by_session ?? {},
    pausedAt: row.paused_at,
    alert: row.alert,
    notesOverrides: row.notes_overrides ?? {},
    controllerId: row.controller_id ?? null,
    controllerClaimedAt: row.controller_claimed_at ?? null,
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

function openLiveStateChannel() {
  let wasEverConnected = false;
  supabaseBrowser()
    .channel("live-state-sync")
    .on("postgres_changes", { event: "*", schema: "public", table: "live_state" }, (payload) => {
      cachedState = mapRow(payload.new as LiveStateRow);
      notify();
    })
    .subscribe((status) => {
      if (status === "SUBSCRIBED") {
        setConnectionStatus("connected");
        // Re-fetch on (re)connect, not just rely on the next change event —
        // this is what actually closes the R2-BUG-3 gap: any updates that
        // happened while this channel was down are otherwise never seen
        // until something else changes live_state again.
        if (wasEverConnected) hydrate();
        wasEverConnected = true;
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        setConnectionStatus("reconnecting");
      } else if (status === "CLOSED") {
        setConnectionStatus("disconnected");
      }
    });
}

function ensureBrowserListeners() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;

  openLiveStateChannel();

  // Defensive fallback independent of Realtime's own state — covers both
  // "the channel silently died and nothing is telling us" and the
  // Persona-B "phone locked for a few minutes" case from
  // QA_REPORT_ROUND2.md. Cheap: one read of a single-row table.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") hydrate();
  });
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
//
// The sequencing actions below (the ones app/api/live/route.ts's
// LOCKED_ACTIONS gates) send clientId so the server can tell "is this the
// tab that holds the control lock" apart from "is this a different
// operator." Alert/Notes/reset stay unlocked and don't need it.
function selectSession(sessionId: string) {
  return sendAction({ action: "selectSession", sessionId, clientId: getClientId() });
}

function start() {
  return sendAction({ action: "start", clientId: getClientId() });
}

function next(maxOrder: number) {
  return sendAction({ action: "next", maxOrder, clientId: getClientId() });
}

function previous(minOrder: number) {
  return sendAction({ action: "previous", minOrder, clientId: getClientId() });
}

function jumpTo(order: number) {
  return sendAction({ action: "jumpTo", order, clientId: getClientId() });
}

function finish(maxOrder: number) {
  return sendAction({ action: "finish", maxOrder, clientId: getClientId() });
}

function togglePause() {
  return sendAction({ action: "togglePause", clientId: getClientId() });
}

// Sequencing control lock — opt-in (see LiveState.controllerId's doc
// comment in lib/types.ts). `force` is only for an explicit "Take Over"
// confirmation the UI shows when someone else already holds it; a plain
// claim from an unclaimed or stale lock never needs it.
function claimControl(force = false) {
  return sendAction({ action: "claimControl", clientId: getClientId(), force });
}

function releaseControl() {
  return sendAction({ action: "releaseControl", clientId: getClientId() });
}

function renewControl() {
  return sendAction({ action: "renewControl", clientId: getClientId() });
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
    claimControl,
    releaseControl,
    renewControl,
  };
}
