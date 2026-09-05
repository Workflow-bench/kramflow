import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface StageNextItem {
  title: string;
  type: "item" | "break";
  scheduledStart?: string | null;
  presenter?: string | null;
  presenterContact?: string | null;
}

// The richer "Next" card — was hand-copied between AV and Green Room, down
// to the identical "Next: Please Prepare" vs "Next" break/item distinction.
// Green Room's two extras (the ready badge, the background wash for an
// actual next speaker) stay opt-in props rather than always-on, so AV's
// output is unchanged.
export function StageNextCard({
  item,
  /** Green Room's one deliberate environmental-color exception — a
   *  background wash for an actual next speaker, never for a break. */
  emphasize = false,
  /** "Speaker Ready" badge — Green Room only. */
  ready = false,
  /** Green Room's more spacious p-8, vs AV's denser px-6 py-5. */
  loosePadding = false,
  /** AV never showed presenter contact info here; Green Room does. */
  showPresenterContact = false,
}: {
  item: StageNextItem;
  emphasize?: boolean;
  ready?: boolean;
  loosePadding?: boolean;
  showPresenterContact?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-card",
        loosePadding ? "p-8" : "px-6 py-5",
        emphasize ? "bg-status-orange/8" : "bg-card/50"
      )}
    >
      <div className="flex items-center justify-between">
        <p className="text-caption uppercase tracking-wide text-muted-2">
          {item.type === "item" ? "Next: Please Prepare" : "Next"}
        </p>
        {item.scheduledStart && <span className="text-caption text-muted-2 tabular-nums">{item.scheduledStart}</span>}
      </div>
      <p className="text-subtitle text-primary mt-3">{item.title}</p>
      {item.presenter && (
        <p className="text-body text-muted mt-2">
          {item.presenter}
          {showPresenterContact && item.presenterContact && (
            <span className="text-muted-2"> · {item.presenterContact}</span>
          )}
        </p>
      )}
      {ready && (
        <div className="mt-6 w-full flex items-center justify-center gap-3 rounded-full px-6 py-4 text-body font-semibold bg-status-green/15 text-status-green">
          <CheckCircle2 className="h-5 w-5" strokeWidth={2} />
          Speaker Ready
        </div>
      )}
    </div>
  );
}
