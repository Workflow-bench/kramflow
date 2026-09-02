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
export function RunPosition({ next, onDeck }: { next: Program | null; onDeck: Program | null }) {
  if (!next && !onDeck) return null;

  return (
    <div className="mt-6 flex flex-col gap-3">
      {next && (
        <div className="flex items-baseline gap-3">
          <SectionLabel className="shrink-0 w-20 whitespace-nowrap">Next</SectionLabel>
          <p className="text-console-row text-primary truncate">{next.title}</p>
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
