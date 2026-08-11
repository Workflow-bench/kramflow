import type { Alert } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Shared severity-colored alert banner. Every surface that renders
 * `state.alert` (AV, Presenter, Green Room, General, and the operator's own
 * panel) must use this so a given severity reads identically everywhere —
 * QA found this had drifted into three different implementations (a full
 * colored card on AV, a small always-red caption on Presenter, and
 * uncolored plain text in the operator's composer).
 */
export function AlertBanner({
  alert,
  className,
  compact = false,
}: {
  alert: Alert;
  className?: string;
  /** Caption-sized pill instead of a full card — for tight top-strip
   *  layouts (Presenter) where a full banner doesn't fit. Severity colors
   *  are identical to the default card so a given severity still means the
   *  same thing everywhere; only the size/shape changes. */
  compact?: boolean;
}) {
  return (
    <div
      role="alert"
      className={cn(
        alert.severity === "critical" && "bg-status-red/15 text-status-red",
        alert.severity === "warning" && "bg-status-orange/15 text-status-orange",
        alert.severity === "info" && "bg-status-blue/15 text-status-blue",
        compact
          ? "text-caption font-semibold uppercase tracking-wide px-3 py-1 rounded-full"
          : "rounded-card px-6 py-4 text-body font-semibold",
        className
      )}
    >
      {alert.message}
    </div>
  );
}
