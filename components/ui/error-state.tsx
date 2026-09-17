import { OctagonAlert } from "lucide-react";
import { Button } from "./button";
import { cn } from "@/lib/utils";

// The other half of DESIGN.md's flagged gap. Before this existed, a failed
// load reused EmptyState verbatim (see event-settings-panel.tsx's
// collaborators list) — visually identical to "there's nothing here," which
// is exactly the ambiguity the Phase 4 audit question "can I distinguish an
// error from a warning?" is aimed at. status-red + OctagonAlert (the same
// icon OperationalStatus's own `critical` variant uses) makes a failed load
// read as a failure at a glance, not a quiet empty list — same anatomy as
// EmptyState otherwise, so retrofitting an existing EmptyState-as-error
// callsite is a drop-in swap.
export function ErrorState({
  title,
  body,
  onRetry,
  retryLabel = "Try Again",
  className,
}: {
  title: string;
  body?: string;
  /** Omit when nothing is actually retryable (e.g. a permanent 403) — an
   *  ErrorState is still valid without a retry action. */
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center text-center gap-2 rounded-panel border border-status-red/30 bg-status-red/5 px-6 py-12",
        className
      )}
    >
      <OctagonAlert className="h-5 w-5 text-status-red" strokeWidth={2} aria-hidden="true" />
      <p className="text-console-sm font-medium text-status-red mt-1">{title}</p>
      {body && <p className="text-console-meta text-muted-2 max-w-[42ch]">{body}</p>}
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry} className="mt-3">
          {retryLabel}
        </Button>
      )}
    </div>
  );
}
