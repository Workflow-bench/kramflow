"use client";

import { useSyncExternalStore } from "react";
import type { Session } from "./types";
import { fetchSessions } from "./data/sessions";
import { supabaseBrowser } from "./supabase/client";

// Client-side sessions/programs store — mirrors lib/store.tsx's
// useSyncExternalStore + hydrate-in-subscribe pattern (see that file's
// comment for why hydration happens inside subscribe() rather than
// getSnapshot()). Fetches once, then subscribes to Supabase Realtime on
// `sessions`/`programs` so an Excel upload or form edit (Phase 2) shows up
// on every open display without a refresh.

let cachedSessions: Session[] = [];
let initialized = false;
let hydrating = false;
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

async function hydrate() {
  if (hydrating) return;
  hydrating = true;
  try {
    cachedSessions = await fetchSessions(supabaseBrowser());
    notify();
  } catch (err) {
    console.error("[use-sessions] fetch failed:", err);
  } finally {
    hydrating = false;
  }
}

function ensureBrowserListeners() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;

  const client = supabaseBrowser();
  client
    .channel("sessions-programs-sync")
    .on("postgres_changes", { event: "*", schema: "public", table: "sessions" }, () => hydrate())
    .on("postgres_changes", { event: "*", schema: "public", table: "programs" }, () => hydrate())
    // fetchSessions() joins partitions/auditoriums into the same Session[]
    // shape it returns — without these, a stand-alone edit to either (not
    // accompanied by a sessions/programs change, e.g. renaming a partition
    // or an auditorium) wouldn't trigger a refetch at all.
    .on("postgres_changes", { event: "*", schema: "public", table: "partitions" }, () => hydrate())
    .on("postgres_changes", { event: "*", schema: "public", table: "auditoriums" }, () => hydrate())
    .subscribe();
}

function subscribe(callback: () => void): () => void {
  ensureBrowserListeners();
  listeners.add(callback);

  if (!hydrating && cachedSessions.length === 0) {
    hydrate().then(callback);
  }

  return () => listeners.delete(callback);
}

function getSnapshot(): Session[] {
  return cachedSessions;
}

const EMPTY_SESSIONS: Session[] = [];

function getServerSnapshot(): Session[] {
  return EMPTY_SESSIONS;
}

export function useSessions(): Session[] {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
