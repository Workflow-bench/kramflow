"use client";

import { useEffect, useState } from "react";
import { useDisplayView } from "@/lib/use-display-view";
import { getSessionById } from "@/lib/data/sessions";
import { getLive, getNext, getOnDeck } from "@/lib/types";
import { useDisplayEngine } from "@/lib/display-engine/store";
import { DisplayEngineProvider } from "@/lib/display-engine/context";
import { useDisplayClock, formatClock } from "@/lib/display-engine/use-display-timer";
import { useRegisterDisplay } from "@/lib/display-engine/use-register-display";
import { useTimeSync, syncedNow } from "@/lib/display-engine/use-time-sync";
import { useFullscreen } from "@/lib/display-engine/use-fullscreen";
import { DisplayShell } from "@/components/display-engine/display-shell";
import { HoldScreen } from "@/components/display-engine/hold-screen";
import { BroadcastOverlay } from "@/components/display-engine/broadcast-overlay";
import { TestMessageOverlay } from "@/components/display-engine/test-message-overlay";
import { FullscreenPrompt } from "@/components/display-engine/fullscreen-prompt";
import { useTestMessage } from "@/lib/display-engine/use-test-message";
import { AlertBanner } from "@/components/ui/alert-banner";

/**
 * General Display — public, audience-facing, no operator controls. The
 * generic, no-department-specific screen (formerly "Lobby"). "Sponsor
 * Slides" / "Directional Information" are intentionally scoped down to a
 * static content section rather than a full slide-management system — see
 * docs/DISPLAY_ENGINE.md for the documented simplification.
 */

/**
 * Program.scheduledStart is a pre-formatted display string from the cue
 * sheet ("5:00 PM"), not an ISO timestamp — `new Date(...)` can't parse it.
 * Parsed against today's date, which is safe for a live-event display that
 * only ever runs on the actual event day.
 */
function parseTimeToday(label: string, nowMs: number): number | null {
  const match = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(label.trim());
  if (!match) return null;
  let hours = Number(match[1]) % 12;
  if (/pm/i.test(match[3])) hours += 12;
  const minutes = Number(match[2]);
  const now = new Date(nowMs);
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0, 0).getTime();
}
export default function GeneralDisplayClient({ token, eventId }: { token?: string; eventId?: string }) {
  return (
    <DisplayEngineProvider token={token} eventId={eventId}>
      <GeneralDisplayInner token={token} eventId={eventId} />
    </DisplayEngineProvider>
  );
}

function GeneralDisplayInner({ token, eventId }: { token?: string; eventId?: string }) {
  const { sessions, liveState: appState, connectionStatus, lastUpdatedAt } = useDisplayView({ token, eventId });
  const session = getSessionById(sessions, appState.activeSessionId);
  const { state: engine } = useDisplayEngine();

  const { offsetMs } = useTimeSync();
  const fullscreen = useFullscreen();

  const live = session ? getLive(session, appState) : null;
  const next = session ? getNext(session, appState) : null;
  const onDeck = session ? getOnDeck(session, appState) : null;
  // session.eventName is the operator-set "Display title (optional)" field
  // (SessionForm) — a per-session headline for this specific display, not
  // the account-level event name. Optional, so it's fine to omit rather
  // than show a blank line.
  const eventName = session?.eventName?.trim() || null;

  const { testMessage, showTestMessage } = useTestMessage();
  const [fullscreenPrompt, setFullscreenPrompt] = useState(false);
  const display = useRegisterDisplay("General Display", "general", null, (command) => {
    if (command.type === "reload") window.location.reload();
    if (command.type === "test-message") showTestMessage(command.text, command.issuedAt);
    if (command.type === "force-fullscreen") setFullscreenPrompt(true);
  });

  const clockLabel = useDisplayClock(offsetMs);
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const nextTargetMs = next?.scheduledStart && now !== null ? parseTimeToday(next.scheduledStart, now) : null;
  const countdownToNext =
    nextTargetMs !== null ? Math.max(0, Math.round((nextTargetMs - syncedNow(offsetMs)) / 1000)) : null;

  return (
    <DisplayShell wakeLockEnabled connectionStatus={connectionStatus} lastUpdatedAt={lastUpdatedAt}>
      <HoldScreen hold={engine.hold} />
      {display && <BroadcastOverlay displayId={display.id} displayType="general" />}
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
              {eventName && <p className="text-title text-primary mt-1">{eventName}</p>}
            </div>
            <span className="text-hero tabular-nums text-muted" style={{ fontSize: "clamp(2rem, 3vw, 3rem)" }}>
              {clockLabel}
            </span>
          </div>

          {appState.alert && <AlertBanner alert={appState.alert} className="mt-6" />}

          <div className="flex-1 grid grid-cols-[1.3fr_1fr] gap-16 min-h-0 mt-8 overflow-y-auto">
            <div className="flex flex-col justify-center text-center">
              {live ? (
                <>
                  <p className="text-caption uppercase tracking-wide text-muted-2">Now In Session</p>
                  <p className="text-hero text-primary mt-4" style={{ fontSize: "clamp(3.5rem, 6vw, 6rem)" }}>
                    {live.title}
                  </p>
                  {live.presenter && <p className="text-title text-muted mt-4">{live.presenter}</p>}
                </>
              ) : (
                <>
                  <p className="text-hero text-primary" style={{ fontSize: "clamp(3.5rem, 6vw, 6rem)" }}>
                    Welcome
                  </p>
                  {eventName && <p className="text-title text-muted mt-4">{eventName}</p>}
                </>
              )}

              {next && (
                <div className="mt-12 pt-8 border-t border-white/10">
                  <p className="text-caption uppercase tracking-wide text-muted-2">Next</p>
                  <p className="text-subtitle text-muted mt-2">{next.title}</p>
                  {countdownToNext !== null && (
                    <p className="text-body text-muted-2 mt-2 tabular-nums">
                      begins in {formatClock(countdownToNext)}
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="min-h-0 flex flex-col justify-center gap-6">
              {onDeck && (
                <div className="rounded-card bg-card/50 px-6 py-5">
                  <p className="text-caption uppercase tracking-wide text-muted-2">On Deck</p>
                  <p className="text-body text-muted mt-2">{onDeck.title}</p>
                </div>
              )}

              <div className="rounded-card bg-card/50 px-6 py-5">
                <p className="text-caption uppercase tracking-wide text-muted-2">Directions</p>
                <p className="text-body text-muted mt-2">
                  Restrooms and refreshments are located near the main hall entrance. Please silence phones during
                  sessions.
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </DisplayShell>
  );
}
