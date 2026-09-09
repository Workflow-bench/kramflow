import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// Plain twMerge doesn't know about this app's custom @theme typography
// scale (app/globals.css) — text-hero, text-title, text-console-lg, and
// the rest don't match its built-in font-size scale (text-xs..text-9xl),
// so it falls back to treating any unrecognized "text-{word}" as a
// text-color utility instead. That's not just a missed optimization: two
// classes tailwind-merge believes conflict get reduced to whichever one
// is listed last, so `cn("text-hero tabular-nums", "text-primary")` —
// exactly the pattern used throughout the display/remote surfaces to pair
// a size token with a semantic color — silently dropped text-hero and
// rendered at the browser default size instead of 92px. Confirmed via
// direct testing (twMerge("text-hero tabular-nums text-primary") ->
// "tabular-nums text-primary") before this existed. Registering every
// custom size token under the existing 'font-size' group (not a new one)
// tells twMerge they're a different kind of thing than text-color, so
// they stop competing for the same "last one wins" slot.
const cn_ = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        "text-console-headline",
        "text-console-lg",
        "text-console-md",
        "text-console-sm",
        "text-console-row",
        "text-console-meta",
        "text-console-label",
        "text-hero",
        "text-title",
        "text-subtitle",
        "text-body",
        "text-caption",
      ],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return cn_(clsx(inputs));
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
