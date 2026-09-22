"use client";

import { useDisplayView } from "@/lib/use-display-view";
import { getSessionById } from "@/lib/data/sessions";
import { getLive, getNext } from "@/lib/types";
import { useDisplayEngine } from "@/lib/display-engine/store";
import { DisplayEngineProvider } from "@/lib/display-engine/context";
import { useDisplayTimer, useDisplayClock, formatClock } from "@/lib/display-engine/use-display-timer";
import { useDisplayCommands } from "@/lib/display-engine/use-display-commands";
import { deriveProgress, deriveAutoTimerInput, deriveStageStatus } from "@/lib/display-engine/live-progress";
import { useTimeSync } from "@/lib/display-engine/use-time-sync";
import { useFullscreen } from "@/lib/display-engine/use-fullscreen";
import { useKeyboardShortcuts } from "@/lib/display-engine/use-keyboard-shortcuts";
import { TIMER_COLORS } from "@/lib/display-engine/colors";
import { DisplayShell } from "@/components/display-engine/display-shell";
import { HoldScreen } from "@/components/display-engine/hold-screen";
import { BroadcastOverlay } from "@/components/display-engine/broadcast-overlay";
import { TestMessageOverlay } from "@/components/display-engine/test-message-overlay";
import { FullscreenPrompt } from "@/components/display-engine/fullscreen-prompt";
import { StageStatusPill } from "@/components/display-engine/stage-status-pill";
import { AlertBanner } from "@/components/ui/alert-banner";
import { LoadingState } from "@/components/ui/loading-state";
import { LinkInvalid } from "@/components/auth/link-invalid";

// A fixed vw fraction alone doesn't account for string length — a short
// "05:30" and a long overrun "21:06:34" (or a multi-digit-hour overrun,
// which real cue data can produce) got an identical font size, so the
// longer string clipped at the screen edges at real hardware widths below
// ~1920px (reproduced live at 1600x900 against actual overrun demo data:
// the digits ran off both sides with no scrollbar, since Stage surfaces
// intentionally lock scroll). baseVw is the fraction tuned for the
// reference 5-character case ("05:30"); longer strings scale it down
// proportionally so every realistic duration stays legible and uncut at
// any viewport, not just the one it happened to be tuned against.
//
// minRem needs the same treatment at the *narrow* end — it's a hard
// floor with no viewport awareness of its own, so on a phone-width screen
// where baseVw's own computed value would already be well under minRem,
// clamp() still enforces the floor and the digits clip at the screen
// edge instead of shrinking further (Kramflow/Stagetimer competitive
// audit, 2026-09: reproduced at 390×844 — confirmed via screenshot, and
// unrelated to any Tailwind class-merging issue, since every call site
// here sets fontSize as an inline style, not a class). Each caller's
// minRem below is chosen to comfortably fit its longest realistic string
// at 390px, the narrowest width Kramflow supports — baseVw and maxRem
// (which govern medium/large screens, already verified working) are
// unchanged.
function countdownFontSize(text: string, minRem: number, maxRem: number, baseVw: number): string {
  const chars = Math.max(text.length, 5);
  const vw = Math.min(baseVw, Math.round(((baseVw * 5) / chars) * 10) / 10);
  return `clamp(${minRem}rem, ${vw}vw, ${maxRem}rem)`;
}

export default function PresenterDisplayClient({ token, eventId }: { token?: string; eventId?: string }) {
  return (
    <DisplayEngineProvider token={token} eventId={eventId} displayType="presenter">
      <PresenterDisplayInner token={token} eventId={eventId} />
    </DisplayEngineProvider>
  );
}

function PresenterDisplayInner({ token, eventId }: { token?: string; eventId?: string }) {
  const { sessions, liveState: appState, connectionStatus, lastUpdatedAt, eventName, loading, accessError } = useDisplayView({
    token,
    eventId,
    displayType: "presenter",
  });
  const session = getSessionById(sessions, appState.activeSessionId);
  const { state: engine } = useDisplayEngine();

  const { offsetMs } = useTimeSync();
  const fullscreen = useFullscreen();

  // requestFullscreen() requires a real gesture on this device — a
  // Realtime command can't provide one, so useDisplayCommands' built-in
  // force-fullscreen handling (a tappable prompt) is what's needed here
  // too, same as every other display client.
  const { display, testMessage, fullscreenPrompt, dismissFullscreenPrompt } = useDisplayCommands(
    "Presenter Display",
    "presenter"
  );

  const live = session ? getLive(session, appState) : null;
  const next = session ? getNext(session, appState) : null;
  const { progress, isFinished } = deriveProgress(session, appState);
  // Phase 2 finding: in auto (queue-following) mode with nothing live, the
  // countdown/progress-bar chrome below used to render anyway — driven by
  // whatever the Display Engine's own leftover manual-timer state happened
  // to hold, not this session's real countdown — which could read as an
  // active count when nothing is actually live. Manual mode is exempt: an
  // operator who deliberately switched to it is running an intentional
  // ad-hoc timer unrelated to the queue, and that's the expected result,
  // not a gap to suppress.
  const showNotStarted = engine.timer.source === "auto" && !live;

  const autoInput = deriveAutoTimerInput(live, progress, appState.pausedAt);

  const timer = useDisplayTimer(engine.timer.source === "auto" ? autoInput : null, offsetMs);
  const clockLabel = useDisplayClock(offsetMs);

  useKeyboardShortcuts({
    f: () => fullscreen.toggle(),
    F: () => fullscreen.toggle(),
    Escape: () => {
      if (fullscreen.isFullscreen) void fullscreen.exit();
    },
  });

  const mode = engine.timer.mode;
  const color = TIMER_COLORS[timer.colorState];
  const stageStatus = deriveStageStatus(live, appState.pausedAt, engine.hold.active);

  // useDisplayView()'s first poll hasn't landed yet — without this,
  // `!live` reads identically to "not started," so a refresh briefly
  // showed "Not Started" for a show that's actually LIVE (confirmed live,
  // Phase 6B audit). Same distinction lib/use-sessions.ts's
  // useSessionsLoading() draws for Remote, just sourced from this poll
  // hook's own `loading` instead of a hasLoadedOnce flag.
  // F-10 (Phase 7B): checked ahead of `loading` — a revoked/expired link
  // discovered mid-poll is terminal, not a loading state. Same LinkInvalid
  // a fresh navigation to the same dead link already shows
  // (app/presenter/page.tsx).
  if (accessError) {
    return <LinkInvalid reason={accessError} />;
  }

  if (loading) {
    return (
      <DisplayShell connectionStatus={connectionStatus} lastUpdatedAt={lastUpdatedAt}>
        <LoadingState title="Loading…" />
      </DisplayShell>
    );
  }

  return (
    <DisplayShell connectionStatus={connectionStatus} lastUpdatedAt={lastUpdatedAt}>
      <HoldScreen hold={engine.hold} />
      {display && <BroadcastOverlay displayId={display.id} displayType="presenter" size="large" />}
      <TestMessageOverlay message={testMessage} />
      <FullscreenPrompt
        visible={fullscreenPrompt}
        onEnter={() => {
          void fullscreen.enter();
          dismissFullscreenPrompt();
        }}
        onDismiss={dismissFullscreenPrompt}
      />

      {!engine.hold.active && (
        <>
          {/* Ambient info — top row, only in information-dense modes */}
          {(mode === "program" || mode === "countdown" || mode === "count-up" || mode === "session") && (
            <div className="flex items-start justify-between flex-wrap gap-y-3">
              <div className="min-w-0">
                <p className="text-caption uppercase tracking-wide text-muted-2 truncate">
                  {eventName ?? "Kramflow"}
                  {session && ` · ${session.dayLabel} • ${session.sessionLabel}`}
                  {display?.room && ` · ${display.room}`}
                </p>
                {live?.kicker && <p className="text-subtitle text-muted mt-1">{live.kicker}</p>}
              </div>
              <div className="flex items-center gap-3">
                {appState.alert && <AlertBanner alert={appState.alert} compact />}
                <StageStatusPill status={stageStatus} />
              </div>
            </div>
          )}

          {/* Center content — mode-specific. The countdown is the hero: for
              every timer-bearing mode it's the single largest, most
              dominant element on screen (clamp caps around 400px tall),
              built for a speaker reading it at a glance from 10-20ft —
              not a ring the eye has to trace to interpret. */}
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            {mode === "clock" && (
              <p className="text-hero text-primary tabular-nums" style={{ fontSize: "clamp(3.5rem, 14vw, 13rem)" }}>
                {clockLabel}
              </p>
            )}

            {mode === "minimal" && (
              <p
                className="tabular-nums font-semibold leading-none"
                style={{ fontSize: countdownFontSize(timer.label, 4.5, 20, 22), color }}
              >
                {timer.label}
              </p>
            )}

            {(mode === "program" || mode === "countdown" || mode === "count-up" || mode === "session") && (
              <>
                {showNotStarted ? (
                  // Phase 2's named gap: showing manual-timer leftover
                  // chrome here used to look like a live count with nothing
                  // actually live behind it. State it plainly instead,
                  // matching AV/Green Room's existing "Not Started" /
                  // "Session Finished" copy — one family of empty states,
                  // not three independently-written ones.
                  <p
                    className="text-title text-muted-2"
                    style={{ fontSize: "clamp(3rem, 7vw, 6rem)" }}
                  >
                    {isFinished ? "Session Finished" : "Not Started"}
                  </p>
                ) : (
                  <>
                    <p
                      className="tabular-nums font-bold leading-none"
                      style={{
                        fontSize: countdownFontSize(
                          mode === "countdown" || mode === "program" ? timer.label : formatClock(timer.elapsedSeconds),
                          6,
                          24,
                          28
                        ),
                        color,
                      }}
                    >
                      {mode === "countdown" || mode === "program" ? timer.label : formatClock(timer.elapsedSeconds)}
                    </p>
                    <p className="text-subtitle uppercase tracking-wide text-muted-2 mt-4">
                      {mode === "countdown" || mode === "program"
                        ? timer.isOverrun
                          ? "over"
                          : "remaining"
                        : mode === "session"
                          ? "session elapsed"
                          : "elapsed"}
                    </p>

                    <div className="w-full max-w-2xl h-2.5 rounded-full bg-white/10 mt-8 overflow-hidden shrink-0">
                      <div
                        className="h-full rounded-full transition-[width] duration-500 ease-linear"
                        style={{ width: `${Math.round(Math.min(1, Math.max(0, timer.fraction)) * 100)}%`, backgroundColor: color }}
                      />
                    </div>
                  </>
                )}

                {live && (
                  <div className="mt-10">
                    <p className="text-title text-primary" style={{ fontSize: "clamp(2rem, 4vw, 3.25rem)" }}>
                      {live.title}
                    </p>
                    {live.presenter && <p className="text-subtitle text-muted mt-2">{live.presenter}</p>}
                  </div>
                )}

                {mode === "program" && next && (
                  <div className="mt-8 pt-6 border-t border-white/10">
                    <p className="text-caption uppercase tracking-wide text-muted-2">Next</p>
                    <p className="text-subtitle text-muted mt-1">{next.title}</p>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer — running order + session name, information-dense modes only */}
          {(mode === "program" || mode === "session") && session && (
            <div className="flex items-center justify-between text-caption text-muted-2 tabular-nums">
              <span>{session.dayLabel} • {session.sessionLabel}</span>
              <span>
                {progress?.currentOrder ?? 0} / {session.items.length}
              </span>
            </div>
          )}
        </>
      )}

    </DisplayShell>
  );
}
