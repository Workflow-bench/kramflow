"use client";

import { useEffect, useState } from "react";
import { ChevronDown, FileSpreadsheet, FlaskConical, Users } from "lucide-react";
import { useEventStore, useConnectionStatus } from "@/lib/store";
import { useSessions, useSessionsLoading } from "@/lib/use-sessions";
import { useMediaQuery } from "@/lib/use-media-query";
import { useEventId } from "@/lib/event-context";
import { getSessionById } from "@/lib/data/sessions";
import type { Session, SessionProgress } from "@/lib/types";
import { useAuth } from "@/components/auth/auth-context";
import { useOperatorPresence } from "@/lib/use-operator-presence";
import { useOperatorColumnLayout } from "@/lib/use-operator-column-layout";
import { ProgramList } from "@/components/operator/program-list";
import { SessionPopover } from "@/components/operator/session-popover";
import { EventShellHeader } from "@/components/operator/event-shell-header";
import { LiveDetailsPanel, LiveNotes } from "@/components/operator/live-details-panel";
import { ControlsPanel, ControlsSecondaryTools } from "@/components/operator/controls-panel";
import { OperatorColumns } from "@/components/operator/operator-columns";
import { OperatorLayoutMenu } from "@/components/operator/operator-layout-menu";
import { ProgressFooter } from "@/components/ui/progress-footer";
import { SectionLabel } from "@/components/ui/section-label";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

export default function OperatorPage() {
  const eventId = useEventId();
  const { state } = useEventStore();
  const { status } = useAuth();
  const sessions = useSessions();
  const sessionsLoading = useSessionsLoading();
  const session = getSessionById(sessions, state.activeSessionId);
  const progress = state.progressBySession[state.activeSessionId];
  const toast = useToast();
  const { count: operatorCount, operators, lastAction, broadcastAction } = useOperatorPresence(status === "unlocked");
  const connectionStatus = useConnectionStatus();
  // Matches the grid's own `xl:` breakpoint (1280px) exactly — see
  // OperatorGrid below for why this needs to be a real DOM reorder rather
  // than a CSS-only one.
  const isDesktopLayout = useMediaQuery("(min-width: 1280px)");
  // A real 2-column master-detail at tablet width (1024-1279px), not a
  // third stop on the same desktop/mobile spectrum — the 2026-09-01
  // design-system audit's #1 ranked finding: the earlier mobile fix below
  // (Live Now + Controls rendering before the rundown) solved "controls
  // buried under a 40-row list" but at 1024px just inverted it into
  // "rundown buried under Live/Controls/Jump/Alert/Broadcast/Activity."
  // Neither strict order works in one column; 1024px has room for both to
  // be on screen at once, so this stops being a stacking-order tradeoff.
  const isTabletLayout = useMediaQuery("(min-width: 1024px)") && !isDesktopLayout;
  // Called unconditionally (not just when isDesktopLayout) so the same
  // instance backs both the header's Layout menu below and OperatorGrid's
  // resizable columns further down — two separate hook calls would each
  // keep their own in-memory state, so a Reset from the menu wouldn't
  // actually move the columns already on screen. See the hook's own
  // comment for why a callback ref makes this safe across every desktop
  // <-> tablet/mobile remount.
  const columnLayout = useOperatorColumnLayout();

  // A different connection just took an action — the same shape as the
  // "someone else is editing" toast in collaborative editors. Doesn't
  // attempt to resolve the conflict, just makes it visible instead of
  // silent (see R2-BUG-1: a Hold got cleared by another tab's Next with
  // zero indication to the operator who set it).
  useEffect(() => {
    if (lastAction) toast.info(`Another operator: ${lastAction.message}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastAction]);

  return (
    <main className="min-h-screen xl:h-screen xl:overflow-hidden bg-background flex flex-col">
      <EventShellHeader
        title="Operator Console"
        titleMobile="Console"
        connectionStatus={connectionStatus}
        badges={
          operatorCount > 1 && (
            <span title={`Connected: ${operators.map((o) => o.name).join(", ")}`} className="shrink-0">
              <Badge tone="orange" className="gap-1.5">
                <Users className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
                {operatorCount} operators
              </Badge>
            </span>
          )
        }
        sessionContext={<SessionPopover />}
        actions={[
          // Rehearsal Mode deliberately lives here, next to Lock, rather
          // than as a nav destination — it's an operating mode for the
          // live console, not a content screen (see
          // kramflow_nav_layout_ground_up.md). Still its own route under
          // the hood (rehearsal state must never touch the real live_state
          // row — see app/e/[eventId]/rehearsal/page.tsx), just entered
          // from a mode-toggle-styled affordance instead of a menu item.
          <LinkButton
            key="rehearsal"
            href={`/e/${eventId}/rehearsal`}
            variant="warning"
            size="sm"
            className="rounded-full"
            aria-label="Rehearsal Mode"
            title="Rehearsal Mode: practice the sequence without touching the real live show"
          >
            <FlaskConical className="h-3.5 w-3.5" strokeWidth={2} />
            <span className="hidden lg:inline">Rehearsal Mode</span>
          </LinkButton>,
          // Column widths only mean anything once the resizable desktop
          // grid is actually on screen — tablet/mobile have their own
          // fixed compositions with nothing here to adjust.
          isDesktopLayout && <OperatorLayoutMenu key="layout" layout={columnLayout} />,
        ]}
      />

      {sessionsLoading ? (
        // Distinct from the "No sessions yet" branch below on purpose — see
        // lib/use-sessions.ts's useSessionsLoading() comment. Before this,
        // both states rendered identical copy, so a slow connection looked
        // exactly like a wiped-out event for the ~1-1.5s hydration window
        // (2026-09-01 UI/UX audit, P1 finding #2).
        <div
          className="flex-1 flex flex-col items-center justify-center gap-4 px-4 sm:px-6 xl:px-12 py-16"
          role="status"
          aria-live="polite"
        >
          <p className="text-console-sm text-muted">Loading sessions…</p>
        </div>
      ) : session ? (
        <OperatorGrid
          session={session}
          progress={progress}
          broadcastAction={broadcastAction}
          isDesktopLayout={isDesktopLayout}
          isTabletLayout={isTabletLayout}
          columnLayout={columnLayout}
        />
      ) : (
        <div className="flex-1 flex items-center justify-center px-4 sm:px-6 xl:px-12 py-16">
          <EmptyState
            title={sessions.length === 0 ? "No sessions yet." : "Select a session to get started."}
            action={
              sessions.length === 0 && (
                <LinkButton href={`/e/${eventId}/operator/cue-sheet`} variant="primary" size="sm">
                  <FileSpreadsheet className="h-4 w-4" strokeWidth={2} />
                  Go to Cue Sheet
                </LinkButton>
              )
            }
          />
        </div>
      )}

      {session && (
        <footer className="shrink-0 px-4 sm:px-6 xl:px-12 py-5 border-t border-line-soft">
          <ProgressFooter
            dayLabel={session.dayLabel}
            sessionLabel={session.sessionLabel}
            currentIndex={Math.min(progress?.currentOrder ?? 0, session.items.length)}
            total={session.items.length}
          />
        </footer>
      )}
    </main>
  );
}

// Split out so the reorder below reads as one decision, not a diff buried
// inside the 170-line page component. `isDesktopLayout` (a real
// useMediaQuery(), not a CSS breakpoint) decides DOM order, not just visual
// order — see lib/use-media-query.ts's comment for why that distinction
// matters here specifically. Below xl, Live Now + Controls render *before*
// the full cue list in both the DOM and on screen, closing the 2026-09-01
// audit's P1 finding #3: on a populated session, Next/Hold previously sat
// thousands of pixels below the program list on phone/tablet widths — a
// dangerous distance to travel mid-show. Above xl, DOM order is unchanged
// from before this fix (Program, Live Now, Controls, left to right).
function OperatorGrid({
  session,
  progress,
  broadcastAction,
  isDesktopLayout,
  isTabletLayout,
  columnLayout,
}: {
  session: Session;
  progress: SessionProgress | undefined;
  broadcastAction: (message: string) => void;
  isDesktopLayout: boolean;
  isTabletLayout: boolean;
  columnLayout: ReturnType<typeof useOperatorColumnLayout>;
}) {
  const program = (
    <div className="min-w-0 xl:min-h-0 xl:overflow-y-auto px-4 sm:px-6 xl:px-12 py-6 xl:py-8">
      <div className="flex items-center justify-between gap-4">
        <SectionLabel>Program</SectionLabel>
        {/* A progress bar already exists in the page footer, but it's easy
            to miss down there while scanning the rundown — this slim one
            sits right where the eye already is, readable peripherally
            without looking away from the item list. */}
        <span className="text-console-meta text-muted-2 tabular-nums shrink-0">
          {Math.min(progress?.currentOrder ?? 0, session.items.length)} / {session.items.length}
        </span>
      </div>
      <div className="h-1 w-full rounded-full bg-card overflow-hidden mt-2">
        <div
          className="h-full rounded-full bg-muted-2"
          style={{
            width: `${session.items.length > 0 ? Math.min(1, (progress?.currentOrder ?? 0) / session.items.length) * 100 : 0}%`,
          }}
        />
      </div>
      <div className="mt-4">
        <ProgramList session={session} />
      </div>
    </div>
  );

  const liveDetails = (
    <div className="min-w-0 xl:min-h-0 xl:flex-1 px-4 sm:px-6 xl:px-10 py-6 xl:py-8 xl:overflow-y-auto">
      <LiveDetailsPanel session={session} />
    </div>
  );

  const controls = (
    <div className="min-w-0 xl:min-h-0 xl:flex-1 px-4 sm:px-6 xl:px-8 py-6 xl:py-8 xl:overflow-y-auto">
      <ControlsPanel session={session} broadcastAction={broadcastAction} />
    </div>
  );

  if (isDesktopLayout) {
    // Program/Live Now/Controls at user-adjustable widths (drag the
    // dividers, or Layout in the header) instead of the old fixed
    // grid-cols-[1fr_340px_280px] split. See
    // lib/use-operator-column-layout.ts for the constraints/persistence
    // and operator-columns.tsx for the grid itself — its column wrapper
    // divs are what liveDetails/controls' own xl:flex-1/xl:overflow-y-auto
    // stretch and scroll against (a flex-column parent, same requirement
    // as before this existed, just satisfied by OperatorColumns' own
    // markup now instead of a wrapper div here).
    return <OperatorColumns program={program} liveNow={liveDetails} controls={controls} layout={columnLayout} />;
  }

  if (isTabletLayout) {
    // Master-detail, not a stacking-order compromise: Program stays
    // visible in its own column the whole time an operator is on this
    // page, at the one width where that's actually possible without
    // shrinking either side below usable. Ordinary page-level scroll
    // (no fixed-height/overflow-y-auto column like the xl: grid above) —
    // deliberately not reusing that grid-rows-[1fr] pattern here: this
    // width doesn't need independent-scroll panels to solve the audit's
    // actual complaint, and that pattern has already caused one real
    // layout bug and one real click-blocking bug on the desktop grid this
    // session. Simpler and safer wins when it solves the same problem.
    //
    // Kramflow UI Shell v2 (Phase 5): Live Now renders first again, ABOVE
    // Controls, superseding the previous order (which existed only to keep
    // Next/Previous/Hold above the fold at short intermediate laptop
    // heights — 1024x768, 1100x700). Phase 5's explicit information
    // hierarchy ranks current item + timer above control authority, and
    // removing Live Now's own card chrome (see live-details-panel.tsx)
    // recovers most of the height that fold-fix was compensating for. At
    // both required tablet breakpoints (834x1194, 1024x1366 — tall) this
    // is a non-issue; a browser window manually resized into the
    // 1024-1279px band at a short height may still need to scroll to reach
    // transport controls, a known, accepted tradeoff of following the
    // brief's priority order rather than re-deriving it — see the Phase 5
    // report's Known issues.
    return (
      <div className="flex-1 grid grid-cols-[1fr_380px]">
        {program}
        <div className="border-l border-line-soft flex flex-col">
          <div className="border-b border-line-soft">{liveDetails}</div>
          {controls}
        </div>
      </div>
    );
  }

  // Mobile: not desktop's columns stacked vertically.
  //
  // Kramflow UI Shell v2 (Phase 5): Live Now renders FIRST again — the
  // approved Phase 5 hierarchy is explicit and ranks it above control
  // authority: current item, timer, next, on deck, THEN control authority,
  // THEN connection, THEN rundown, THEN secondary controls. The prior
  // ordering (Controls first) existed purely to keep Next/Previous/Hold
  // reachable without scrolling — a real, measured problem (Next sat at
  // 971px in an 844px viewport) — but it solved that by inverting the
  // stated information priority rather than by shrinking what was pushing
  // Next down. Live Now no longer carries its own bordered/glass card (see
  // live-details-panel.tsx) — that was the single largest contributor to
  // its height — so the fold problem is addressed at the source instead of
  // by reordering around it. What's left below the fold now is Jump/Alert/
  // Broadcast/Activity, moved behind the collapsed <MoreTools> disclosure
  // below: exactly the "secondary information into progressive disclosure"
  // treatment Phase 5 asks for, and lowest in the stated priority order
  // regardless of scroll position.
  return (
    <div className="flex-1 flex flex-col">
      <div className="border-b border-line-soft px-4 sm:px-6 py-5 sm:py-6">
        <LiveDetailsPanel session={session} hideNotes />
      </div>
      <div className="border-b border-line-soft px-4 sm:px-6 py-5 sm:py-6">
        <ControlsPanel session={session} broadcastAction={broadcastAction} hideSecondaryTools />
      </div>
      {program}
      <div className="border-t border-line-soft px-4 sm:px-6 py-6">
        <LiveNotes session={session} />
      </div>
      <div className="border-t border-line-soft px-4 sm:px-6 py-6">
        <MoreTools session={session} />
      </div>
    </div>
  );
}

// Mobile-only progressive disclosure for Jump/Alert/Broadcast/Activity —
// Phase 5's lowest-priority tier ("secondary operational controls"),
// collapsed by default so it costs no scroll distance until an operator
// actually wants one of these. Desktop/tablet keep them permanently
// visible in the Controls column (there's room, and they're reached with a
// mouse, not a thumb scrolling past four sections to get back to the
// rundown). A plain toggle, not a Popover/Sheet: this content is tall
// (Activity's own list, Alert's composer) and belongs in the page's normal
// scroll flow once open, not a floating overlay that would need its own
// internal scroll region.
function MoreTools({ session }: { session: Session }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="operator-more-tools"
        className="flex w-full items-center justify-between gap-2 text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-control -m-1 p-1"
      >
        <SectionLabel>More Tools</SectionLabel>
        <ChevronDown
          className={cn("h-4 w-4 text-muted-2 transition-transform duration-150", open && "rotate-180")}
          strokeWidth={2}
        />
      </button>
      {open && (
        <div id="operator-more-tools" className="mt-6 motion-safe:animate-rise">
          <ControlsSecondaryTools session={session} />
        </div>
      )}
    </div>
  );
}
