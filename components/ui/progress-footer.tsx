// Session progress bar — day/session label + item count + a fill bar.
// Moved from components/tv/ (Stage-scale, text-caption) to components/ui/
// (Console-scale, text-console-meta): despite living under tv/, this was
// never actually used by a Stage display — only the Operator Console
// footer. Console/Stage boundary closure, not a new component.
export function ProgressFooter({
  dayLabel,
  sessionLabel,
  currentIndex,
  total,
}: {
  dayLabel: string;
  sessionLabel: string;
  currentIndex: number;
  total: number;
}) {
  const fraction = total > 0 ? Math.min(1, currentIndex / total) : 0;

  return (
    <div>
      <div className="flex items-center justify-between text-console-meta text-muted-2 tabular-nums mb-3">
        <span>
          {dayLabel} • {sessionLabel}
        </span>
        <span>
          {currentIndex} / {total}
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-card overflow-hidden">
        <div
          className="h-full rounded-full bg-muted-2"
          style={{ width: `${fraction * 100}%` }}
        />
      </div>
    </div>
  );
}
