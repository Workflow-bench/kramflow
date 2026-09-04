"use client";

import { computeSessionReadiness } from "@/lib/readiness";
import type { Session } from "@/lib/types";
import type { DisplayInstance } from "@/lib/display-engine/types";
import { OperationalStatus, OperationalStatusOk } from "@/components/ui/operational-status";

// Same "surface what needs attention, not what's already fine" philosophy
// as TargetHealthSummary right below this on the panel — a single
// affirmative badge when every check passes, only the warn/fail checks
// listed individually otherwise. Not shown once the session is already
// live (currentOrder !== null): readiness is a pre-show question, and
// re-litigating "is the cue sheet empty" mid-show is noise, not signal.
export function SessionReadiness({
  session,
  registry,
}: {
  session: Session;
  registry: Record<string, DisplayInstance>;
}) {
  const checks = computeSessionReadiness(session, registry);
  const blocking = checks.some((c) => c.status === "fail");

  if (checks.length === 0) {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <OperationalStatusOk label="Ready to go live" />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {blocking && (
        <span className="text-console-meta text-muted-2">Not ready:</span>
      )}
      {checks.map((c) => (
        <OperationalStatus key={c.id} kind={c.status === "fail" ? "critical" : "warning"} label={c.detail} />
      ))}
    </div>
  );
}
