import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Shared by anything showing "how stale is this" — display cards
// (app/e/[eventId]/displays/page.tsx) and the Presenter sync-age indicator.
// Takes an elapsed duration in ms, not a Date, so every caller threads
// through its own already-ticking `now` (same reasoning as
// components/dashboard/share-link-panel.tsx's `now` state: Date.now() is
// impure and shouldn't be called from render).
export function formatRelativeAge(elapsedMs: number): string {
  if (elapsedMs < 0) elapsedMs = 0;
  const seconds = Math.floor(elapsedMs / 1000);
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
