"use client";

import { useReduced } from "./motion";

/**
 * One effective motion setting for the homepage.
 *
 * The OS `prefers-reduced-motion` setting is the single source of truth, and it stays
 * authoritative while the page is open — `useReduced` subscribes to the media query, so
 * turning it on mid-scene rebuilds the static branch rather than leaving a half-played
 * timeline behind.
 *
 * There was previously a visitor-facing Pause control folded in here as a second input.
 * It has been removed from the page at the user's request, so the OS preference is now
 * the only thing that turns motion off. Everything downstream still reads these two
 * hooks, which keeps one setting reaching every engine — the ambient shader, the GSAP
 * scroll stage, navigation and CSS travel (`data-motion`, see MotionFlag) — rather than
 * each of them sampling the preference separately.
 */

/** Whether decorative, continuous motion may run (the ambient field, the scroll stage). */
export function useAmbientMotion() {
  return !useReduced();
}

/**
 * Whether a user-triggered change (a cue reveal, a selection move) should animate.
 * When motion is off the change still happens — it simply arrives instantly rather than
 * travelling. Content and actions are never removed, only the movement.
 */
export function useTransitionMotion() {
  return !useReduced();
}
