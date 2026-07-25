"use client";

import Link from "next/link";
import { Lock, Smartphone, Tv, FileSpreadsheet, Presentation, Megaphone, Settings2 } from "lucide-react";
import { useEventStore } from "@/lib/store";
import { useSessions } from "@/lib/use-sessions";
import { getSessionById } from "@/lib/data/sessions";
import { useAuth } from "@/components/auth/auth-context";
import { ProgramList } from "@/components/operator/program-list";
import { SessionSwitcher } from "@/components/operator/session-switcher";
import { LiveDetailsPanel } from "@/components/operator/live-details-panel";
import { ControlsPanel } from "@/components/operator/controls-panel";
import { ProgressFooter } from "@/components/tv/progress-footer";
import { SectionLabel } from "@/components/tv/section-label";
import { Button } from "@/components/ui/button";

export default function OperatorPage() {
  const { state } = useEventStore();
  const { lock } = useAuth();
  const sessions = useSessions();
  const session = getSessionById(sessions, state.activeSessionId);
  const progress = state.progressBySession[state.activeSessionId];

  return (
    <main className="min-h-screen xl:h-screen xl:overflow-hidden bg-background flex flex-col">
      <header className="flex flex-col xl:flex-row xl:items-center gap-4 xl:gap-8 px-4 sm:px-6 xl:px-12 py-4 xl:py-6 border-b border-white/5 shrink-0">
        <div className="flex items-center justify-between xl:contents">
          <div className="min-w-0 shrink-0">
            <p className="text-caption uppercase tracking-wide text-muted-2">
              {session ? `${session.dayLabel} • ${session.sessionLabel}` : "KramFlow"}
            </p>
            <h1 className="text-title text-primary mt-1">KramFlow</h1>
          </div>

          <Button variant="ghost" size="sm" className="xl:hidden" onClick={lock} aria-label="Lock">
            <Lock className="h-4 w-4" strokeWidth={2} />
          </Button>
        </div>

        <div className="xl:flex-1 xl:min-w-0">
          <SessionSwitcher />
        </div>

        <div className="flex items-center flex-wrap gap-2 shrink-0">
          <Link href="/operator/cue-sheet">
            <Button variant="secondary" size="sm">
              <FileSpreadsheet className="h-4 w-4" strokeWidth={2} />
              Cue Sheet
            </Button>
          </Link>
          <Link href="/green-room" target="_blank">
            <Button variant="secondary" size="sm">
              <Tv className="h-4 w-4" strokeWidth={2} />
              Green Room
            </Button>
          </Link>
          <Link href="/av" target="_blank">
            <Button variant="secondary" size="sm">
              <Tv className="h-4 w-4" strokeWidth={2} />
              AV
            </Button>
          </Link>
          <Link href="/general" target="_blank">
            <Button variant="secondary" size="sm">
              <Tv className="h-4 w-4" strokeWidth={2} />
              General
            </Button>
          </Link>
          <Link href="/presenter" target="_blank">
            <Button variant="secondary" size="sm">
              <Presentation className="h-4 w-4" strokeWidth={2} />
              Presenter
            </Button>
          </Link>
          <Link href="/remote" target="_blank">
            <Button variant="secondary" size="sm">
              <Smartphone className="h-4 w-4" strokeWidth={2} />
              Remote
            </Button>
          </Link>
          <Link href="/broadcast">
            <Button variant="secondary" size="sm">
              <Megaphone className="h-4 w-4" strokeWidth={2} />
              Broadcast
            </Button>
          </Link>
          <Link href="/display-manager">
            <Button variant="secondary" size="sm">
              <Settings2 className="h-4 w-4" strokeWidth={2} />
              Displays
            </Button>
          </Link>
          <Button variant="ghost" size="sm" className="hidden xl:inline-flex" onClick={lock} aria-label="Lock">
            <Lock className="h-4 w-4" strokeWidth={2} />
          </Button>
        </div>
      </header>

      {session ? (
        <div className="flex-1 xl:min-h-0 grid grid-cols-1 xl:grid-cols-[1fr_340px_280px] 2xl:grid-cols-[1fr_400px_320px]">
          <div className="min-w-0 xl:min-h-0 xl:overflow-y-auto px-4 sm:px-6 xl:px-12 py-6 xl:py-8">
            <div className="flex items-center justify-between gap-4">
              <SectionLabel>Program</SectionLabel>
              {/* A progress bar already exists in the page footer, but it's
                  easy to miss down there while scanning the rundown — this
                  slim one sits right where the eye already is, readable
                  peripherally without looking away from the item list. */}
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

          <div className="min-w-0 border-t xl:border-t-0 xl:border-l border-white/5 px-4 sm:px-6 xl:px-10 py-6 xl:py-8 xl:overflow-y-auto">
            <LiveDetailsPanel session={session} />
          </div>

          <div className="min-w-0 border-t xl:border-t-0 xl:border-l border-white/5 px-4 sm:px-6 xl:px-8 py-6 xl:py-8 xl:overflow-y-auto">
            <ControlsPanel session={session} />
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-4 sm:px-6 xl:px-12 py-16">
          <p className="text-body text-muted">
            {sessions.length === 0 ? "No sessions yet." : "Select a session to get started."}
          </p>
          {sessions.length === 0 && (
            <Link href="/operator/cue-sheet">
              <Button variant="primary" size="sm">
                <FileSpreadsheet className="h-4 w-4" strokeWidth={2} />
                Go to Cue Sheet
              </Button>
            </Link>
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
