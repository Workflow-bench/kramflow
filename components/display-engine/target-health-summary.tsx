"use client";

import { useEffect, useState } from "react";
import { targetMatchesDisplay } from "@/lib/display-engine/store";
import { getDisplayStatus, type DisplayHealth } from "@/lib/display-engine/use-register-display";
import type { BroadcastTarget, DisplayGroup, DisplayInstance } from "@/lib/display-engine/types";
import { OperationalStatus } from "@/components/ui/operational-status";
import { EmptyState } from "@/components/ui/empty-state";

// Answers "who will actually receive this" before Send, reusing the exact
// matching logic BroadcastOverlay itself uses on the display side
// (targetMatchesDisplay) and the health thresholds the Displays fleet view
// established (getDisplayStatus) — not a separately-invented estimate.
// Deliberately stops at TARGETED/ONLINE/STALE/OFFLINE: the backend has no
// delivery receipt, so this never claims a message was *received*, only
// that a given display was reachable as of its last heartbeat.
export function TargetHealthSummary({
  target,
  registry,
  groups,
}: {
  target: BroadcastTarget;
  registry: Record<string, DisplayInstance>;
  groups: Record<string, DisplayGroup>;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(id);
  }, []);

  const matched = Object.values(registry).filter((d) => targetMatchesDisplay(target, d, groups));
  const counts = matched.reduce(
    (acc, d) => {
      acc[getDisplayStatus(d, now)]++;
      return acc;
    },
    { online: 0, stale: 0, offline: 0 } as Record<DisplayHealth, number>
  );

  if (matched.length === 0) {
    return (
      <EmptyState
        title="No registered displays match this target"
        body="Nothing will receive this until a matching display is open on a display route. You can still send — it delivers to any that connect afterward."
      />
    );
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-console-sm text-primary font-medium">
        {matched.length} display{matched.length === 1 ? "" : "s"} targeted
      </span>
      {counts.online > 0 && <OperationalStatus kind="online" label={`${counts.online} online`} />}
      {counts.stale > 0 && <OperationalStatus kind="stale" label={`${counts.stale} stale`} />}
      {counts.offline > 0 && <OperationalStatus kind="offline" label={`${counts.offline} offline`} />}
    </div>
  );
}
