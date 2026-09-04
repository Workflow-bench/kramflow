import { Circle, Pause, FlaskConical, Clock, WifiOff, AlertTriangle, OctagonAlert, CheckCircle2 } from "lucide-react";
import { Badge } from "./badge";
import { cn } from "@/lib/utils";

// The audit's central design-system finding: live, hold, rehearsal, ready,
// stale, offline, warning, and critical each had an independently-invented
// badge/dot/pill (HoldBadge, ad-hoc rehearsal chips, Displays' own
// online/offline dot, ...) with no shared grammar — same rounded-pill shape,
// unrelated meaning. This is the one implementation. See DESIGN.md's
// "Operational vocabulary" section for the show-state/system-state split
// this follows.
//
// Two families, distinguished by icon presence — not a second color
// system (DESIGN.md forbids a second interface hue, and reusing
// status-green/orange/red/blue across both families is already the
// product's own precedent, e.g. ConnectionBadge's "reconnecting" state):
//   show state  (live/hold/ready)      — a bare dot. An audience-relevant fact.
//   system/mode (rehearsal/stale/...)  — dot + icon. An operator-relevant fact.
export type OperationalStatusKind = "live" | "hold" | "ready" | "online" | "rehearsal" | "stale" | "offline" | "warning" | "critical";

const CONFIG: Record<OperationalStatusKind, { label: string; tone: "green" | "orange" | "red"; Icon: typeof Circle | null }> = {
  live: { label: "Live", tone: "green", Icon: null },
  hold: { label: "Hold", tone: "orange", Icon: Pause },
  ready: { label: "Ready", tone: "green", Icon: null },
  // A device/connection's own healthy state (e.g. a registered display
  // that's heartbeating normally) — distinct from "ready" (an event/session
  // is prepared to go live). Same calm bare-dot treatment as live/ready:
  // the default expected state shouldn't compete for attention with the
  // things that actually need it.
  online: { label: "Online", tone: "green", Icon: null },
  rehearsal: { label: "Rehearsal", tone: "orange", Icon: FlaskConical },
  stale: { label: "Stale", tone: "orange", Icon: Clock },
  offline: { label: "Offline", tone: "red", Icon: WifiOff },
  warning: { label: "Warning", tone: "orange", Icon: AlertTriangle },
  critical: { label: "Critical", tone: "red", Icon: OctagonAlert },
};

export function OperationalStatus({
  kind,
  label,
  className,
}: {
  kind: OperationalStatusKind;
  /** Override the default word — e.g. a display's specific offline reason. Same tone/icon still apply. */
  label?: string;
  className?: string;
}) {
  const { label: defaultLabel, tone, Icon } = CONFIG[kind];
  return (
    <Badge tone={tone} dot={!Icon} className={cn("gap-1", className)}>
      {Icon && <Icon className="h-3 w-3" strokeWidth={2.5} aria-hidden="true" />}
      {label ?? defaultLabel}
    </Badge>
  );
}

// A plain "everything's fine" affirmative — used where a status row needs
// to say so explicitly rather than by the absence of a warning (e.g. a
// display fleet summary counting healthy displays). Deliberately not part
// of the CONFIG map above: this is a summary/count context, not a single
// item's state pill.
export function OperationalStatusOk({ label = "Healthy", className }: { label?: string; className?: string }) {
  return (
    <Badge tone="green" className={cn("gap-1", className)}>
      <CheckCircle2 className="h-3 w-3" strokeWidth={2.5} aria-hidden="true" />
      {label}
    </Badge>
  );
}
