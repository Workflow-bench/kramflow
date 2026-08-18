"use client";

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { useDisplayView } from "@/lib/use-display-view";
import { getSessionById } from "@/lib/data/sessions";
import { effectiveNotes, getLive, getNext, getOnDeck } from "@/lib/types";
import { useDisplayEngine } from "@/lib/display-engine/store";
import { DisplayEngineProvider } from "@/lib/display-engine/context";
import { useDisplayTimer, useDisplayClock } from "@/lib/display-engine/use-display-timer";
import { useRegisterDisplay } from "@/lib/display-engine/use-register-display";
import { useTimeSync } from "@/lib/display-engine/use-time-sync";
import { useFullscreen } from "@/lib/display-engine/use-fullscreen";
import { TIMER_COLORS } from "@/lib/display-engine/colors";
import { DisplayShell } from "@/components/display-engine/display-shell";
import { HoldScreen } from "@/components/display-engine/hold-screen";
import { BroadcastOverlay } from "@/components/display-engine/broadcast-overlay";
import { TestMessageOverlay } from "@/components/display-engine/test-message-overlay";
import { FullscreenPrompt } from "@/components/display-engine/fullscreen-prompt";
import { useTestMessage } from "@/lib/display-engine/use-test-message";
import { AlertBanner } from "@/components/ui/alert-banner";
import { cn } from "@/lib/utils";

/**
 * Green Room Display — new Display Engine route, distinct from and not
 * replacing the existing /green-room page. Fully read-only, matching the
 * "TV = zero controls" rule in docs/DESIGN_SYSTEM.md — the speaker-ready
 * toggle used to live here but is a real interaction, not a glance, so
 * it's now triggered from /remote instead (see
 * DisplayEngineState.speakerReady in lib/display-engine/types.ts); this
 * page only shows the resulting state.
 */
export default function GreenRoomDisplayClient({ token, eventId }: { token?: string; eventId?: string }) {
  return (
    <DisplayEngineProvider token={token} eventId={eventId}>
      <GreenRoomDisplayInner token={token} eventId={eventId} />
    </DisplayEngineProvider>
  );
}

function GreenRoomDisplayInner({ token, eventId }: { token?: string; eventId?: string }) {
  const { sessions, liveState: appState } = useDisplayView({ token, eventId });
  const session = getSessionById(sessions, appState.activeSessionId);
  const { state: engine } = useDisplayEngine();

  const { offsetMs } = useTimeSync();
  const fullscreen = useFullscreen();

  const live = session ? getLive(session, appState) : null;
  const next = session ? getNext(session, appState) : null;
  const onDeck = session ? getOnDeck(session, appState) : null;
  const progress = session ? appState.progressBySession[appState.activeSessionId] : undefined;
  const total = session?.items.length ?? 0;
  const currentOrder = progress?.currentOrder ?? null;
  const isFinished = currentOrder !== null && currentOrder > total;

  const { testMessage, showTestMessage } = useTestMessage();
  const [fullscreenPrompt, setFullscreenPrompt] = useState(false);
  const display = useRegisterDisplay("Green Room Display", "green-room", null, (command) => {
    if (command.type === "reload") window.location.reload();
    if (command.type === "test-message") showTestMessage(command.text, command.issuedAt);
    if (command.type === "force-fullscreen") setFullscreenPrompt(true);
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
          <div className="flex items-start justify-between flex-wrap gap-y-3">
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

          {appState.alert && <AlertBanner alert={appState.alert} className="mt-6" />}

          <div className="flex-1 grid grid-cols-[1.4fr_1fr] gap-16 min-h-0 mt-8 overflow-y-auto">
            {/* justify-start, not -center: centering doesn't clip — content
                taller than this cell bled equally up *and down* past it,
                which is what actually caused the "Queue Position" row below
                to visually overlap the countdown at a short viewport
                (QA_REPORT_ROUND2.md R2-BUG-4), not the outer shell's own
                justify-between (already fixed separately). Top-aligning
                this cell means it can only overflow downward, where the
                page already scrolls, instead of in both directions. */}
            <div className="min-h-0 flex flex-col justify-start">
              <p className="text-caption uppercase tracking-wide text-muted-2">On Stage Now</p>
              <p className="text-hero text-primary mt-3" style={{ fontSize: "clamp(3rem, 5vw, 4.5rem)" }}>
                {live ? live.title : isFinished ? "Session Finished" : "Not Started"}
              </p>
              {live?.presenter && <p className="text-title text-muted mt-3">{live.presenter}</p>}
              {!isFinished && (
                <>
                  {/* QA_REPORT_ROUND2.md R2-BUG-6: this used to render
                      unconditionally, so once a session finished (live ===
                      null, autoInput === null) it fell back to the Display
                      Engine's own separate manual-timer state — an unrelated
                      leftover value (its schema default is 5:00), not the
                      real last countdown — directly contradicting the
                      "Session Finished" headline above it. Suppressing it
                      when finished is correct rather than trying to freeze
                      or relabel a value that was never actually this
                      session's countdown to begin with. */}
                  <p
                    className="tabular-nums font-semibold leading-none mt-8"
                    style={{ fontSize: "clamp(3.5rem, 6vw, 5.5rem)", color }}
                  >
                    {timer.isOverrun ? `+${timer.label}` : timer.label}
                  </p>
                  <p className="text-caption uppercase tracking-wide text-muted-2 mt-2">
                    {timer.isOverrun ? "over — countdown until called" : "remaining — countdown until called"}
                  </p>
                </>
              )}

              {live && (
                <div className="mt-8 pt-6 border-t border-white/10 max-w-lg">
                  <p className="text-caption uppercase tracking-wide text-muted-2">Operator Notes</p>
                  <p className="text-body text-muted mt-2">{effectiveNotes(appState, live) || "No notes"}</p>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-6 justify-center">
              {next && (
                // The one cue Green Room's audience cares about most (P2
                // §4) gets the display family's one environmental-color
                // treatment — a status hue escalated from a badge to
                // background wash, not just here for decoration. General
                // and AV keep status confined to badges/dots throughout;
                // this is the single deliberate exception, reserved for
                // exactly this cue.
                <div className="rounded-card bg-status-orange/8 p-8">
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

                  {nextReady && (
                    <div
                      className={cn(
                        "mt-6 w-full flex items-center justify-center gap-3 rounded-full px-6 py-4 text-body font-semibold",
                        "bg-status-green/15 text-status-green"
                      )}
                    >
                      <CheckCircle2 className="h-5 w-5" strokeWidth={2} />
                      Speaker Ready
                    </div>
                  )}
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
            <div className="flex items-center justify-between text-caption text-muted-2 tabular-nums mt-auto pt-6">
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
