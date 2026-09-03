"use client";

import { useMemo, useSyncExternalStore } from "react";
import type { RealtimePostgresChangesPayload, REALTIME_SUBSCRIBE_STATES } from "@supabase/supabase-js";
import type { Alert, LiveState } from "./types";
import { supabaseBrowser, realtimeReady } from "./supabase/client";
import { getClientId } from "./client-id";
import { useEventId } from "./event-context";

// Live-state store — Supabase-backed, one row per event (see
// supabase/schema.sql's `live_state` table and docs/ARCHITECTURE.md's
// "State flow"). Used to be a single module-level singleton (one global
// event, one row, `id = 1`) — now a small per-eventId instance factory,
// memoized in `instances` below, since a browser tab only ever manages one
// event at a time (via /e/[eventId]/...) but the app itself can have many
// operators each running their own. Public shape (`start()`, `next()`, ...)
// is otherwise unchanged, including the Display Engine (`lib/display-engine/*`),
// which reads this same `useEventStore(eventId)`.
//
// Reads: hydrate once from Supabase, then stay current via Realtime,
// filtered server-side to this one event_id. Writes: PATCH
// app/api/live/route.ts, which applies the mutation and appends an
// activity_log row — the Realtime subscription is what brings the result
// back into this store, not the fetch response itself.

const initialState: LiveState = {
  activeSessionId: "",
  progressBySession: {},
  pausedAt: null,
  alert: null,
  notesOverrides: {},
  controllerId: null,
  controllerClaimedAt: null,
  itemActuals: {},
};

export type ConnectionStatus = "connected" | "reconnecting" | "disconnected";

interface LiveStateRow {
  active_session_id: string | null;
  paused_at: string | null;
  alert: Alert | null;
  progress_by_session: LiveState["progressBySession"];
  notes_overrides: LiveState["notesOverrides"];
  controller_id: string | null;
  controller_claimed_at: string | null;
  item_actuals: LiveState["itemActuals"];
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
    itemActuals: row.item_actuals ?? {},
  };
}

interface EventStoreInstance {
  eventId: string;
  cachedState: LiveState;
  connectionStatus: ConnectionStatus;
  initialized: boolean;
  hydrating: boolean;
  listeners: Set<() => void>;
  connectionListeners: Set<() => void>;
}

const instances = new Map<string, EventStoreInstance>();

function getInstance(eventId: string): EventStoreInstance {
  let inst = instances.get(eventId);
  if (!inst) {
    inst = {
      eventId,
      cachedState: initialState,
      connectionStatus: "connected",
      initialized: false,
      hydrating: false,
      listeners: new Set(),
      connectionListeners: new Set(),
    };
    instances.set(eventId, inst);
  }
  return inst;
}

function notify(inst: EventStoreInstance) {
  for (const listener of inst.listeners) listener();
}

function setConnectionStatus(inst: EventStoreInstance, next: ConnectionStatus) {
  if (inst.connectionStatus === next) return;
  inst.connectionStatus = next;
  for (const listener of inst.connectionListeners) listener();
}

async function hydrate(inst: EventStoreInstance) {
  if (inst.hydrating) return;
  inst.hydrating = true;
  try {
    const { data, error } = await supabaseBrowser()
      .from("live_state")
      .select("*")
      .eq("event_id", inst.eventId)
      .single();
    if (error) throw error;
    inst.cachedState = mapRow(data as LiveStateRow);
    notify(inst);
  } catch (err) {
    console.error("[store] hydrate failed:", err);
  } finally {
    inst.hydrating = false;
  }
}

async function openLiveStateChannel(inst: EventStoreInstance) {
  // Must resolve before the first .subscribe() — a channel's initial join
  // fires immediately and does not wait for the realtime accessToken
  // callback, so subscribing before the signed-in session is attached
  // joins (silently) as anon and never self-corrects. See
  // lib/supabase/client.ts's realtimeReady() doc comment.
  await realtimeReady();
  let wasEverConnected = false;
  supabaseBrowser()
    .channel(`live-state-sync:${inst.eventId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "live_state", filter: `event_id=eq.${inst.eventId}` },
      (payload: RealtimePostgresChangesPayload<LiveStateRow>) => {
        inst.cachedState = mapRow(payload.new as LiveStateRow);
        notify(inst);
      }
    )
    .subscribe((status: `${REALTIME_SUBSCRIBE_STATES}`) => {
      if (status === "SUBSCRIBED") {
        setConnectionStatus(inst, "connected");
        // Re-fetch on (re)connect, not just rely on the next change event —
        // closes the gap where updates that happened while the channel was
        // down are otherwise never seen until something else changes
        // live_state again.
        if (wasEverConnected) hydrate(inst);
        wasEverConnected = true;
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        setConnectionStatus(inst, "reconnecting");
      } else if (status === "CLOSED") {
        setConnectionStatus(inst, "disconnected");
      }
    });
}

function ensureBrowserListeners(inst: EventStoreInstance) {
  if (inst.initialized || typeof window === "undefined") return;
  inst.initialized = true;

  openLiveStateChannel(inst);

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") hydrate(inst);
  });
}

// Retries once on 409 — app/api/live/route.ts returns that when its
// optimistic-concurrency check finds live_state changed between its read
// and write. The route always recomputes from a fresh read, so resending
// the same action succeeds once the other write has landed.
//
// Same-tab acknowledgement (2026-09 blocker remediation): the route's
// write was always atomic and correctly version-checked — the gap was
// that its response carried nothing but a boolean, so the initiating tab
// had to wait for its own Realtime echo of the write it had just made
// before its own screen reflected it (a real Doherty-threshold problem:
// press Next, watch nothing happen for a beat). The route now returns the
// full updated row; applied here, synchronously, before this function
// resolves, using the exact same mapRow() the Realtime handler already
// uses for every other client's eventual update. This is deliberately
// NOT naive optimistic UI — nothing is applied until the server has
// already committed the write and confirmed it in its response; a
// rejected/conflicted/failed request (409 exhausted, 423 locked, network
// failure) applies nothing and falls through to the existing `false`
// return, which every caller already treats as a real failure (a toast,
// not a silently-reverted optimistic state). The Realtime echo still
// arrives afterward and re-applies the identical state — a harmless
// no-op, not a second source of truth.
async function sendAction(eventId: string, body: Record<string, unknown>, attempt = 0): Promise<boolean> {
  try {
    const res = await fetch("/api/live", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, eventId }),
    });
    if (res.status === 409 && attempt < 2) return sendAction(eventId, body, attempt + 1);
    if (!res.ok) {
      console.error("[store] action failed:", body.action, res.status);
      return false;
    }
    const data = (await res.json()) as { ok: boolean; noop?: boolean; state?: LiveStateRow };
    if (data.state) {
      const inst = getInstance(eventId);
      inst.cachedState = mapRow(data.state);
      notify(inst);
    }
    return true;
  } catch (err) {
    console.error("[store] action failed:", body.action, err);
    return false;
  }
}

export function useEventStore() {
  const eventId = useEventId();
  const inst = getInstance(eventId);

  // Memoized so the function identity passed to useSyncExternalStore stays
  // stable across renders for this same `inst` — an inline arrow function
  // here is a *new* reference every render, which forces an unnecessary
  // unsubscribe+resubscribe on every render (see lib/display-engine/
  // store.tsx's useDisplayEngine() for the concrete infinite-loop this
  // pattern caused there once subscribe also notified synchronously).
  const subscribeFn = useMemo(
    () => (callback: () => void) => {
      ensureBrowserListeners(inst);
      inst.listeners.add(callback);
      if (!inst.hydrating && inst.cachedState === initialState) {
        hydrate(inst).then(callback);
      }
      return () => inst.listeners.delete(callback);
    },
    [inst]
  );
  const getSnapshotFn = useMemo(() => () => inst.cachedState, [inst]);

  const state = useSyncExternalStore(subscribeFn, getSnapshotFn, () => initialState);

  return {
    state,
    selectSession: (sessionId: string) => sendAction(eventId, { action: "selectSession", sessionId, clientId: getClientId() }),
    start: () => sendAction(eventId, { action: "start", clientId: getClientId() }),
    next: (maxOrder: number) => sendAction(eventId, { action: "next", maxOrder, clientId: getClientId() }),
    previous: (minOrder: number) => sendAction(eventId, { action: "previous", minOrder, clientId: getClientId() }),
    jumpTo: (order: number, maxOrder: number) =>
      sendAction(eventId, { action: "jumpTo", order, maxOrder, clientId: getClientId() }),
    finish: (maxOrder: number) => sendAction(eventId, { action: "finish", maxOrder, clientId: getClientId() }),
    togglePause: () => sendAction(eventId, { action: "togglePause", clientId: getClientId() }),
    setAlert: (alert: Alert) => sendAction(eventId, { action: "setAlert", alert }),
    dismissAlert: () => sendAction(eventId, { action: "dismissAlert" }),
    setNotes: (programId: string, notes: string) => sendAction(eventId, { action: "setNotes", programId, notes }),
    reset: () => sendAction(eventId, { action: "reset" }),
    // Sequencing control lock — opt-in. `force` is only for an explicit
    // "Take Over" confirmation the UI shows when someone else already
    // holds it.
    claimControl: (force = false) => sendAction(eventId, { action: "claimControl", clientId: getClientId(), force }),
    releaseControl: () => sendAction(eventId, { action: "releaseControl", clientId: getClientId() }),
    renewControl: () => sendAction(eventId, { action: "renewControl", clientId: getClientId() }),
  };
}

export function useConnectionStatus(): ConnectionStatus {
  const eventId = useEventId();
  const inst = getInstance(eventId);
  const subscribeFn = useMemo(
    () => (callback: () => void) => {
      inst.connectionListeners.add(callback);
      return () => inst.connectionListeners.delete(callback);
    },
    [inst]
  );
  const getSnapshotFn = useMemo(() => () => inst.connectionStatus, [inst]);
  return useSyncExternalStore(
    subscribeFn,
    getSnapshotFn,
    () => "connected" as ConnectionStatus
  );
}
