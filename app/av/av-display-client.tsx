"use client";

import { useDisplayView } from "@/lib/use-display-view";
import { getSessionById } from "@/lib/data/sessions";
import { audioSummary, getLive, getNext, getOnDeck, lightingSummary, videoSummary } from "@/lib/types";
import { useDisplayEngine } from "@/lib/display-engine/store";
import { DisplayEngineProvider } from "@/lib/display-engine/context";
import { useDisplayTimer, useDisplayClock } from "@/lib/display-engine/use-display-timer";
import { useDisplayCommands } from "@/lib/display-engine/use-display-commands";
import { deriveProgress, deriveAutoTimerInput, deriveStageStatus } from "@/lib/display-engine/live-progress";
import { useTimeSync } from "@/lib/display-engine/use-time-sync";
import { useFullscreen } from "@/lib/display-engine/use-fullscreen";
import { TIMER_COLORS } from "@/lib/display-engine/colors";
import { DisplayShell } from "@/components/display-engine/display-shell";
import { HoldScreen } from "@/components/display-engine/hold-screen";
import { BroadcastOverlay } from "@/components/display-engine/broadcast-overlay";
import { TestMessageOverlay } from "@/components/display-engine/test-message-overlay";
import { FullscreenPrompt } from "@/components/display-engine/fullscreen-prompt";
import { DisplayHeader } from "@/components/display-engine/display-header";
import { AlertBanner } from "@/components/ui/alert-banner";

/**
 * AV Waiting Room Display — new Display Engine route, distinct from and
 * not replacing the existing /av page. Media/presentation/video/mic
 * status reuses the existing audioSummary/videoSummary/lightingSummary
 * helpers rather than duplicating that logic.
 */
export default function AvDisplayClient({ token, eventId }: { token?: string; eventId?: string }) {
  return (
    <DisplayEngineProvider token={token} eventId={eventId} displayType="av">
      <AvDisplayInner token={token} eventId={eventId} />
    </DisplayEngineProvider>
  );
}

function AvDisplayInner({ token, eventId }: { token?: string; eventId?: string }) {
  const { sessions, liveState: appState, connectionStatus, lastUpdatedAt, eventName } = useDisplayView({
    token,
    eventId,
    displayType: "av",
  });
  const session = getSessionById(sessions, appState.activeSessionId);
  const { state: engine } = useDisplayEngine();

  const { offsetMs } = useTimeSync();
  const fullscreen = useFullscreen();

  const live = session ? getLive(session, appState) : null;
  const next = session ? getNext(session, appState) : null;
  const onDeck = session ? getOnDeck(session, appState) : null;
  const { progress, isFinished } = deriveProgress(session, appState);

  const { display, testMessage, fullscreenPrompt, dismissFullscreenPrompt } = useDisplayCommands(
    "AV Waiting Room Display",
    "av"
  );

  const autoInput = deriveAutoTimerInput(live, progress, appState.pausedAt);
  const timer = useDisplayTimer(autoInput, offsetMs);
  const clockLabel = useDisplayClock(offsetMs);
  const color = TIMER_COLORS[timer.colorState];

  const cueTarget = next?.type === "item" ? next : live?.type === "item" ? live : null;
  const stageStatus = deriveStageStatus(live, appState.pausedAt);

  return (
    <DisplayShell connectionStatus={connectionStatus} lastUpdatedAt={lastUpdatedAt}>
      <HoldScreen hold={engine.hold} />
      {display && <BroadcastOverlay displayId={display.id} displayType="av" />}
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
          <DisplayHeader
            title="AV Waiting Room"
            eventName={eventName}
            room={display?.room}
            session={session}
            clockLabel={clockLabel}
            stageStatus={stageStatus}
          />

          {appState.alert && <AlertBanner alert={appState.alert} className="mt-6" />}

          <div className="flex-1 grid grid-cols-[1.3fr_1fr] gap-16 min-h-0 mt-8 overflow-y-auto">
            <div className="flex flex-col justify-center">
              <p className="text-caption uppercase tracking-wide text-muted-2">Current Cue</p>
              <p className="text-hero text-primary mt-3" style={{ fontSize: "clamp(2.75rem, 4.5vw, 4rem)" }}>
                {live ? live.title : isFinished ? "Session Finished" : "Not Started"}
              </p>
              {!isFinished && (
                <>
                  {/* Same pattern as Green Room: once finished, autoInput is null and this would
                      otherwise fall back to the Display Engine's unrelated
                      manual-timer state instead of blanking. */}
                  <p
                    className="tabular-nums font-semibold leading-none mt-6"
                    style={{ fontSize: "clamp(3rem, 5vw, 4.5rem)", color }}
                  >
                    {timer.isOverrun ? `+${timer.label}` : timer.label}
                  </p>
                  <p className="text-caption uppercase tracking-wide text-muted-2 mt-2">cue countdown</p>
                </>
              )}

              {cueTarget && (
                <div className="mt-8 pt-6 border-t border-white/10">
                  <p className="text-caption uppercase tracking-wide text-muted-2">
                    Prep Requirements: {cueTarget.title}
                  </p>
                  <div className="mt-3 divide-y divide-white/5">
                    <RequirementRow label="Microphone / Track" value={audioSummary(cueTarget.audio)} />
                    <RequirementRow label="Video / Presentation" value={videoSummary(cueTarget.video)} />
                    <RequirementRow label="Lighting" value={lightingSummary(cueTarget.lights) ?? "None"} />
                    {cueTarget.cameraAngle && <RequirementRow label="Camera Angle" value={cueTarget.cameraAngle} />}
                    {cueTarget.curtains && (
                      <RequirementRow label="Curtains" value={cueTarget.curtains === "open" ? "Open" : "Closed"} />
                    )}
                  </div>
                  {cueTarget.stageNotes && (
                    <div className="mt-4">
                      <p className="text-caption uppercase tracking-wide text-muted-2">Operator Notes</p>
                      <p className="text-body text-muted mt-1">{cueTarget.stageNotes}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="min-h-0 flex flex-col justify-center gap-6">
              {next && (
                <div className="rounded-card bg-card/50 px-6 py-5">
                  <div className="flex items-center justify-between">
                    {/* A break needs no AV prep — "Please Prepare" framing on
                        a breakfast break read as a false instruction to the
                        crew. Neutral "Next" for a break, the real prep
                        prompt only for an actual item. */}
                    <p className="text-caption uppercase tracking-wide text-muted-2">
                      {next.type === "item" ? "Next: Please Prepare" : "Next"}
                    </p>
                    {next.scheduledStart && (
                      <span className="text-caption text-muted-2 tabular-nums">{next.scheduledStart}</span>
                    )}
                  </div>
                  <p className="text-subtitle text-primary mt-3">{next.title}</p>
                  {next.presenter && <p className="text-body text-muted mt-2">{next.presenter}</p>}
                </div>
              )}

              {onDeck && (
                <div className="rounded-card bg-card/50 px-6 py-5">
                  <p className="text-caption uppercase tracking-wide text-muted-2">On Deck</p>
                  <p className="text-body text-muted mt-2">{onDeck.title}</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </DisplayShell>
  );
}

function RequirementRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-3">
      <span className="text-body text-muted">{label}</span>
      <span className="text-body text-primary font-medium">{value}</span>
    </div>
  );
}
