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
// Cue Sheet, Displays, Broadcast Center, and Settings.
//
// Kramflow UI Shell v1 (Phase 4): one band, not two. The prior version
// stacked an "instrument strip" (event identity, connection, clock) above
// a second "identity/nav" band (title, badges, actions, nav, lock) — two
// always-visible bordered rows before any workspace content, plus a third
// full-width row Console alone added for session switching (see
// SessionPopover). That's the exact "event row + page row + session row +
// workspace" pattern flagged in the Phase 0-2 audit as competing for
// vertical space before the actual work surface. This version merges both
// bands into one: event identity, page title, and badges on the left;
// connection, route-specific actions, workspace nav, and lock on the
// right — `sessionContext` (new) renders inline in the left cluster
// instead of forcing its own row. Total header height on desktop drops
// from two ~44-56px bands to one ~48px band.
//
// Still real Liquid Glass (.glass-chrome) — functional chrome, not
// decoration; still NOT sticky, for the same reason as before: body's
// overflow-x-hidden (kept fix for tooltip-clipping scrollWidth inflation)
// forces body's computed overflow-y to auto per the CSS overflow spec,
// which breaks position:sticky here since the real scroll happens on the
// document element, not body. A per-page <main> scroll-container decision
// (matching Console's own xl:h-screen/overflow model) is the real fix,
// tracked separately, not patched around in this component.
export function EventShellHeader({
  title,
  titleMobile,
  connectionStatus,
  badges,
  sessionContext,
  actions,
}: {
  title: string;
  /** Shorter form for the narrowest viewports — omit if the title is already short. */
  titleMobile?: string;
  connectionStatus: ConnectionBadgeStatus;
  /** Extra status pills next to the title (e.g. Operator's "N operators" presence badge). */
  badges?: React.ReactNode;
  /** Compact, inline session-context trigger (e.g. Operator's SessionPopover) — rendered in the same band as the title, never its own full-width row. */
  sessionContext?: React.ReactNode;
  /** Route-specific header actions (e.g. Operator's Rehearsal Mode entry, Layout menu) — rendered before workspace nav. */
  actions?: React.ReactNode;
}) {
  const { lock } = useAuth();
  const clock = useClock();

  return (
    <header className="shrink-0 glass-chrome border-b border-line-soft">
      <div className="flex items-center justify-between gap-x-4 gap-y-2 flex-wrap px-4 sm:px-6 xl:px-12 py-2.5">
        <div className="flex items-center flex-wrap gap-2.5 min-w-0">
          <EventIdentity />
          <span aria-hidden="true" className="hidden sm:block h-4 w-px bg-line-soft shrink-0" />
          <h1 className={cn("text-console-md text-primary shrink-0", titleMobile && "hidden sm:inline")}>{title}</h1>
          {titleMobile && (
            <h1 className="text-console-md text-primary shrink-0 sm:hidden">{titleMobile}</h1>
          )}
          {badges}
          {sessionContext}
        </div>

        <div className="flex items-center gap-2.5 shrink-0 flex-wrap justify-end">
          <div className="flex items-center gap-2 text-console-meta text-muted-2">
            <ConnectionBadge status={connectionStatus} variant="console" />
            {/* Deprioritized to lg: (was sm:) — the clock is the least
                operationally critical fact in this band, and tablet width
                now needs its room for the fully-labeled workspace nav
                (EventNav labels are no longer hidden at this breakpoint). */}
            <span className="hidden lg:inline tnum" aria-hidden="true">
              {clock}
            </span>
          </div>
          {actions}
          <EventNav />
          <Tooltip content="Lock">
            <Button variant="ghost" size="sm" square onClick={lock} aria-label="Lock">
              <LockIcon className="h-4 w-4" strokeWidth={2} />
            </Button>
          </Tooltip>
        </div>
      </div>
    </header>
  );
}
