import type { Session } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * The full run-of-show for the active session — a real gap even the 4
 * fixed display types don't cover (per docs/CUSTOM-DISPLAY-REQUIREMENTS.md
 * section 2.1), useful for a lobby monitor or a stage manager's own
 * screen. Public-safe: title, presenter, and scheduled time only — no
 * operator-only fields (status, remarks, production requirements).
 */
export function ScheduleListWidget({ session, currentOrder }: { session: Session | undefined; currentOrder: number | null }) {
  if (!session || session.items.length === 0) {
    return <p className="text-body text-muted-2">No schedule to show.</p>;
  }
  return (
    <div className="flex flex-col h-full min-h-0 overflow-y-auto">
      <p className="text-caption uppercase tracking-wide text-muted-2 shrink-0">Schedule</p>
      <ul className="m-0 flex list-none flex-col gap-0 p-0 mt-3">
        {session.items.map((item) => {
          const isCurrent = currentOrder !== null && item.order === currentOrder;
          const isPast = currentOrder !== null && item.order < currentOrder;
          return (
            <li
              key={item.id}
              className={cn(
                "flex items-baseline justify-between gap-4 py-2.5 border-t border-white/5 first:border-t-0",
                isPast && "opacity-40",
                isCurrent && "text-primary font-semibold"
              )}
            >
              <span className={cn("text-body truncate", !isCurrent && "text-muted")}>{item.title}</span>
              {item.scheduledStart && (
                <span className="text-caption text-muted-2 tabular-nums shrink-0">{item.scheduledStart}</span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
