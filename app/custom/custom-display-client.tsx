"use client";

import { useEffect, useState } from "react";
import { useDisplayView } from "@/lib/use-display-view";
import { getSessionById } from "@/lib/data/sessions";
import { getLive, getNext } from "@/lib/types";
import { useDisplayEngine } from "@/lib/display-engine/store";
import { DisplayEngineProvider } from "@/lib/display-engine/context";
import { useDisplayClock } from "@/lib/display-engine/use-display-timer";
import { useDisplayTimer } from "@/lib/display-engine/use-display-timer";
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
import { CustomLayoutRenderer } from "@/components/display-engine/custom-layout-renderer";
import { AlertBanner } from "@/components/ui/alert-banner";
import type { DisplayProfile } from "@/lib/display-engine/types";

const PROFILE_POLL_MS = 10_000;

/**
 * Custom Display — the profile-driven counterpart to General/AV/Green
 * Room/Presenter. Where those 4 hand-build a fixed JSX tree per role,
 * this one reads a DisplayProfile (template + zone→widget assignments)
 * and renders it through CustomLayoutRenderer. Engine identity
 * deliberately declares "general" here, not "custom" — see
 * lib/display-engine/context.tsx's DisplayEngineIdentity.displayType doc:
 * that field only decides which display_type_state row Hold/Timer reads
 * from (a security-scoped table restricted to the 4 real types by design,
 * supabase/migrations/0009_display_type_state.sql), and a custom display
 * is meant to be a public-safe, read-only surface like General — never a
 * new local-control surface the way Presenter is. The *registry* identity
 * (what shows up in the Displays fleet, what a targeted broadcast can
 * address) is a separate concern, correctly declared "custom" below via
 * useDisplayCommands's own `type` argument.
 */
export default function CustomDisplayClient({
  token,
  eventId,
  profileId,
}: {
  token?: string;
  eventId?: string;
  profileId?: string;
}) {
  return (
    <DisplayEngineProvider token={token} eventId={eventId} displayType="general">
      <CustomDisplayInner token={token} eventId={eventId} profileId={profileId} />
    </DisplayEngineProvider>
  );
}

function useProfile(profileId: string | undefined, token: string | undefined, eventId: string | undefined) {
  const [profile, setProfile] = useState<DisplayProfile | null>(null);
  // No profileId means there's nothing to fetch — "loaded" from the start,
  // decided once at init rather than a synchronous setState inside the
  // effect below (react-hooks/set-state-in-effect).
  const [loaded, setLoaded] = useState(() => !profileId);

  useEffect(() => {
    if (!profileId) return;
    let cancelled = false;
    async function load() {
      const params = new URLSearchParams();
      if (token) params.set("token", token);
      if (eventId) params.set("eventId", eventId);
      try {
        const res = await fetch(`/api/display-engine/profiles/${profileId}?${params.toString()}`);
        const data = await res.json();
        if (!cancelled) {
          if (data.ok) setProfile(data.profile);
          setLoaded(true);
        }
      } catch {
        if (!cancelled) setLoaded(true);
      }
    }
    load();
    const interval = setInterval(load, PROFILE_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [profileId, token, eventId]);

  return { profile, loaded };
}

function CustomDisplayInner({
  token,
  eventId,
  profileId,
}: {
  token?: string;
  eventId?: string;
  profileId?: string;
}) {
  const { sessions, liveState: appState, connectionStatus, lastUpdatedAt, eventName } = useDisplayView({
    token,
    eventId,
    displayType: "general",
  });
  const session = getSessionById(sessions, appState.activeSessionId);
  const { state: engine } = useDisplayEngine();
  const { profile, loaded } = useProfile(profileId, token, eventId);

  const { offsetMs } = useTimeSync();
  const fullscreen = useFullscreen();

  const live = session ? getLive(session, appState) : null;
  const next = session ? getNext(session, appState) : null;
  const { currentOrder, isFinished } = deriveProgress(session, appState);
  const stageStatus = deriveStageStatus(live, appState.pausedAt);

  const { display, testMessage, fullscreenPrompt, dismissFullscreenPrompt } = useDisplayCommands(
    profile ? `Custom Display: ${profile.name}` : "Custom Display",
    "custom"
  );

  const autoInput = deriveAutoTimerInput(live, appState.progressBySession[appState.activeSessionId], appState.pausedAt);
  const timer = useDisplayTimer(autoInput, offsetMs);
  const clockLabel = useDisplayClock(offsetMs);
  const timerColor = TIMER_COLORS[timer.colorState];

  return (
    <DisplayShell connectionStatus={connectionStatus} lastUpdatedAt={lastUpdatedAt}>
      <HoldScreen hold={engine.hold} />
      {display && <BroadcastOverlay displayId={display.id} displayType="custom" />}
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
            title={profile?.name}
            eventName={eventName}
            room={display?.room}
            session={session}
            clockLabel={clockLabel}
            stageStatus={stageStatus}
          />

          {appState.alert && <AlertBanner alert={appState.alert} className="mt-6" />}

          {!loaded ? null : !profile ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-body text-muted-2">
                {profileId ? "This display's profile could not be loaded." : "No display profile selected."}
              </p>
            </div>
          ) : (
            <CustomLayoutRenderer
              profile={profile}
              data={{
                session,
                currentOrder,
                live,
                next,
                isFinished,
                timerLabel: autoInput ? timer.label : null,
                timerColor,
                isOverrun: timer.isOverrun,
                stageStatus,
              }}
            />
          )}
        </>
      )}
    </DisplayShell>
  );
}
