"use client";

import { useEffect, useRef } from "react";
import { useDisplayEngine } from "./store";
import { useTimeSync } from "./use-time-sync";
import type { DisplayCommand, DisplayInstance, DisplayType } from "./types";

const HEARTBEAT_INTERVAL_MS = 15000;
// One missed heartbeat (plus a little slack) reads as "stale" rather than
// jumping straight from healthy to offline — the same "degrading before
// declared dead" shape as ConnectionBadge's own STALE_AFTER_MS, just tuned
// to this system's slower 15s cadence instead of Realtime's. Three missed
// heartbeats (unchanged from the original single threshold) still means
// offline — this doesn't move that line, just adds a warning before it.
const STALE_AFTER_MS = 20000;
export const OFFLINE_AFTER_MS = 45000;

export type DisplayHealth = "online" | "stale" | "offline";

export function getDisplayStatus(display: DisplayInstance, nowMs: number): DisplayHealth {
  const age = nowMs - Date.parse(display.lastSeenAt);
  if (age > OFFLINE_AFTER_MS) return "offline";
  if (age > STALE_AFTER_MS) return "stale";
  return "online";
}

/**
 * Call once from any display page. Registers this browser tab in the
 * Display Registry, sends a heartbeat (with a latency sample) on an
 * interval, and hands back any pending command the Display Manager has
 * issued (test message, force fullscreen, reload) so the page can act on
 * it and clear it.
 */
export function useRegisterDisplay(
  name: string,
  type: DisplayType,
  room: string | null,
  onCommand?: (command: DisplayCommand) => void
) {
  const { state, clientId, registerDisplay, heartbeatDisplay, clearCommand } = useDisplayEngine();
  const { latencyMs, resync } = useTimeSync();

  const onCommandRef = useRef(onCommand);
  const latencyRef = useRef(latencyMs);
  // useDisplayEngine() returns a fresh object — including fresh
  // registerDisplay/heartbeatDisplay/resync closures — on every render, not
  // just when identity actually changes. The registration effect below used
  // to depend on those closures directly, which on a page that re-renders
  // for any reason (a ticking clock, another display's heartbeat updating
  // shared state, ...) re-ran registerDisplay() continuously: confirmed
  // live at ~4 calls/second, permanently re-asserting this display's
  // original name and silently reverting any rename made from Display
  // Manager while the display stayed open. Routing the mutators through
  // refs (the same pattern already used for onCommand/latencyMs just below)
  // lets the effect call whatever the latest closure is without needing it
  // in the dependency array.
  const registerDisplayRef = useRef(registerDisplay);
  const heartbeatDisplayRef = useRef(heartbeatDisplay);
  const resyncRef = useRef(resync);
  useEffect(() => {
    onCommandRef.current = onCommand;
    latencyRef.current = latencyMs;
    registerDisplayRef.current = registerDisplay;
    heartbeatDisplayRef.current = heartbeatDisplay;
    resyncRef.current = resync;
  });

  // clearCommand() is a round trip (writes, then Realtime echoes the change
  // back into state.registry) — until it lands, state.registry still shows
  // the same pendingCommand. state.registry itself changes constantly (a
  // heartbeat from *any* connected display re-triggers this effect's
  // dependency), so without tracking what's already been handled, the same
  // command re-fires the handler repeatedly during that window. Harmless
  // for a one-shot "reload" (the page navigates away immediately), but for
  // a command a handler turns into persistent UI state — force-fullscreen's
  // prompt, or in principle any future one — it means a user action that
  // clears that state (dismissing the prompt) gets immediately undone by
  // the next stale re-fire, making it look unresponsive. issuedAt uniquely
  // identifies a command, so it's used to skip ones already handled.
  const handledIssuedAtRef = useRef<string | null>(null);

  useEffect(() => {
    registerDisplayRef.current({ id: clientId, name, type, room });
    resyncRef.current();
    const interval = setInterval(() => {
      heartbeatDisplayRef.current(clientId, latencyRef.current);
    }, HEARTBEAT_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [clientId, name, type, room]);

  useEffect(() => {
    const command = state.registry[clientId]?.pendingCommand;
    if (!command || !onCommandRef.current) return;
    if (handledIssuedAtRef.current === command.issuedAt) return;
    handledIssuedAtRef.current = command.issuedAt;
    onCommandRef.current(command);
    clearCommand(clientId);
  }, [state.registry, clientId, clearCommand]);

  return state.registry[clientId] ?? null;
}
