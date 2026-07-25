"use client";

import { CheckCircle2, Circle } from "lucide-react";
import { useEventStore } from "@/lib/store";
import { useSessions } from "@/lib/use-sessions";
import { getSessionById } from "@/lib/data/sessions";
import { effectiveNotes, getLive, getNext, getOnDeck } from "@/lib/types";
import { useDisplayEngine } from "@/lib/display-engine/store";
import { useDisplayTimer, useDisplayClock } from "@/lib/display-engine/use-display-timer";
import { useRegisterDisplay } from "@/lib/display-engine/use-register-display";
import { useTimeSync } from "@/lib/display-engine/use-time-sync";
import { useFullscreen } from "@/lib/display-engine/use-fullscreen";
import { TIMER_COLORS } from "@/lib/display-engine/colors";
import { DisplayShell } from "@/components/display-engine/display-shell";
import { HoldScreen } from "@/components/display-engine/hold-screen";
import { BroadcastOverlay } from "@/components/display-engine/broadcast-overlay";
import { cn } from "@/lib/utils";

/**
 * Green Room Display — new Display Engine route, distinct from and not
 * replacing the existing /green-room page. Read-only except for the
 * speaker-ready toggle, which is genuinely new information (see
 * DisplayEngineState.speakerReady in lib/display-engine/types.ts).
 */
export default function GreenRoomDisplayPage() {
  const { state: appState } = useEventStore();
  const sessions = useSessions();
  const session = getSessionById(sessions, appState.activeSessionId);
  const { state: engine, setSpeakerReady } = useDisplayEngine();

  const { offsetMs } = useTimeSync();
  useFullscreen();

  const live = session ? getLive(session, appState) : null;
  const next = session ? getNext(session, appState) : null;
  const onDeck = session ? getOnDeck(session, appState) : null;
  const progress = session ? appState.progressBySession[appState.activeSessionId] : undefined;
  const total = session?.items.length ?? 0;
  const currentOrder = progress?.currentOrder ?? null;
  const isFinished = currentOrder !== null && currentOrder > total;

  const display = useRegisterDisplay("Green Room Display", "green-room", null, (command) => {
    if (command.type === "reload") window.location.reload();
  });

  const autoInput =
    live && live.type === "item"
      ? { durationMinutes: live.durationMinutes, startedAt: progress?.startedAt ?? null, pausedAt: appState.pausedAt }
      : null;
  const timer = useDisplayTimer(autoInput);
  const clockLabel = useDisplayClock(offsetMs);
  const color = TIMER_COLORS[timer.colorState];

  const stageStatus = appState.pausedAt ? "PAUSED" : live ? "LIVE" : "STANDBY";
  const nextReady = next ? Boolean(engine.speakerReady[next.id]) : false;

  return (
    <DisplayShell>
      <HoldScreen hold={engine.hold} />
      {display && <BroadcastOverlay displayId={display.id} displayType="green-room" />}

      {!engine.hold.active && (
        <>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-caption uppercase tracking-wide text-muted-2">
                {session ? `${session.dayLabel} • ${session.sessionLabel}` : "KramFlow"}
              </p>
              <p className="text-title text-primary mt-1">Green Room</p>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-hero tabular-nums text-muted" style={{ fontSize: "clamp(2rem, 3vw, 3rem)" }}>
                {clockLabel}
              </span>
              <span
                className={cn(
                  "text-caption font-semibold uppercase tracking-wide px-3 py-1 rounded-full",
                  stageStatus === "LIVE" && "bg-status-green/15 text-status-green",
                  stageStatus === "PAUSED" && "bg-status-orange/15 text-status-orange",
                  stageStatus === "STANDBY" && "bg-white/5 text-muted-2"
                )}
              >
                {stageStatus}
              </span>
            </div>
          </div>

          <div className="flex-1 grid grid-cols-[1.4fr_1fr] gap-16 min-h-0 mt-8">
            <div className="flex flex-col justify-center">
              <p className="text-caption uppercase tracking-wide text-muted-2">On Stage Now</p>
              <p className="text-hero text-primary mt-3" style={{ fontSize: "clamp(3rem, 5vw, 4.5rem)" }}>
                {live ? live.title : isFinished ? "Session Finished" : "Not Started"}
              </p>
              {live?.presenter && <p className="text-title text-muted mt-3">{live.presenter}</p>}
              <p
                className="tabular-nums font-semibold leading-none mt-8"
                style={{ fontSize: "clamp(3.5rem, 6vw, 5.5rem)", color }}
              >
                {timer.isOverrun ? `+${timer.label}` : timer.label}
              </p>
              <p className="text-caption uppercase tracking-wide text-muted-2 mt-2">
                {timer.isOverrun ? "over — countdown until called" : "remaining — countdown until called"}
              </p>

              {live && (
                <div className="mt-8 pt-6 border-t border-white/10 max-w-lg">
                  <p className="text-caption uppercase tracking-wide text-muted-2">Operator Notes</p>
                  <p className="text-body text-muted mt-2">{effectiveNotes(appState, live) || "No notes"}</p>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-6 justify-center">
              {next && (
                <div className="rounded-card bg-card p-8">
                  <div className="flex items-center justify-between">
                    <p className="text-caption uppercase tracking-wide text-muted-2">Next — Please Prepare</p>
                    <span className="text-caption text-muted-2 tabular-nums">
                      {next.scheduledStart ?? "Expected time TBD"}
                    </span>
                  </div>
                  <p className="text-subtitle text-primary mt-3">{next.title}</p>
                  {next.presenter && (
                    <p className="text-body text-muted mt-2">
                      {next.presenter}
                      {next.presenterContact && <span className="text-muted-2"> · {next.presenterContact}</span>}
                    </p>
                  )}

                  <button
                    type="button"
                    onClick={() => setSpeakerReady(next.id, !nextReady)}
                    className={cn(
                      "mt-6 w-full flex items-center justify-center gap-3 rounded-full px-6 py-4 text-body font-semibold cursor-pointer transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                      nextReady ? "bg-status-green/15 text-status-green" : "bg-white/5 text-muted hover:text-primary"
                    )}
                  >
                    {nextReady ? <CheckCircle2 className="h-5 w-5" strokeWidth={2} /> : <Circle className="h-5 w-5" strokeWidth={2} />}
                    {nextReady ? "Speaker Ready" : "Mark Speaker Ready"}
                  </button>
                </div>
              )}

              {next?.props && (
                <div className="rounded-card bg-card/50 p-6">
                  <p className="text-caption uppercase tracking-wide text-muted-2">Props — {next.title}</p>
                  <p className="text-body text-primary mt-2">{next.props}</p>
                </div>
              )}

              {onDeck && (
                <div className="rounded-card bg-card/50 p-6">
                  <p className="text-caption uppercase tracking-wide text-muted-2">On Deck</p>
                  <p className="text-body text-muted mt-2">{onDeck.title}</p>
                  {onDeck.presenter && <p className="text-caption text-muted-2 mt-1">{onDeck.presenter}</p>}
                </div>
              )}
            </div>
          </div>

          {session && (
            <div className="flex items-center justify-between text-caption text-muted-2 tabular-nums mt-6">
              <span>Queue Position</span>
              <span>
                {Math.min(currentOrder ?? 0, total)} / {total}
              </span>
            </div>
          )}
        </>
      )}
    </DisplayShell>
  );
}
