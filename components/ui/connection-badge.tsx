import { Wifi, WifiOff, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

export type ConnectionBadgeStatus = "connected" | "reconnecting" | "disconnected";

const COPY: Record<ConnectionBadgeStatus, string> = {
  connected: "Synced",
  reconnecting: "Reconnecting…",
  disconnected: "Disconnected",
};

// Report finding #34, named directly as the single change that would most
// increase trust in the product: neither the Operator Console nor any
// display screen showed whether it was actually connected, so a frozen
// display looked identical to a live one. Persistent by design — a small
// quiet "Synced" state is still rendered when everything's fine, not just
// an alarm that appears on failure, so its absence is never itself
// ambiguous (see StageTimer's viewer docs, cited in the Part 5 research:
// a threshold-based indicator, not silent success + loud failure only).
//
// `variant="console"` — a small always-visible pill for the Operator
// Console header, sized to sit next to the operator-presence badge.
// `variant="stage"` — fixed to the display's safe-area corner, TV scale
// (5-15ft viewing distance): a quiet dot when connected, escalating to a
// labeled badge only once there's something worth noticing.
export function ConnectionBadge({
  status,
  variant = "console",
  className,
}: {
  status: ConnectionBadgeStatus;
  variant?: "console" | "stage";
  className?: string;
}) {
  const tone =
    status === "connected" ? "green" : status === "reconnecting" ? "orange" : "red";

  if (variant === "stage") {
    // Top-center, not a corner — every display route (General/AV/Green
    // Room/Presenter) uses the same header shape (a label block on the
    // left, a clock/status cluster on the right; see each *-display-client
    // .tsx's `justify-between` header row), so the corners are exactly
    // where real per-screen content already lives. Top-center is the one
    // band no screen puts anything else, confirmed by reading all four —
    // it's not a guess.
    if (status === "connected") {
      return (
        <div
          className={cn("fixed z-40 left-1/2 -translate-x-1/2 flex items-center", className)}
          style={{ top: "clamp(10px, 1.5vw, 18px)" }}
          title="Live and synced"
        >
          <span className="h-2.5 w-2.5 rounded-full bg-status-green shadow-[0_0_8px_rgba(43,182,115,0.7)]" aria-hidden="true" />
          <span className="sr-only">Live and synced</span>
        </div>
      );
    }
    return (
      <div
        className={cn(
          "fixed z-40 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-full px-4 py-2 text-caption font-semibold uppercase tracking-wide",
          "shadow-float",
          tone === "orange" && "bg-status-orange text-background",
          tone === "red" && "bg-status-red text-white",
          className
        )}
        style={{ top: "clamp(10px, 1.5vw, 18px)" }}
        role="status"
      >
        {status === "reconnecting" ? (
          <RefreshCw className="h-4 w-4 animate-spin" strokeWidth={2.5} />
        ) : (
          <WifiOff className="h-4 w-4" strokeWidth={2.5} />
        )}
        {COPY[status]}
      </div>
    );
  }

  return (
    <span
      role="status"
      className={cn(
        "flex items-center gap-1.5 text-caption font-semibold uppercase tracking-wide px-2.5 py-1 rounded-full shrink-0",
        tone === "green" && "text-status-green bg-status-green/15",
        tone === "orange" && "text-status-orange bg-status-orange/15",
        tone === "red" && "text-status-red bg-status-red/15",
        className
      )}
      title={
        status === "connected"
          ? "Live-synced with the server"
          : "Lost the live connection to the backend — actions may not be reaching the server, and this screen may be showing stale data"
      }
    >
      {status === "connected" && <Wifi className="h-3.5 w-3.5" strokeWidth={2} />}
      {status === "reconnecting" && <RefreshCw className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />}
      {status === "disconnected" && <WifiOff className="h-3.5 w-3.5" strokeWidth={2} />}
      {COPY[status]}
    </span>
  );
}
