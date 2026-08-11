"use client";

import { useEffect, useRef } from "react";
import { useDisplayEngine } from "./store";
import { useTimeSync } from "./use-time-sync";
import type { DisplayCommand, DisplayInstance, DisplayType } from "./types";

const HEARTBEAT_INTERVAL_MS = 15000;
export const OFFLINE_AFTER_MS = 45000;

export function getDisplayStatus(display: DisplayInstance, nowMs: number): "online" | "offline" {
  return nowMs - Date.parse(display.lastSeenAt) > OFFLINE_AFTER_MS ? "offline" : "online";
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
  useEffect(() => {
    onCommandRef.current = onCommand;
    latencyRef.current = latencyMs;
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
    registerDisplay({ id: clientId, name, type, room });
    resync();
    const interval = setInterval(() => {
      heartbeatDisplay(clientId, latencyRef.current);
    }, HEARTBEAT_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [clientId, name, type, room, registerDisplay, heartbeatDisplay, resync]);

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
