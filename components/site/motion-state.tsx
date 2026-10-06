"use client";

import { useSyncExternalStore } from "react";
import { useReduced } from "./motion";

/**
 * One switch for the homepage's continuous motion.
 *
 * Two inputs decide whether ambient motion runs: the OS `prefers-reduced-motion`
 * setting (authoritative, and re-read when the user changes it mid-session — see
 * `useReduced`) and this visitor-facing Pause control. Either one turns the
 * ambient light off and leaves a static composition behind it.
 *
 * **Scope of Pause (HOME-R08).** Pause covers *all* decorative motion on this page,
 * not just the background: the ambient light stops, and user-triggered changes stop
 * travelling too — the cue reveal and the selection indicator apply instantly instead
 * of animating. What Pause never does is remove function. Every control still works,
 * every state still changes, and all content stays readable; only the movement goes.
 * This is the behaviour the control's label promises, rather than a background-only
 * switch described as a motion switch.
 */

let paused = false;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export function setMotionPaused(next: boolean) {
  if (paused === next) return;
  paused = next;
  emit();
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

/** The Pause control's own state. Server snapshot is `false`, so SSR and hydration agree. */
export function useMotionPaused() {
  return useSyncExternalStore(
    subscribe,
    () => paused,
    () => false
  );
}

/**
 * Whether decorative, continuous motion may run right now.
 * Reduced motion wins over the control; the control can only ever turn motion off.
 */
export function useAmbientMotion() {
  const reduce = useReduced();
  const isPaused = useMotionPaused();
  return !reduce && !isPaused;
}

/**
 * Whether a user-triggered transition (cue reveal, selection move) should animate.
 * Under reduced motion the change is applied instantly rather than suppressed —
 * the content still changes, it just arrives without the travel.
 */
export function useTransitionMotion() {
  const reduce = useReduced();
  const isPaused = useMotionPaused();
  // Same inputs as the ambient field: either one turns travel off, and the state
  // change itself still happens immediately.
  return !reduce && !isPaused;
}
