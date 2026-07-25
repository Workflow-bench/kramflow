"use client";

import { useEventStore } from "@/lib/store";
import { useSessions } from "@/lib/use-sessions";
import { getSessionById } from "@/lib/data/sessions";
import { audioSummary, getLive, getNext, lightingSummary, videoSummary } from "@/lib/types";
import { useDisplayEngine } from "@/lib/display-engine/store";
import { useDisplayTimer, useDisplayClock } from "@/lib/display-engine/use-display-timer";
import { useRegisterDisplay } from "@/lib/display-engine/use-register-display";
import { useTimeSync } from "@/lib/display-engine/use-time-sync";
import { useFullscreen } from "@/lib/display-engine/use-fullscreen";
import { TIMER_COLORS } from "@/lib/display-engine/colors";
import { DisplayShell } from "@/components/display-engine/display-shell";
import { HoldScreen } from "@/components/display-engine/hold-screen";
import { BroadcastOverlay } from "@/components/display-engine/broadcast-overlay";
import { SessionTimeline } from "@/components/display-engine/session-timeline";
import { cn } from "@/lib/utils";

/**
 * AV Waiting Room Display — new Display Engine route, distinct from and
 * not replacing the existing /av page. Media/presentation/video/mic
 * status reuses the existing audioSummary/videoSummary/lightingSummary
 * helpers rather than duplicating that logic.
 */
export default function AvDisplayPage() {
  const { state: appState } = useEventStore();
  const sessions = useSessions();
  const session = getSessionById(sessions, appState.activeSessionId);
  const { state: engine } = useDisplayEngine();

  const { offsetMs } = useTimeSync();
  useFullscreen();

  const live = session ? getLive(session, appState) : null;
  const next = session ? getNext(session, appState) : null;
  const progress = session ? appState.progressBySession[appState.activeSessionId] : undefined;
  const currentOrder = progress?.currentOrder ?? null;
  const total = session?.items.length ?? 0;
  const isFinished = currentOrder !== null && currentOrder > total;

  const display = useRegisterDisplay("AV Waiting Room Display", "av", null, (command) => {
    if (command.type === "reload") window.location.reload();
  });

  const autoInput =
    live && live.type === "item"
      ? { durationMinutes: live.durationMinutes, startedAt: progress?.startedAt ?? null, pausedAt: appState.pausedAt }
      : null;
  const timer = useDisplayTimer(autoInput);
  const clockLabel = useDisplayClock(offsetMs);
  const color = TIMER_COLORS[timer.colorState];

  const cueTarget = next?.type === "item" ? next : live?.type === "item" ? live : null;
  const stageStatus = appState.pausedAt ? "PAUSED" : live ? "LIVE" : "STANDBY";

  return (
    <DisplayShell>
      <HoldScreen hold={engine.hold} />
      {display && <BroadcastOverlay displayId={display.id} displayType="av" />}

      {!engine.hold.active && (
        <>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-caption uppercase tracking-wide text-muted-2">
                {session ? `${session.dayLabel} • ${session.sessionLabel}` : "KramFlow"}
              </p>
              <p className="text-title text-primary mt-1">AV Waiting Room</p>
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

          {appState.alert && (
            <div
              className={cn(
                "mt-6 rounded-card px-6 py-4 text-body font-semibold",
                appState.alert.severity === "critical" && "bg-status-red/15 text-status-red",
                appState.alert.severity === "warning" && "bg-status-orange/15 text-status-orange",
                appState.alert.severity === "info" && "bg-status-blue/15 text-status-blue"
              )}
            >
              {appState.alert.message}
            </div>
          )}

          <div className="flex-1 grid grid-cols-[1.3fr_1fr] gap-16 min-h-0 mt-8">
            <div className="flex flex-col justify-center">
              <p className="text-caption uppercase tracking-wide text-muted-2">Current Cue</p>
              <p className="text-hero text-primary mt-3" style={{ fontSize: "clamp(2.75rem, 4.5vw, 4rem)" }}>
                {live ? live.title : isFinished ? "Session Finished" : "Not Started"}
              </p>
              <p
                className="tabular-nums font-semibold leading-none mt-6"
                style={{ fontSize: "clamp(3rem, 5vw, 4.5rem)", color }}
              >
                {timer.isOverrun ? `+${timer.label}` : timer.label}
              </p>
              <p className="text-caption uppercase tracking-wide text-muted-2 mt-2">cue countdown</p>

              {cueTarget && (
                <div className="mt-8 pt-6 border-t border-white/10">
                  <p className="text-caption uppercase tracking-wide text-muted-2">
                    Prep Requirements — {cueTarget.title}
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

            <div className="min-h-0 flex flex-col">
              <p className="text-caption uppercase tracking-wide text-muted-2 mb-2">Live Timeline</p>
              <div className="flex-1 overflow-y-auto rounded-card bg-card/50 px-6">
                {session && <SessionTimeline session={session} currentOrder={currentOrder} />}
              </div>
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
