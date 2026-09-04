import type { Program } from "@/lib/types";
import { SectionLabel } from "@/components/ui/section-label";

// Current/Next/On Deck as one relationship, not one alone — the audit's
// "Live / current / next" finding named this specifically: Console showed
// the live item in detail but nothing about what's coming, while Remote
// and every TV display already carry Next/On Deck. An operator had to
// scan the rundown list to answer "what's after this" instead of reading
// it next to Live Now. This is the shared presentation; getLive/getNext/
// getOnDeck (lib/types.ts) are the shared data — this component owns only
// how they're shown, not a second way to compute them.
export function RunPosition({
  next,
  onDeck,
  currentDriftMinutes = null,
}: {
  next: Program | null;
  onDeck: Program | null;
  /** EXPECTED_START(next) = PLANNED_START(next) + this — see
   *  lib/timing.ts's module doc. Optional: Rehearsal (app/e/[eventId]/
   *  rehearsal/page.tsx) has no drift concept in its own local state and
   *  omits it, same as before this existed. */
  currentDriftMinutes?: number | null;
}) {
  if (!next && !onDeck) return null;

  return (
    <div className="mt-6 flex flex-col gap-3">
      {next && (
        <div className="flex items-baseline gap-3">
          <SectionLabel className="shrink-0 w-20 whitespace-nowrap">Next</SectionLabel>
          <p className="text-console-row text-primary truncate">{next.title}</p>
          {currentDriftMinutes !== null && Math.abs(currentDriftMinutes) >= 1 && (
            <span className="text-console-meta text-muted-2 shrink-0 tabular-nums">
              expected ~{Math.abs(Math.round(currentDriftMinutes))}m {currentDriftMinutes > 0 ? "late" : "early"}
            </span>
          )}
        </div>
      )}
      {onDeck && (
        <div className="flex items-baseline gap-3">
          <SectionLabel className="shrink-0 w-20 whitespace-nowrap text-muted-2/70">On deck</SectionLabel>
          <p className="text-console-sm text-muted truncate">{onDeck.title}</p>
        </div>
      )}
    </div>
  );
}
