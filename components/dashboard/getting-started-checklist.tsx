"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { Check, X } from "lucide-react";
import { Panel } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabaseBrowser } from "@/lib/supabase/client";
import { fetchSessions } from "@/lib/data/sessions";
import { cn } from "@/lib/utils";
import type { EventSummary } from "./events-dashboard";

const DISMISS_KEY = "kramflow_onboarding_dismissed";
const listeners = new Set<() => void>();
let reopenCount = 0; // bumped by reopenGettingStarted() — a change here means "show even if allDone"

// Mirrors lib/display-engine/store.tsx's own localStorage + subscriber
// pattern (useSyncExternalStore rather than an effect syncing a browser
// read into useState) — same shape, smaller scope: "is this dismissed,"
// plus a reopen counter for the help menu's "Getting started" entry.
function isDismissed(): boolean {
  if (typeof window === "undefined") return true; // hidden on the server, so it never flashes in before hydration
  return window.localStorage.getItem(DISMISS_KEY) === "true";
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function notify() {
  for (const listener of listeners) listener();
}

// Called by the help menu — clears the dismiss flag and marks this as an
// explicit reopen, so the checklist shows itself even if every step is
// already done (revisiting it on purpose is a request to see it, not a
// signal it's still needed).
export function reopenGettingStarted() {
  window.localStorage.removeItem(DISMISS_KEY);
  reopenCount += 1;
  notify();
  document.getElementById("getting-started")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function dismissGettingStarted() {
  window.localStorage.setItem(DISMISS_KEY, "true");
  notify();
}

// The 3 real actions that get a brand-new operator to a working event —
// not a tour of the empty app, a checklist against what they've actually
// done. Progress is derived live from real data (an event exists? has a
// session? has an item?) rather than a separate onboarding-state column,
// so it can never drift out of sync with what's actually true, and it
// self-heals if someone deletes their way back to zero.
export function GettingStartedChecklist({ events }: { events: EventSummary[] }) {
  const dismissed = useSyncExternalStore(subscribe, isDismissed, () => true);
  const reopened = useSyncExternalStore(
    subscribe,
    () => reopenCount,
    () => 0
  );
  const [counts, setCounts] = useState<{ eventId: string; sessions: number; items: number } | null>(null);

  const firstEvent = events[events.length - 1]; // oldest — the one they made first
  const hasEvent = events.length > 0;

  useEffect(() => {
    if (!firstEvent) return;
    let cancelled = false;
    fetchSessions(supabaseBrowser(), firstEvent.id).then((sessions) => {
      if (cancelled) return;
      setCounts({
        eventId: firstEvent.id,
        sessions: sessions.length,
        items: sessions.reduce((sum, s) => sum + s.items.length, 0),
      });
    });
    return () => {
      cancelled = true;
    };
    // Deliberately firstEvent?.id, not firstEvent — events gets replaced
    // wholesale on every create/delete, so depending on the object itself
    // would refetch on every dashboard mutation, not just when the oldest
    // event actually changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstEvent?.id]);

  const hasSession = counts?.eventId === firstEvent?.id && (counts?.sessions ?? 0) > 0;
  const hasItem = counts?.eventId === firstEvent?.id && (counts?.items ?? 0) > 0;
  const allDone = hasEvent && hasSession && hasItem;

  if (dismissed || (allDone && reopened === 0)) return null;

  const cueSheetHref = firstEvent ? `/e/${firstEvent.id}/operator/cue-sheet` : undefined;

  return (
    <Panel id="getting-started" className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-console-md text-primary">Getting started</h2>
          <p className="text-console-meta text-muted-2 mt-0.5">
            Three real steps to your first working event. No tour, just the actual thing.
          </p>
        </div>
        <Button variant="ghost" size="sm" square onClick={dismissGettingStarted} aria-label="Dismiss getting started">
          <X className="h-4 w-4" strokeWidth={2} />
        </Button>
      </div>

      <ol className="mt-4 flex flex-col gap-1">
        <ChecklistRow n={1} label="Create your first event" done={hasEvent} hint="Use the field above" />
        <ChecklistRow
          n={2}
          label="Add a section"
          done={hasSession}
          href={hasEvent && !hasSession ? cueSheetHref : undefined}
          hint={!hasEvent ? "Create an event first" : undefined}
        />
        <ChecklistRow
          n={3}
          label="Add your first queue item"
          done={hasItem}
          href={hasEvent && hasSession && !hasItem ? cueSheetHref : undefined}
          hint={!hasEvent || !hasSession ? "Add a section first" : undefined}
        />
      </ol>
    </Panel>
  );
}

function ChecklistRow({
  n,
  label,
  done,
  href,
  hint,
}: {
  n: number;
  label: string;
  done: boolean;
  href?: string;
  hint?: string;
}) {
  const content = (
    <>
      <span
        className={cn(
          "grid h-6 w-6 place-items-center rounded-full text-console-label font-semibold shrink-0",
          done ? "bg-status-green/15 text-status-green" : "bg-raised text-muted-2 border border-line"
        )}
      >
        {done ? <Check className="h-3.5 w-3.5" strokeWidth={2.5} /> : n}
      </span>
      <span className={cn("text-console-sm", done ? "text-muted-2 line-through" : "text-primary")}>{label}</span>
      {hint && !done && <span className="text-console-meta text-muted-2 ml-auto">{hint}</span>}
    </>
  );

  const rowClass = "flex items-center gap-3 px-2 py-2 rounded-control";

  if (href) {
    return (
      <li>
        <Link
          href={href}
          className={cn(
            rowClass,
            "hover:bg-card-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          )}
        >
          {content}
        </Link>
      </li>
    );
  }

  return (
    <li className={rowClass} aria-current={!done ? "step" : undefined}>
      {content}
    </li>
  );
}
