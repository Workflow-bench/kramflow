"use client";

import { Lock as LockIcon } from "lucide-react";
import { useAuth } from "@/components/auth/auth-context";
import { EventIdentity } from "@/components/operator/event-identity";
import { EventNav } from "@/components/operator/event-nav";
import { ConnectionBadge, type ConnectionBadgeStatus } from "@/components/ui/connection-badge";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { useClock } from "@/lib/use-clock";
import { cn } from "@/lib/utils";

// The one shared shell every event-scoped Console screen renders — Console,
// Cue Sheet, Displays, Broadcast Center, and Settings each independently
// hand-copied this exact header (EventIdentity, title, ConnectionBadge,
// EventNav, Lock) before this existed, drifting in small ways along the way
// (Settings and Cue Sheet never got a ConnectionBadge; Lock was icon-only
// in one place and text elsewhere). One implementation now.
//
// Two visually distinct bands, not one flat bar — this is a deliberate
// compositional change (2026-09 visual redesign), not a token tweak. A
// single undifferentiated top bar is exactly the generic-SaaS silhouette
// the redesign is meant to move away from; the professional rundown/
// broadcast tools this product is benchmarked against (Stagetimer's
// connection management, Ontime's remote client inventory) treat "which
// event, is it live-synced, what time is it" as its own persistent
// instrument strip, separate from wayfinding. The strip is a hair lighter
// than the page background (bg-white/[0.03]) — a recessed instrument
// panel, not another card — with small, tabular-numeral text; the row
// below it carries the actual page identity and navigation at normal
// weight.
export function EventShellHeader({
  title,
  titleMobile,
  connectionStatus,
  badges,
  actions,
  belowNav,
}: {
  title: string;
  /** Shorter form for the narrowest viewports — omit if the title is already short. */
  titleMobile?: string;
  connectionStatus: ConnectionBadgeStatus;
  /** Extra status pills next to the title (e.g. Operator's "N operators" presence badge). */
  badges?: React.ReactNode;
  /** Route-specific header actions (e.g. Operator's Rehearsal Mode entry) — rendered before Lock. */
  actions?: React.ReactNode;
  /** Route-specific content directly under the shell (e.g. Operator's SessionSwitcher) — kept out of the sticky/scroll concerns of the page body. */
  belowNav?: React.ReactNode;
}) {
  const { lock } = useAuth();
  const clock = useClock();

  return (
    <header className="shrink-0">
      <div className="flex items-center justify-between gap-4 px-4 sm:px-6 xl:px-12 py-2 bg-white/[0.03] border-b border-line-soft">
        <EventIdentity />
        <div className="flex items-center gap-3 text-console-meta text-muted-2 shrink-0">
          <ConnectionBadge status={connectionStatus} variant="console" />
          <span className="hidden sm:inline tnum" aria-hidden="true">
            {clock}
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap px-4 sm:px-6 xl:px-12 py-4 xl:py-5 border-b border-line-soft">
        <div className="flex items-center flex-wrap gap-2.5 min-w-0">
          <h1 className={cn("text-console-lg text-primary shrink-0", titleMobile && "hidden sm:inline")}>{title}</h1>
          {titleMobile && (
            <h1 className="text-console-lg text-primary shrink-0 sm:hidden">{titleMobile}</h1>
          )}
          {badges}
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {actions}
          <EventNav />
          <Tooltip content="Lock">
            <Button variant="ghost" size="sm" square onClick={lock} aria-label="Lock">
              <LockIcon className="h-4 w-4" strokeWidth={2} />
            </Button>
          </Tooltip>
        </div>
      </div>

      {belowNav}
    </header>
  );
}
