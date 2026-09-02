"use client";

import { useEffect, useState } from "react";
import { useDisplayEngine } from "./store";
import type { TimerColorState, TimerThresholds } from "./types";

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
 *
 * `offsetMs` — from useTimeSync(), same as useDisplayClock's own param
 * below — corrects for this device's own clock being wrong relative to the
 * server. Without it, a kiosk with system-clock drift computes elapsed
 * time from its own skewed `now` against the server-issued `startedAt`,
 * visibly diverging from every correctly-clocked display in the room.
 */
export function useDisplayTimer(autoProgram: AutoProgramInput | null, offsetMs = 0): DisplayTimerResult {
  const { state } = useDisplayEngine();
  const { timer } = state;
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now() + offsetMs), 1000);
    return () => clearInterval(id);
  }, [offsetMs]);

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
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  if (now === null) return "--:--:--";
  const d = new Date(now + offsetMs);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
