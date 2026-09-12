"use client";

import { useClock } from "@/lib/use-clock";

// Kramflow UI Shell v1 (Phase 4): the Dashboard's single header band —
// previously a separate 1.5-line "instrument strip" (email + clock) sitting
// above an independently-rendered PageHeader (eyebrow, title, event count,
// actions) with its own py-10 of empty space before it. Two stacked bands
// plus a large gap before any real content, on the one screen every
// operator lands on first — exactly the "oversized empty canvas" pattern
// the shell audit flagged. This merges both into one band: identity/title
// on the left, email/clock/actions on the right, matching the same
// left-cluster/right-cluster grammar EventShellHeader now uses so Dashboard
// and every event-scoped screen read as the same application immediately.
export function DashboardInstrumentStrip({
  email,
  eventCount,
  actions,
}: {
  email: string;
  eventCount: number;
  actions?: React.ReactNode;
}) {
  const clock = useClock();
  return (
    <div className="shrink-0 glass-chrome border-b border-line-soft px-4 sm:px-6 xl:px-12 py-3">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <p className="text-console-label text-muted-2 uppercase tracking-wide">Operator Dashboard</p>
          <div className="flex items-center flex-wrap gap-2.5 mt-1">
            <h1 className="text-console-md text-primary">Your Events</h1>
            <span className="text-console-sm text-muted">
              {eventCount} event{eventCount === 1 ? "" : "s"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="hidden sm:flex items-center gap-2 text-console-meta text-muted-2">
            <span className="truncate max-w-[12rem]">{email}</span>
            <span className="tnum" aria-hidden="true">
              {clock}
            </span>
          </div>
          {actions}
        </div>
      </div>
    </div>
  );
}
