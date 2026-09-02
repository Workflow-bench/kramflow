"use client";

import { useEffect } from "react";
import { FileSpreadsheet, FlaskConical, Lock, Users } from "lucide-react";
import { useEventStore, useConnectionStatus } from "@/lib/store";
import { ConnectionBadge } from "@/components/ui/connection-badge";
import { useSessions, useSessionsLoading } from "@/lib/use-sessions";
import { useMediaQuery } from "@/lib/use-media-query";
import { useEventId } from "@/lib/event-context";
import { getSessionById } from "@/lib/data/sessions";
import type { Session, SessionProgress } from "@/lib/types";
import { useAuth } from "@/components/auth/auth-context";
import { useOperatorPresence } from "@/lib/use-operator-presence";
import { ProgramList } from "@/components/operator/program-list";
import { SessionSwitcher } from "@/components/operator/session-switcher";
import { EventNav } from "@/components/operator/event-nav";
import { EventIdentity } from "@/components/operator/event-identity";
import { LiveDetailsPanel } from "@/components/operator/live-details-panel";
import { ControlsPanel } from "@/components/operator/controls-panel";
import { ProgressFooter } from "@/components/tv/progress-footer";
import { SectionLabel } from "@/components/tv/section-label";
import { Button, LinkButton } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

export default function OperatorPage() {
  const eventId = useEventId();
  const { state } = useEventStore();
  const { status, lock } = useAuth();
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
      {/* Two stable rows at xl+, not one row three flex children raced for —
          that's what the 2026-09-01 UI/UX audit's P0 finding #1 actually
          was: EventIdentity was shrink-0 (protected), SessionSwitcher was
          flex-1 (greedy), and this nav cluster was min-w-0 (no floor at
          all), so real content — 6 sessions, a full event name — collided
          at ordinary laptop widths (reproduced at 1440×900). Giving
          SessionSwitcher its own full-width row removes the three-way
          fight entirely instead of tuning the min-widths that caused it. */}
      <header className="flex flex-col gap-3 px-4 sm:px-6 xl:px-12 py-4 xl:py-5 border-b border-white/5 shrink-0">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <EventIdentity />
            <div className="flex items-center gap-2.5 mt-1.5 min-w-0">
              <h1 className="text-title text-primary truncate">
                <span className="sm:hidden">Console</span>
                <span className="hidden sm:inline">Operator Console</span>
              </h1>
              {operatorCount > 1 && (
                <span
                  className="flex items-center gap-1.5 text-caption font-semibold uppercase tracking-wide text-status-orange bg-status-orange/15 px-2.5 py-1 rounded-full"
                  title={`Connected: ${operators.map((o) => o.name).join(", ")}`}
                >
                  <Users className="h-3.5 w-3.5" strokeWidth={2} />
                  {operatorCount} operators
                </span>
              )}
              <ConnectionBadge status={connectionStatus} variant="console" />
            </div>
          </div>

          <div className="hidden xl:flex items-center gap-2 shrink-0">
            <EventNav />

            {/* Rehearsal Mode deliberately lives here, next to Lock, rather
                than as a nav destination — it's an operating mode for the
                live console, not a content screen (see
                kramflow_nav_layout_ground_up.md). Still its own route under
                the hood (rehearsal state must never touch the real live_state
                row — see app/e/[eventId]/rehearsal/page.tsx), just entered
                from a mode-toggle-styled affordance instead of a menu item. */}
            <LinkButton
              href={`/e/${eventId}/rehearsal`}
              variant="warning"
              size="sm"
              className="rounded-full"
              aria-label="Rehearsal Mode"
              title="Rehearsal Mode — practice the sequence without touching the real live show"
            >
              <FlaskConical className="h-3.5 w-3.5" strokeWidth={2} />
              <span className="hidden 2xl:inline">Rehearsal Mode</span>
            </LinkButton>

            <span
              className="flex items-center gap-1.5 text-caption text-muted-2 pl-1"
              title="Open the command palette to jump to any route, session, or tool"
            >
              <kbd className="border border-white/10 rounded px-1.5 py-0.5">⌘K</kbd>
            </span>

            <Button variant="ghost" size="sm" onClick={lock} aria-label="Lock">
              <Lock className="h-4 w-4" strokeWidth={2} />
            </Button>
          </div>

          <Button variant="ghost" size="sm" className="xl:hidden shrink-0" onClick={lock} aria-label="Lock">
            <Lock className="h-4 w-4" strokeWidth={2} />
          </Button>
        </div>

        <div className="xl:hidden flex items-center flex-wrap gap-2">
          <EventNav />
          <LinkButton href={`/e/${eventId}/rehearsal`} variant="warning" size="sm" className="rounded-full">
            <FlaskConical className="h-3.5 w-3.5" strokeWidth={2} />
            <span className="hidden md:inline">Rehearsal Mode</span>
          </LinkButton>
        </div>

        <SessionSwitcher />
      </header>

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
          <p className="text-body text-muted">Loading sessions…</p>
        </div>
      ) : session ? (
        <OperatorGrid
          session={session}
          progress={progress}
          broadcastAction={broadcastAction}
          isDesktopLayout={isDesktopLayout}
        />
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-4 sm:px-6 xl:px-12 py-16">
          <p className="text-body text-muted">
            {sessions.length === 0 ? "No sessions yet." : "Select a session to get started."}
          </p>
          {sessions.length === 0 && (
            <LinkButton href={`/e/${eventId}/operator/cue-sheet`} variant="primary" size="sm">
              <FileSpreadsheet className="h-4 w-4" strokeWidth={2} />
              Go to Cue Sheet
            </LinkButton>
          )}
        </div>
      )}

      {session && (
        <footer className="shrink-0 px-4 sm:px-6 xl:px-12 py-5 border-t border-white/5">
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
}: {
  session: Session;
  progress: SessionProgress | undefined;
  broadcastAction: (message: string) => void;
  isDesktopLayout: boolean;
}) {
  const program = (
    <div className="min-w-0 xl:min-h-0 xl:overflow-y-auto px-4 sm:px-6 xl:px-12 py-6 xl:py-8">
      <div className="flex items-center justify-between gap-4">
        <SectionLabel>Program</SectionLabel>
        {/* A progress bar already exists in the page footer, but it's easy
            to miss down there while scanning the rundown — this slim one
            sits right where the eye already is, readable peripherally
            without looking away from the item list. */}
        <span className="text-caption text-muted-2 tabular-nums shrink-0">
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
    <div className="min-w-0 px-4 sm:px-6 xl:px-10 py-6 xl:py-8 xl:overflow-y-auto">
      <LiveDetailsPanel session={session} />
    </div>
  );

  const controls = (
    <div className="min-w-0 px-4 sm:px-6 xl:px-8 py-6 xl:py-8 xl:overflow-y-auto">
      <ControlsPanel session={session} broadcastAction={broadcastAction} />
    </div>
  );

  if (isDesktopLayout) {
    return (
      <div className="flex-1 xl:min-h-0 grid grid-cols-1 xl:grid-cols-[1fr_340px_280px] 2xl:grid-cols-[1fr_400px_320px]">
        {program}
        <div className="border-l border-white/5">{liveDetails}</div>
        <div className="border-l border-white/5">{controls}</div>
      </div>
    );
  }

  return (
    <div className="flex-1 grid grid-cols-1">
      <div className="border-b border-white/5">{liveDetails}</div>
      <div className="border-b border-white/5">{controls}</div>
      {program}
    </div>
  );
}
