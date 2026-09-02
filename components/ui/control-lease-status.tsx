import { Lock, Unlock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EventRole } from "@/lib/event-context";

// Canonical control-authority display — previously inline markup
// duplicated (not quite identically) between ControlsPanel and used as the
// reference the Remote page's toast-only pattern was built against. This
// is the one implementation for a *persistent* lease affordance; Remote
// deliberately stays lighter (a toast + Take Over action, no persistent
// strip) because it's a one-handed secondary surface, not the primary
// coordination surface — see app/e/[eventId]/remote/page.tsx's own
// comment. That's a real, kept context difference, not fragmentation.
//
// Four states, mutually exclusive:
//   read-only    — role below owner; can't ever hold the lease
//   held by me   — iHaveControl
//   held by other — lockedByOther, names who
//   unclaimed    — none of the above
export function ControlLeaseStatus({
  role,
  iHaveControl,
  lockedByOther,
  controllerName,
  busy,
  onRelease,
  onTakeControl,
  onTakeOver,
  className,
}: {
  role: EventRole;
  iHaveControl: boolean;
  lockedByOther: boolean;
  /** Resolved display name of whoever holds it — see lib/use-controller-name.ts. null while resolving or genuinely unclaimed. */
  controllerName: string | null;
  /** Disables the action affordance while a claim/release/takeover is in flight. */
  busy: boolean;
  onRelease: () => void;
  onTakeControl: () => void;
  onTakeOver: () => void;
  className?: string;
}) {
  if (role !== "owner") {
    return (
      <span className={cn("flex items-center gap-1.5 text-muted-2", className)}>
        <Lock className="h-3 w-3" strokeWidth={2} />
        You have {role} access — only the event owner can run the live show
      </span>
    );
  }

  if (iHaveControl) {
    return (
      <span className={cn("flex items-center gap-2", className)}>
        <span className="flex items-center gap-1.5 text-status-green">
          <Lock className="h-3 w-3" strokeWidth={2} />
          You have control
        </span>
        <button
          type="button"
          disabled={busy}
          onClick={onRelease}
          className="text-muted-2 hover:text-primary cursor-pointer underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {busy ? "Releasing…" : "Release"}
        </button>
      </span>
    );
  }

  if (lockedByOther) {
    return (
      <span className={cn("flex items-center gap-2", className)}>
        <span className="flex items-center gap-1.5 text-status-orange">
          <Lock className="h-3 w-3" strokeWidth={2} />
          {controllerName ? `${controllerName} has control` : "Locked by another operator"}
        </span>
        <button
          type="button"
          onClick={onTakeOver}
          className="text-status-orange hover:text-primary cursor-pointer underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded"
        >
          Take Over
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={onTakeControl}
      className={cn(
        "flex items-center gap-1.5 text-muted-2 hover:text-primary cursor-pointer",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        className
      )}
    >
      <Unlock className="h-3 w-3" strokeWidth={2} />
      {busy ? "Taking control…" : "Take Control"}
    </button>
  );
}
