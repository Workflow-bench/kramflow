"use client";

import { useClock } from "@/lib/use-clock";

// The Dashboard's own thin instrument strip — same visual language as
// EventShellHeader's top band (bg-white/[0.03] border-b border-line-soft,
// small tabular-numeral text), full-bleed above the page's own padded
// container, so a signed-in operator sees the same "which instrument am I
// in" cue the moment they land, before opening a specific event. Not a
// literal reuse of EventShellHeader — that component is event-scoped
// (EventIdentity needs one real event); this is the Dashboard's own
// equivalent of the same idea: identity here, event count moves down into
// PageHeader's meta line where it already belongs.
export function DashboardInstrumentStrip({ email }: { email: string }) {
  const clock = useClock();
  return (
    <div className="flex items-center justify-between gap-4 px-4 sm:px-6 xl:px-12 py-2 bg-white/[0.03] border-b border-line-soft text-console-meta text-muted-2">
      <span className="truncate">{email}</span>
      <span className="hidden sm:inline tnum shrink-0" aria-hidden="true">
        {clock}
      </span>
    </div>
  );
}
