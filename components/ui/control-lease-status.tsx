import { Lock, Unlock } from "lucide-react";
import { Button } from "@/components/ui/button";
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
//   read-only     — role below owner; can't ever hold the lease
//   held by me    — iHaveControl
//   held by other — lockedByOther, names who
//   unclaimed     — none of the above
//
// Every state renders as the same shape (icon, one-line status, one
// action) at the same height, so the eye reads "this is the ownership
// row" once and then just tracks which variant it's in (Similarity) —
// only the color/weight escalates with how much it actually matters:
// unclaimed and held-by-me stay calm, held-by-other is the one state
// where Next/Previous/Hold will actually fail if pressed, so it's the one
// that visually stands apart (Von Restorff).
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
      <div className={cn("flex items-center gap-2.5 rounded-control border border-line-soft px-3 py-2.5", className)}>
        <Lock className="h-4 w-4 text-muted-2 shrink-0" strokeWidth={2} />
        <p className="text-console-sm text-muted-2">
          You have {role} access. Only the event owner can run the live show.
        </p>
      </div>
    );
  }

  if (iHaveControl) {
    return (
      <div
        className={cn(
          "flex items-center gap-2.5 rounded-control border border-status-green/25 bg-status-green/6 px-3 py-2.5",
          className
        )}
      >
        <Lock className="h-4 w-4 text-status-green shrink-0" strokeWidth={2} />
        <p className="text-console-sm font-medium text-status-green flex-1 min-w-0">You have control</p>
        <button
          type="button"
          disabled={busy}
          onClick={onRelease}
          className="text-console-meta text-muted-2 hover:text-primary cursor-pointer underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {busy ? "Releasing…" : "Release"}
        </button>
      </div>
    );
  }

  if (lockedByOther) {
    // The one state on this row where Next/Previous/Hold will actually
    // fail if pressed — filled, bordered, and paired with a plain-language
    // reason rather than the lock icon alone (spec: "do not rely on a tiny
    // lock icon alone"), so an operator reads *why* the transport controls
    // below won't respond before they try one and get a silent failure.
    // Stacked (not a row with the button squeezed to one side) because
    // Controls' own floor — CONTROLS_MIN, 280px (lib/use-operator-column-
    // layout.ts) — doesn't leave enough width for icon + two-line message +
    // button side by side without either overlapping or wrapping the text
    // into an unreadable single column.
    return (
      <div
        className={cn(
          "flex flex-col gap-2.5 rounded-control border border-status-orange/30 bg-status-orange/10 px-3 py-3",
          className
        )}
      >
        <div className="flex items-start gap-2.5">
          <Lock className="h-4 w-4 text-status-orange shrink-0 mt-0.5" strokeWidth={2} />
          <div className="min-w-0 flex-1">
            <p className="text-console-sm font-medium text-status-orange">
              {controllerName ? `${controllerName} has control` : "Locked by another operator"}
            </p>
            <p className="text-console-meta text-status-orange/80 mt-0.5">
              Next, Previous, and Hold won&apos;t respond until you take over.
            </p>
          </div>
        </div>
        <Button variant="warning" size="sm" className="w-full" onClick={onTakeOver}>
          Take Over
        </Button>
      </div>
    );
  }

  // Unclaimed — the state the redesign specifically targets: a real,
  // deliberate control (icon, status line, and a primary-weight full-width
  // button), not a loose text link floating above the transport buttons.
  // Stacked for the same width reason as locked-by-other above. Deliberately
  // doesn't claim the show can't be run without claiming first (it can,
  // solo — see lib/use-control-lock.ts's own "opt-in" framing): the real
  // reason to claim is keeping a second operator's Next from silently
  // overriding yours mid-show, so that's what the subtext says.
  return (
    <div
      className={cn(
        "flex flex-col gap-2.5 rounded-control border border-line bg-raised/60 px-3 py-3",
        className
      )}
    >
      <div className="flex items-start gap-2.5">
        <Unlock className="h-4 w-4 text-muted-2 shrink-0 mt-0.5" strokeWidth={2} />
        <div className="min-w-0 flex-1">
          <p className="text-console-sm font-medium text-primary">No one has control</p>
          <p className="text-console-meta text-muted-2 mt-0.5">
            Claim it so another operator can&apos;t interrupt the sequence.
          </p>
        </div>
      </div>
      {/* No icon here (the row above already carries one) — at Controls'
          own floor (280px, CONTROLS_MIN) a second icon plus the loading
          spinner crowds "Take Control" into wrapping across two lines. */}
      <Button variant="primary" size="sm" className="w-full" onClick={onTakeControl} loading={busy} disabled={busy}>
        Take Control
      </Button>
    </div>
  );
}
