"use client";

import { useMemo, useSyncExternalStore } from "react";
import type { Session } from "./types";
import { fetchSessions } from "./data/sessions";
import { supabaseBrowser } from "./supabase/client";
import { useEventId } from "./event-context";

// Client-side sessions/programs store — one instance per eventId (see
// lib/store.tsx's comment on why this changed from a single module-level
// singleton). Fetches once per event, then subscribes to Supabase Realtime
// on sessions/programs/partitions/auditoriums *filtered to that event_id*
// so an Excel upload or form edit shows up on every open display for that
// event without a refresh — and, just as importantly, never fires for a
// different operator's event sharing the same browser's Realtime socket.

interface SessionsInstance {
  eventId: string;
  cachedSessions: Session[];
  initialized: boolean;
  hydrating: boolean;
  // Distinct from `hydrating`: that flips true/false on every realtime-
  // triggered refetch too, which would flicker a loading skeleton back in
  // on every background update. This instead answers "has the *first* fetch
  // for this event ever completed" — the thing operator/page.tsx and any
  // other consumer actually needs to tell "still loading" apart from
  // "loaded, and there really are zero sessions" (previously indistinguishable
  // — see the 2026-09-01 UI/UX audit's P1 finding #2, "false 'No sessions
  // yet' state while loading").
  hasLoadedOnce: boolean;
  listeners: Set<() => void>;
}

const instances = new Map<string, SessionsInstance>();
const EMPTY_SESSIONS: Session[] = [];

function getInstance(eventId: string): SessionsInstance {
  let inst = instances.get(eventId);
  if (!inst) {
    inst = {
      eventId,
      cachedSessions: EMPTY_SESSIONS,
      initialized: false,
      hydrating: false,
      hasLoadedOnce: false,
      listeners: new Set(),
    };
    instances.set(eventId, inst);
  }
  return inst;
}

function notify(inst: SessionsInstance) {
  for (const listener of inst.listeners) listener();
}

async function hydrate(inst: SessionsInstance) {
  if (inst.hydrating) return;
  inst.hydrating = true;
  try {
    inst.cachedSessions = await fetchSessions(supabaseBrowser(), inst.eventId);
  } catch (err) {
    console.error("[use-sessions] fetch failed:", err);
  } finally {
    inst.hydrating = false;
    inst.hasLoadedOnce = true;
    notify(inst);
  }
}

function ensureBrowserListeners(inst: SessionsInstance) {
  if (inst.initialized || typeof window === "undefined") return;
  inst.initialized = true;

  const client = supabaseBrowser();
  const filter = `event_id=eq.${inst.eventId}`;
  client
    .channel(`sessions-programs-sync:${inst.eventId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "sessions", filter }, () => hydrate(inst))
    .on("postgres_changes", { event: "*", schema: "public", table: "programs", filter }, () => hydrate(inst))
    // fetchSessions() joins partitions/auditoriums into the same Session[]
    // shape it returns — without these, a stand-alone edit to either (not
    // accompanied by a sessions/programs change, e.g. renaming a partition
    // or an auditorium) wouldn't trigger a refetch at all.
    .on("postgres_changes", { event: "*", schema: "public", table: "partitions", filter }, () => hydrate(inst))
    .on("postgres_changes", { event: "*", schema: "public", table: "auditoriums", filter }, () => hydrate(inst))
    .subscribe();
}

export function useSessions(): Session[] {
  const eventId = useEventId();
  const inst = getInstance(eventId);
  const subscribeFn = useMemo(
    () => (callback: () => void) => {
      ensureBrowserListeners(inst);
      inst.listeners.add(callback);
      if (!inst.hydrating && inst.cachedSessions.length === 0) {
        hydrate(inst).then(callback);
      }
      return () => inst.listeners.delete(callback);
    },
    [inst]
  );
  const getSnapshotFn = useMemo(() => () => inst.cachedSessions, [inst]);
  return useSyncExternalStore(
    subscribeFn,
    getSnapshotFn,
    () => EMPTY_SESSIONS
  );
}

// Sibling hook rather than a `{ sessions, loading }` return shape on
// useSessions() itself — every existing call site destructures it as a bare
// array, and changing that shape would be a much larger, riskier edit than
// the one bug this hook exists to fix. Subscribes to the same instance, so
// it shares one Realtime channel/fetch with useSessions() rather than
// duplicating either.
export function useSessionsLoading(): boolean {
  const eventId = useEventId();
  const inst = getInstance(eventId);
  const subscribeFn = useMemo(
    () => (callback: () => void) => {
      ensureBrowserListeners(inst);
      inst.listeners.add(callback);
      return () => inst.listeners.delete(callback);
    },
    [inst]
  );
  const getSnapshotFn = useMemo(() => () => !inst.hasLoadedOnce, [inst]);
  return useSyncExternalStore(subscribeFn, getSnapshotFn, () => true);
}
