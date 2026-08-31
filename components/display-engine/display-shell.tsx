"use client";

import { useWakeLock } from "@/lib/display-engine/use-fullscreen";
import { ConnectionBadge, type ConnectionBadgeStatus } from "@/components/ui/connection-badge";
import { cn } from "@/lib/utils";

/**
 * Full-viewport shell for every Display Engine surface — full-bleed, fixed
 * safe-area margin, no browser chrome assumptions.
 */
export function DisplayShell({
  children,
  className,
  wakeLockEnabled = true,
  connectionStatus,
}: {
  children: React.ReactNode;
  className?: string;
  wakeLockEnabled?: boolean;
  // Report finding #34 — rendered once here so all four display routes
  // (General/AV/Green Room/Presenter) get the same corner indicator
  // instead of each reimplementing it. Optional only so a caller that
  // genuinely has no connection concept (there are none today) isn't
  // forced to pass one; every real display route does.
  connectionStatus?: ConnectionBadgeStatus;
}) {
  useWakeLock(wakeLockEnabled);

  return (
    <main className={cn("h-screen w-screen overflow-x-hidden overflow-y-auto bg-background flex flex-col", className)}>
      {connectionStatus && <ConnectionBadge status={connectionStatus} variant="stage" />}
      {/* min-h-0 is required here, not decorative: without it this flex
          item's default min-height:auto refuses to shrink below its
          content's natural height, so any unconstrained-length child
          balloons this div's height instead of laying out normally within
          it. Overflow itself is no longer silently clipped (at
          short/landscape-phone viewports —
          e.g. a phone in landscape used by AV crew in practice — real
          content like the countdown or the LIVE badge was rendered but
          unreachable, with <main>'s old overflow-hidden and no scrollbar).
          <main> now scrolls vertically instead, so a short viewport can
          reach everything by scrolling rather than losing it; horizontal
          overflow stays hidden since nothing here is meant to scroll
          sideways. */}
      {/* justify-start, not -between: with a trailing element (e.g. Green
          Room's "Queue Position" row) that wants pinning to the bottom when
          there's spare room, -between computes negative free space once the
          content above genuinely overflows the viewport, and the trailing
          element renders overlapping that content instead of below it — the
          exact R2-BUG-4 symptom on Green Room at a short viewport. The
          affected page adds `mt-auto` to that one trailing element instead,
          which pins it the same way in the normal case but can't produce
          negative space. */}
      <div className="flex-1 min-h-0 flex flex-col justify-start" style={{ padding: "clamp(48px, 4vw, 64px)" }}>
        {children}
      </div>
    </main>
  );
}
