"use client";

import { useSyncExternalStore } from "react";
import { useDisplayEngine } from "./store";
import type { TimerColorState, TimerThresholds } from "./types";

// Shared tick source for useDisplayTimer and useDisplayClock, which used
// to each run their own independent 1s setInterval — always-on display
// pages call both in the same component (e.g. app/av/av-display-client.tsx),
// so that was two uncoordinated timers (and two state updates/re-renders
// per second) where one suffices. Same useSyncExternalStore singleton
// pattern already used by lib/store.tsx and lib/display-engine/store.tsx —
// one interval shared across however many components are currently
// subscribed, torn down when the last one unmounts.
let tickNow: number | null = null;
let tickInterval: ReturnType<typeof setInterval> | null = null;
const tickListeners = new Set<() => void>();

function subscribeTick(callback: () => void) {
  if (tickInterval === null) {
    tickNow = Date.now();
    tickInterval = setInterval(() => {
      tickNow = Date.now();
      for (const l of tickListeners) l();
    }, 1000);
  }
  tickListeners.add(callback);
  return () => {
    tickListeners.delete(callback);
    if (tickListeners.size === 0 && tickInterval !== null) {
      clearInterval(tickInterval);
      tickInterval = null;
      tickNow = null;
    }
  };
}

function getTickSnapshot() {
  return tickNow;
}

function getTickServerSnapshot() {
  return null;
}

function useClockTick(): number | null {
  return useSyncExternalStore(subscribeTick, getTickSnapshot, getTickServerSnapshot);
}

export interface AutoProgramInput {
  durationMinutes: number;
  startedAt: string | null;
  /** The main app's own Hold pause timestamp (LiveState.pausedAt) — auto mode freezes alongside it. */
  pausedAt: string | null;
}

export interface DisplayTimerResult {
  remainingSeconds: number; // negative once in overtime
  elapsedSeconds: number;
  totalSeconds: number;
  fraction: number; // elapsed / total, clamped [0,1] — for a progress ring/bar
  isOverrun: boolean;
  colorState: TimerColorState;
  label: string; // "mm:ss" or "h:mm:ss" once past an hour
  isPaused: boolean;
  isStarted: boolean;
}

export function formatClock(totalSeconds: number): string {
  const abs = Math.abs(totalSeconds);
  const h = Math.floor(abs / 3600);
  const m = Math.floor((abs % 3600) / 60);
  const s = abs % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

function colorFor(remainingSeconds: number, thresholds: TimerThresholds): TimerColorState {
  if (remainingSeconds < -thresholds.criticalAfter) return "critical";
  if (remainingSeconds <= thresholds.redAt) return "red";
  if (remainingSeconds <= thresholds.orangeAt) return "orange";
  if (remainingSeconds <= thresholds.yellowAt) return "yellow";
  return "green";
}

/**
 * Drives every timer-bearing display. In "auto" mode it follows whatever
 * program is live in the shared session state (same duration/startedAt the
 * rest of the app already uses — no duplicate schedule data). In "manual"
 * mode it runs the Display Engine's own independent TimerState, set from
 * the Presenter Display's controls.
 */
export function useDisplayTimer(autoProgram: AutoProgramInput | null): DisplayTimerResult {
  const { state } = useDisplayEngine();
  const { timer } = state;
  const now = useClockTick();

  const useAuto = timer.source === "auto" && autoProgram !== null;
  const totalSeconds = useAuto
    ? Math.round(autoProgram!.durationMinutes * 60)
    : Math.max(0, timer.durationSeconds + timer.adjustmentSeconds);
  const startedAt = useAuto ? autoProgram!.startedAt : timer.startedAt;
  const pausedAt = useAuto ? autoProgram!.pausedAt : timer.pausedAt;

  if (!startedAt || now === null) {
    return {
      remainingSeconds: totalSeconds,
      elapsedSeconds: 0,
      totalSeconds,
      fraction: 0,
      isOverrun: false,
      colorState: colorFor(totalSeconds, timer.thresholds),
      label: formatClock(totalSeconds),
      isPaused: Boolean(pausedAt),
      isStarted: Boolean(startedAt),
    };
  }

  const clockNow = pausedAt ? Date.parse(pausedAt) : now;
  const elapsedSeconds = Math.max(0, Math.floor((clockNow - Date.parse(startedAt)) / 1000));
  const remainingSeconds = totalSeconds - elapsedSeconds;

  return {
    remainingSeconds,
    elapsedSeconds,
    totalSeconds,
    fraction: totalSeconds > 0 ? Math.min(1, elapsedSeconds / totalSeconds) : 0,
    isOverrun: remainingSeconds < 0,
    colorState: colorFor(remainingSeconds, timer.thresholds),
    label: formatClock(remainingSeconds),
    isPaused: Boolean(pausedAt),
    isStarted: true,
  };
}

/** For Count-up and Session Timer modes, which read elapsed time as the headline number instead of remaining. */
export function useDisplayClock(offsetMs: number): string {
  const now = useClockTick();
  if (now === null) return "--:--:--";
  const d = new Date(now + offsetMs);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
