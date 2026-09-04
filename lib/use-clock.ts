"use client";

import { useSyncExternalStore } from "react";

// A plain browser-clock readout for authenticated Console surfaces — no
// server-offset correction (that's lib/display-engine/use-time-sync.ts's
// job for anonymous Stage viewers, where clock skew actually matters for
// countdown accuracy). This is ambient "is real time still moving" context
// in the shell strip, not driving any authoritative timer, so reusing the
// Stage-scoped tick singleton (lib/display-engine/use-display-timer.ts)
// here would pull Stage-only machinery into a Console component for a
// single header readout — a self-contained interval is cheap enough not
// to need sharing.
//
// useSyncExternalStore, not useState+useEffect: a client component still
// renders once on the server during SSR, so seeding state with `new
// Date()` produces a real hydration mismatch (the server's timestamp and
// the client's first-render timestamp are never the same second). The
// null server snapshot means the clock renders nothing until mount, then
// ticks — same pattern already established for every Stage display clock.
let tickNow: number | null = null;
let tickInterval: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<() => void>();

function subscribe(callback: () => void) {
  if (tickInterval === null) {
    tickNow = Date.now();
    tickInterval = setInterval(() => {
      tickNow = Date.now();
      for (const l of listeners) l();
    }, 1000);
  }
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
    if (listeners.size === 0 && tickInterval !== null) {
      clearInterval(tickInterval);
      tickInterval = null;
      tickNow = null;
    }
  };
}

function getSnapshot() {
  return tickNow;
}

function getServerSnapshot() {
  return null;
}

export function useClock(): string {
  const now = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  if (now === null) return "";
  return new Date(now).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
