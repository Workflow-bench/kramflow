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
import { useEventStore } from "@/lib/store";
import { useSessions } from "@/lib/use-sessions";
import { getSessionById } from "@/lib/data/sessions";
import { getLive, getNext } from "@/lib/types";
import { useDisplayEngine } from "@/lib/display-engine/store";
import { useDisplayTimer, useDisplayClock, formatClock } from "@/lib/display-engine/use-display-timer";
import { useRegisterDisplay } from "@/lib/display-engine/use-register-display";
import { useTimeSync } from "@/lib/display-engine/use-time-sync";
import { useFullscreen } from "@/lib/display-engine/use-fullscreen";
import { useKeyboardShortcuts } from "@/lib/display-engine/use-keyboard-shortcuts";
import { useIdleVisibility } from "@/lib/display-engine/use-idle-visibility";
import { TIMER_COLORS, TIMER_COLOR_LABELS } from "@/lib/display-engine/colors";
import { HOLD_PRESETS, type TimerMode } from "@/lib/display-engine/types";
import { DisplayShell } from "@/components/display-engine/display-shell";
import { HoldScreen } from "@/components/display-engine/hold-screen";
import { BroadcastOverlay } from "@/components/display-engine/broadcast-overlay";
import { TestMessageOverlay } from "@/components/display-engine/test-message-overlay";
import { FullscreenPrompt } from "@/components/display-engine/fullscreen-prompt";
import { useTestMessage } from "@/lib/display-engine/use-test-message";
import { AlertBanner } from "@/components/ui/alert-banner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";

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

export default function PresenterDisplayPage() {
  const { state: appState } = useEventStore();
  const sessions = useSessions();
  const session = getSessionById(sessions, appState.activeSessionId);
  const { state: engine, setTimerMode, setTimerSource, pauseTimer, resumeTimer, resetTimer, adjustTimer, activateHold, deactivateHold } =
    useDisplayEngine();

  const { offsetMs } = useTimeSync();
  const fullscreen = useFullscreen();
  const controlsVisible = useIdleVisibility(4000);
  const [holdPresetIndex, setHoldPresetIndex] = useState(0);
  const [confirmReset, setConfirmReset] = useState(false);

  const { testMessage, showTestMessage } = useTestMessage();
  const [fullscreenPrompt, setFullscreenPrompt] = useState(false);
  const display = useRegisterDisplay("Presenter Display", "presenter", null, (command) => {
    // requestFullscreen() requires a real gesture on this device — a
    // Realtime command can't provide one, so this shows a tappable prompt
    // instead of calling fullscreen.enter() directly (see
    // components/display-engine/fullscreen-prompt.tsx).
    if (command.type === "force-fullscreen") setFullscreenPrompt(true);
    if (command.type === "reload") window.location.reload();
    if (command.type === "test-message") showTestMessage(command.text, command.issuedAt);
  });

  const live = session ? getLive(session, appState) : null;
  const next = session ? getNext(session, appState) : null;
  const progress = session ? appState.progressBySession[appState.activeSessionId] : undefined;

  const autoInput =
    live && live.type === "item"
      ? { durationMinutes: live.durationMinutes, startedAt: progress?.startedAt ?? null, pausedAt: appState.pausedAt }
      : null;

  const timer = useDisplayTimer(engine.timer.source === "auto" ? autoInput : null);
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
    h: () => (engine.hold.active ? deactivateHold() : activateHold(holdPayload(HOLD_PRESETS[0]))),
    H: () => (engine.hold.active ? deactivateHold() : activateHold(holdPayload(HOLD_PRESETS[0]))),
    Escape: () => {
      if (fullscreen.isFullscreen) void fullscreen.exit();
    },
  });

  const mode = engine.timer.mode;
  const color = TIMER_COLORS[timer.colorState];
  const stageStatus = engine.hold.active ? "ON HOLD" : appState.pausedAt ? "PAUSED" : live ? "LIVE" : "STANDBY";

  return (
    <DisplayShell>
      <HoldScreen hold={engine.hold} />
      {display && <BroadcastOverlay displayId={display.id} displayType="presenter" size="large" />}
      <TestMessageOverlay message={testMessage} />
      <FullscreenPrompt
        visible={fullscreenPrompt}
        onEnter={() => {
          void fullscreen.enter();
          setFullscreenPrompt(false);
        }}
        onDismiss={() => setFullscreenPrompt(false)}
      />

      {!engine.hold.active && (
        <>
          {/* Ambient info — top row, only in information-dense modes */}
          {(mode === "program" || mode === "countdown" || mode === "count-up" || mode === "session") && (
            <div className="flex items-start justify-between flex-wrap gap-y-3">
              <div>
                <p className="text-caption uppercase tracking-wide text-muted-2">
                  {session ? `${session.dayLabel} • ${session.sessionLabel}` : "KramFlow"}
                </p>
                {live?.kicker && <p className="text-subtitle text-muted mt-1">{live.kicker}</p>}
              </div>
              <div className="flex items-center gap-3">
                {appState.alert && <AlertBanner alert={appState.alert} compact />}
                <span
                  className={cn(
                    "text-caption font-semibold uppercase tracking-wide px-3 py-1 rounded-full",
                    stageStatus === "LIVE" && "bg-status-green/15 text-status-green",
                    stageStatus === "ON HOLD" && "bg-status-orange/15 text-status-orange",
                    stageStatus === "PAUSED" && "bg-status-orange/15 text-status-orange",
                    stageStatus === "STANDBY" && "bg-white/5 text-muted-2"
                  )}
                >
                  {stageStatus}
                </span>
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
                style={{ fontSize: "clamp(8rem, 22vw, 20rem)", color }}
              >
                {timer.label}
              </p>
            )}

            {(mode === "program" || mode === "countdown" || mode === "count-up" || mode === "session") && (
              <>
                <p
                  className="tabular-nums font-bold leading-none"
                  style={{ fontSize: "clamp(9rem, 28vw, 24rem)", color }}
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
        <div className="flex items-center gap-2 rounded-full bg-card/95 backdrop-blur px-4 py-3 shadow-lg">
          <ControlButton onClick={() => adjustTimer(-60)} label="-1:00">
            <Minus className="h-4 w-4" strokeWidth={2} />
          </ControlButton>
          <ControlButton onClick={() => adjustTimer(-30)} label="-0:30">
            <Minus className="h-3.5 w-3.5" strokeWidth={2} />
          </ControlButton>
          <ControlButton onClick={() => (timer.isPaused ? resumeTimer() : pauseTimer())} label={timer.isPaused ? "Resume" : "Pause"} primary>
            {timer.isPaused ? <Play className="h-5 w-5" strokeWidth={2} /> : <Pause className="h-5 w-5" strokeWidth={2} />}
          </ControlButton>
          <ControlButton onClick={() => adjustTimer(30)} label="+0:30">
            <Plus className="h-3.5 w-3.5" strokeWidth={2} />
          </ControlButton>
          <ControlButton onClick={() => adjustTimer(60)} label="+1:00">
            <Plus className="h-4 w-4" strokeWidth={2} />
          </ControlButton>
          <ControlButton onClick={() => setConfirmReset(true)} label="Reset">
            <RotateCcw className="h-4 w-4" strokeWidth={2} />
          </ControlButton>

          <span className="w-px h-6 bg-white/10 mx-1" />

          <button
            type="button"
            onClick={() => setTimerSource(engine.timer.source === "auto" ? "manual" : "auto")}
            className="text-caption font-medium px-3 py-2 rounded-full bg-white/5 text-muted hover:text-primary cursor-pointer"
          >
            {engine.timer.source === "auto" ? "Auto-follow" : "Manual"}
          </button>

          <select
            value={mode}
            onChange={(e) => setTimerMode(e.target.value as TimerMode)}
            className="text-caption font-medium px-3 py-2 rounded-full bg-white/5 text-muted cursor-pointer outline-none"
            aria-label="Display mode"
          >
            {MODES.map((m) => (
              <option key={m.mode} value={m.mode}>
                {m.label}
              </option>
            ))}
          </select>

          <span className="w-px h-6 bg-white/10 mx-1" />

          <ControlButton
            onClick={() =>
              engine.hold.active
                ? deactivateHold()
                : activateHold(holdPayload(HOLD_PRESETS[holdPresetIndex]))
            }
            label="Hold"
            active={engine.hold.active}
          >
            <Radio className="h-4 w-4" strokeWidth={2} />
          </ControlButton>
          <select
            value={holdPresetIndex}
            onChange={(e) => setHoldPresetIndex(Number(e.target.value))}
            className="text-caption font-medium px-2 py-2 rounded-full bg-white/5 text-muted cursor-pointer outline-none"
            aria-label="Hold message preset"
          >
            {HOLD_PRESETS.map((preset, i) => (
              <option key={preset.label} value={i}>
                {preset.label}
              </option>
            ))}
          </select>

          <ControlButton onClick={fullscreen.toggle} label={fullscreen.isFullscreen ? "Exit fullscreen" : "Fullscreen"}>
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
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
  primary?: boolean;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "h-10 w-10 rounded-full flex items-center justify-center cursor-pointer transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        primary && "bg-primary text-background hover:bg-white/90",
        active && "bg-status-orange text-background",
        !primary && !active && "text-muted hover:text-primary hover:bg-white/5"
      )}
    >
      {children}
    </button>
  );
}
