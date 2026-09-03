"use client";

import { useState } from "react";
import {
  Maximize,
  Minimize,
  Minus,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Radio,
} from "lucide-react";
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
import { useIdleVisibility } from "@/lib/display-engine/use-idle-visibility";
import { TIMER_COLORS, TIMER_COLOR_LABELS } from "@/lib/display-engine/colors";
import { HOLD_PRESETS, type TimerMode } from "@/lib/display-engine/types";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { DisplayShell } from "@/components/display-engine/display-shell";
import { HoldScreen } from "@/components/display-engine/hold-screen";
import { BroadcastOverlay } from "@/components/display-engine/broadcast-overlay";
import { TestMessageOverlay } from "@/components/display-engine/test-message-overlay";
import { FullscreenPrompt } from "@/components/display-engine/fullscreen-prompt";
import { StageStatusPill } from "@/components/display-engine/stage-status-pill";
import { AlertBanner } from "@/components/ui/alert-banner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";

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
function countdownFontSize(text: string, minRem: number, maxRem: number, baseVw: number): string {
  const chars = Math.max(text.length, 5);
  const vw = Math.min(baseVw, Math.round(((baseVw * 5) / chars) * 10) / 10);
  return `clamp(${minRem}rem, ${vw}vw, ${maxRem}rem)`;
}

const MODES: { mode: TimerMode; label: string }[] = [
  { mode: "program", label: "Program" },
  { mode: "countdown", label: "Countdown" },
  { mode: "count-up", label: "Count-up" },
  { mode: "session", label: "Session" },
  { mode: "minimal", label: "Minimal" },
  { mode: "clock", label: "Clock" },
];

// HOLD_PRESETS entries carry a `label` for the picker UI that isn't part of
// HoldState — pick only the fields activateHold() actually declares rather
// than spreading the whole preset, so `label` doesn't leak into persisted state.
function holdPayload(preset: (typeof HOLD_PRESETS)[number]) {
  return { message: preset.message, subMessage: preset.subMessage, continueClock: false };
}

export default function PresenterDisplayClient({ token, eventId }: { token?: string; eventId?: string }) {
  return (
    <DisplayEngineProvider token={token} eventId={eventId} displayType="presenter">
      <PresenterDisplayInner token={token} eventId={eventId} />
    </DisplayEngineProvider>
  );
}

function PresenterDisplayInner({ token, eventId }: { token?: string; eventId?: string }) {
  const { sessions, liveState: appState, connectionStatus, lastUpdatedAt, eventName } = useDisplayView({
    token,
    eventId,
    displayType: "presenter",
  });
  const session = getSessionById(sessions, appState.activeSessionId);
  const { state: engine, setTimerMode, setTimerSource, pauseTimer, resumeTimer, resetTimer, adjustTimer, activateHold, deactivateHold } =
    useDisplayEngine();

  const { offsetMs } = useTimeSync();
  const fullscreen = useFullscreen();
  const controlsVisible = useIdleVisibility(4000);
  const [holdPresetIndex, setHoldPresetIndex] = useState(0);
  const [confirmReset, setConfirmReset] = useState(false);

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
    Space: () => (timer.isPaused ? resumeTimer() : pauseTimer()),
    "+": () => adjustTimer(30),
    "=": () => adjustTimer(30),
    "-": () => adjustTimer(-30),
    r: () => setConfirmReset(true),
    R: () => setConfirmReset(true),
    f: () => fullscreen.toggle(),
    F: () => fullscreen.toggle(),
    h: () => (engine.hold.active ? deactivateHold() : activateHold(holdPayload(HOLD_PRESETS[holdPresetIndex]))),
    H: () => (engine.hold.active ? deactivateHold() : activateHold(holdPayload(HOLD_PRESETS[holdPresetIndex]))),
    Escape: () => {
      if (fullscreen.isFullscreen) void fullscreen.exit();
    },
  });

  const mode = engine.timer.mode;
  const color = TIMER_COLORS[timer.colorState];
  const stageStatus = deriveStageStatus(live, appState.pausedAt, engine.hold.active);

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
              <p className="text-hero text-primary tabular-nums" style={{ fontSize: "clamp(6rem, 14vw, 13rem)" }}>
                {clockLabel}
              </p>
            )}

            {mode === "minimal" && (
              <p
                className="tabular-nums font-semibold leading-none"
                style={{ fontSize: countdownFontSize(timer.label, 8, 20, 22), color }}
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
                          9,
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

      {/* Auto-hiding control bar — the presenter never sees this at rest.
          Deliberately NOT pointer-events-none while faded: a click/tap that
          lands in this zone right as the idle-hide kicks in (or a touch tap
          that fires its click before the mousemove/touchstart reveal state
          has re-rendered) would otherwise land on a non-interactive element
          and silently do nothing — no error, control just doesn't respond.
          Nothing else occupies this screen region, so leaving it clickable
          while invisible costs nothing. */}
      {/* z-45: above HoldScreen (z-40) so the presenter can still reach the
          Hold toggle to release it — Presenter is the only display where a
          human locally controls Hold, so this is the one place the control
          bar needs to survive its own takeover screen. Still below
          emergency broadcasts (z-50), which are meant to interrupt even
          Hold. The other four Display Engine surfaces never render this
          control bar at all, so Hold there stays exclusively
          operator-controlled, as intended. */}
      <div
        className={cn(
          "fixed bottom-0 left-0 right-0 z-[45] flex items-center justify-center gap-3 p-6 transition-opacity duration-300",
          controlsVisible ? "opacity-100" : "opacity-0"
        )}
      >
        {/* Every control below gets tabIndex={-1} while faded, on top of
            the existing opacity fade — pointer/touch reachability while
            fading is deliberately unchanged (see the comment above this
            block), but a keyboard user tabbing through the page has no way
            to see *where* focus is once these are invisible, and could
            trigger a live Hold/timer mutation blind (2026-09-01 audit,
            KF-003 / P0 finding #3). tabIndex alone doesn't affect pointer
            events, so the "still tappable mid-fade" behavior survives
            untouched — only Tab-reachability changes. */}
        <div className="flex items-center gap-2 rounded-full bg-card/95 backdrop-blur px-4 py-3 shadow-lg">
          <ControlButton onClick={() => adjustTimer(-60)} label="-1:00" tabIndex={controlsVisible ? undefined : -1}>
            <Minus className="h-4 w-4" strokeWidth={2} />
          </ControlButton>
          <ControlButton onClick={() => adjustTimer(-30)} label="-0:30" tabIndex={controlsVisible ? undefined : -1}>
            <Minus className="h-3.5 w-3.5" strokeWidth={2} />
          </ControlButton>
          <ControlButton
            onClick={() => (timer.isPaused ? resumeTimer() : pauseTimer())}
            label={timer.isPaused ? "Resume" : "Pause"}
            primary
            tabIndex={controlsVisible ? undefined : -1}
          >
            {timer.isPaused ? <Play className="h-5 w-5" strokeWidth={2} /> : <Pause className="h-5 w-5" strokeWidth={2} />}
          </ControlButton>
          <ControlButton onClick={() => adjustTimer(30)} label="+0:30" tabIndex={controlsVisible ? undefined : -1}>
            <Plus className="h-3.5 w-3.5" strokeWidth={2} />
          </ControlButton>
          <ControlButton onClick={() => adjustTimer(60)} label="+1:00" tabIndex={controlsVisible ? undefined : -1}>
            <Plus className="h-4 w-4" strokeWidth={2} />
          </ControlButton>
          <ControlButton onClick={() => setConfirmReset(true)} label="Reset" tabIndex={controlsVisible ? undefined : -1}>
            <RotateCcw className="h-4 w-4" strokeWidth={2} />
          </ControlButton>

          <span className="w-px h-6 bg-white/10 mx-1" />

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setTimerSource(engine.timer.source === "auto" ? "manual" : "auto")}
            className="rounded-full bg-white/5 hover:bg-white/10"
            tabIndex={controlsVisible ? undefined : -1}
          >
            {engine.timer.source === "auto" ? "Auto-follow" : "Manual"}
          </Button>

          <Select
            value={mode}
            onChange={(v) => setTimerMode(v as TimerMode)}
            options={MODES.map((m) => ({ value: m.mode, label: m.label }))}
            searchable={false}
            aria-label="Display mode"
            className="w-auto min-w-[7rem]"
            tabIndex={controlsVisible ? undefined : -1}
          />

          <span className="w-px h-6 bg-white/10 mx-1" />

          <ControlButton
            onClick={() =>
              engine.hold.active
                ? deactivateHold()
                : activateHold(holdPayload(HOLD_PRESETS[holdPresetIndex]))
            }
            label="Hold"
            active={engine.hold.active}
            tabIndex={controlsVisible ? undefined : -1}
          >
            <Radio className="h-4 w-4" strokeWidth={2} />
          </ControlButton>
          <Select
            value={String(holdPresetIndex)}
            onChange={(v) => setHoldPresetIndex(Number(v))}
            options={HOLD_PRESETS.map((preset, i) => ({ value: String(i), label: preset.label }))}
            searchable={false}
            aria-label="Hold message preset"
            className="w-auto min-w-[9rem]"
            tabIndex={controlsVisible ? undefined : -1}
          />

          <ControlButton
            onClick={fullscreen.toggle}
            label={fullscreen.isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            tabIndex={controlsVisible ? undefined : -1}
          >
            {fullscreen.isFullscreen ? <Minimize className="h-4 w-4" strokeWidth={2} /> : <Maximize className="h-4 w-4" strokeWidth={2} />}
          </ControlButton>

          <span
            className="h-2 w-2 rounded-full shrink-0 ml-1"
            style={{ backgroundColor: color }}
            title={TIMER_COLOR_LABELS[timer.colorState]}
          />
        </div>
      </div>

      <ConfirmDialog
        open={confirmReset}
        title="Reset the timer?"
        description="This zeroes the current progress — it can't be undone."
        confirmLabel="Reset"
        tone="danger"
        onConfirm={() => {
          resetTimer();
          setConfirmReset(false);
        }}
        onCancel={() => setConfirmReset(false)}
      />
    </DisplayShell>
  );
}

function ControlButton({
  children,
  onClick,
  label,
  primary,
  active,
  tabIndex,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
  primary?: boolean;
  active?: boolean;
  tabIndex?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      tabIndex={tabIndex}
      aria-label={label}
      title={label}
      className={cn(
        "h-10 w-10 rounded-full flex items-center justify-center cursor-pointer transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        primary && "bg-primary text-background hover:bg-white/90",
        active && "bg-status-orange text-background",
        !primary && !active && "text-muted hover:text-primary hover:bg-white/5"
      )}
    >
      {children}
    </button>
  );
}
