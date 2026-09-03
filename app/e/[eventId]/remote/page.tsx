"use client";

import { useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  Pause,
  Play,
  Square,
  AlertTriangle,
  NotebookPen,
  Hash,
  X,
  Send,
  Lock,
  Megaphone,
  CheckCircle2,
  Circle,
} from "lucide-react";
import { useEventStore, getLastActionStatus } from "@/lib/store";
import { useSessions } from "@/lib/use-sessions";
import { getSessionById } from "@/lib/data/sessions";
import { effectiveNotes, getLive, getNext } from "@/lib/types";
import { useCountdown } from "@/lib/use-countdown";
import { formatClock } from "@/lib/display-engine/use-display-timer";
import { useAuth } from "@/components/auth/auth-context";
import { useDisplayEngine } from "@/lib/display-engine/store";
import { EMERGENCY_PRESETS } from "@/lib/display-engine/types";
import { useControlLock } from "@/lib/use-control-lock";
import { useControllerName } from "@/lib/use-controller-name";
import { useEventId, useIsOwner } from "@/lib/event-context";
import { ProgressBar } from "@/components/ui/progress-bar";
import { OperationalStatus } from "@/components/ui/operational-status";
import { BigActionButton } from "@/components/remote/big-action-button";
import { QuickActionButton } from "@/components/remote/quick-action-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog, useConfirmDialog } from "@/components/ui/confirm-dialog";
import { MaybeTooltip } from "@/components/ui/tooltip";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

// P1 permission-truth fix (2026-09) — every action on this page routes
// through either app/api/live/route.ts (start/next/previous/hold/finish/
// jump/session-switch/alert/notes — all gated requireEventAccess(...,
// "owner"), no per-action distinction there) or app/api/display-engine/
// broadcasts/route.ts (send/emergency — also "owner"). The one exception
// is Speaker Ready (app/api/display-engine/speaker-ready/route.ts), which
// deliberately has no role check at all — see that route's own comment.
// Before this fix, none of that was reflected here: every control
// rendered fully clickable for every role, and a non-owner only found out
// it was owner-only after pressing it and getting a generic "That didn't
// work" toast for what the server had already correctly rejected as a 403.
const OWNER_ONLY_NOTE = "Only the event owner can control the show from here — you can still watch and mark the speaker ready.";

type Panel = "none" | "jump" | "alert" | "notes" | "broadcast";
type ConfirmKind = "start" | "finish" | { session: string; label: string } | { jump: number } | null;

export default function RemotePage() {
  const { state, selectSession, start, next, previous, finish, togglePause, jumpTo, setAlert, setNotes, claimControl } =
    useEventStore();
  const { lock } = useAuth();
  const { sendBroadcast, state: engineState, setSpeakerReady } = useDisplayEngine();
  const registeredCount = Object.keys(engineState.registry).length;
  const sessions = useSessions();
  const session = getSessionById(sessions, state.activeSessionId);
  const [panel, setPanel] = useState<Panel>("none");
  const [confirmKind, setConfirmKind] = useState<ConfirmKind>(null);
  const [pending, setPending] = useState<"next" | "previous" | "hold" | "start" | "finish" | "jump" | null>(null);
  const runningRef = useRef(false);
  const emergencyConfirm = useConfirmDialog<(typeof EMERGENCY_PRESETS)[number]>();
  const [emergencySending, setEmergencySending] = useState(false);
  // Ref, not just `emergencySending` — ConfirmDialog's confirm button has no
  // disabled-while-submitting state unless `loading` is passed to it, and a
  // rapid multi-click burst (easy to do on the touch-oriented Remote quick
  // panel) can fire onConfirm several times before React commits state.
  // Same guard as the Broadcast Center's identical emergency-send handler
  // (app/e/[eventId]/broadcast/page.tsx), added there after a confirmed
  // live 5-clicks-to-5-duplicate-broadcasts repro.
  const emergencySendingRef = useRef(false);
  const toast = useToast();
  const isOwner = useIsOwner();
  const { lockedByOther } = useControlLock(state);
  const eventId = useEventId();
  const controllerName = useControllerName(eventId, lockedByOther ? state.controllerId : null);
  const lockedMessage = controllerName ? `Locked by ${controllerName}` : "Locked by the operator dashboard";
  // run() is async and needs the *current* lock state when a request comes
  // back, not the value closed over when it fired — see the identical fix
  // in components/operator/controls-panel.tsx for why (confirmed live
  // during the multi-operator stress test: a stale pre-check read is a
  // real, reachable race, not just theoretical).
  const lockedByOtherRef = useRef(lockedByOther);
  const lockedMessageRef = useRef(lockedMessage);
  useEffect(() => {
    lockedByOtherRef.current = lockedByOther;
    lockedMessageRef.current = lockedMessage;
  }, [lockedByOther, lockedMessage]);

  const progress = session ? state.progressBySession[state.activeSessionId] : undefined;
  const currentOrder = progress?.currentOrder ?? null;
  const live = session ? getLive(session, state) : null;
  const next_ = session ? getNext(session, state) : null;
  const nextReady = next_ ? Boolean(engineState.speakerReady[next_.id]) : false;
  const countdown = useCountdown(progress?.startedAt ?? null, live?.durationMinutes ?? 0, state.pausedAt);
  const min = 1;
  const max = session?.items.length ?? 0;
  const isFinished = currentOrder !== null && currentOrder > max;
  const isLastItem = currentOrder === max;
  const currentSessionHasProgress = currentOrder !== null;

  const SEQUENCING_KINDS = new Set(["next", "previous", "hold", "start", "finish", "jump"]);

  async function run(kind: NonNullable<typeof pending>, action: () => Promise<unknown> | unknown) {
    // Visual gating (disabled + tooltip on every owner-only control below)
    // is the primary fix — this is the defense-in-depth backstop for
    // anything that reaches run() anyway (a race where the role changes
    // mid-session, or a control this pass missed), so it never depends on
    // a round trip to say something true.
    if (!isOwner && SEQUENCING_KINDS.has(kind)) {
      toast.error(OWNER_ONLY_NOTE);
      return;
    }
    // Same lock this surface's actions are gated by server-side
    // (app/api/live/route.ts) — see components/operator/controls-panel.tsx
    // for the full Take Control/Release/Take Over UI, which lives on
    // /operator as the primary coordination surface. Remote is a lighter
    // controller, so it gets a toast with the same "Take Over" escape
    // hatch rather than its own persistent lock-status affordance.
    if (lockedByOther && SEQUENCING_KINDS.has(kind)) {
      toast.error(lockedMessage, {
        label: "Take Over",
        onClick: () => claimControl(true),
      });
      return;
    }
    if (runningRef.current) return;
    runningRef.current = true;
    setPending(kind);
    try {
      const result = await action();
      if (result === false) {
        if (SEQUENCING_KINDS.has(kind) && lockedByOtherRef.current) {
          toast.error(lockedMessageRef.current, { label: "Take Over", onClick: () => claimControl(true) });
        } else if (getLastActionStatus(eventId) === 403) {
          // Gating above should make this unreachable in normal use — a
          // stale/changed role (or a bypassed disabled control) is the
          // only way to still hit it, so say that plainly rather than a
          // generic failure that leaves the operator guessing.
          toast.error("You no longer have permission to perform this action.");
        } else {
          toast.error("That didn't work — try again");
        }
      }
    } finally {
      runningRef.current = false;
      setPending(null);
    }
  }

  // selectSession is server-side locked too (app/api/live/route.ts) since
  // switching the active session out from under a controlling operator is
  // exactly the kind of clobber the lock exists to prevent — same toast +
  // Take Over escape hatch as the sequencing buttons in run(), just not
  // routed through run() itself since this one has its own confirm-dialog
  // branching before the actual call. Previously never checked
  // selectSession's own result at all — a rejected switch (owner-only,
  // same as every other live-state action) showed nothing whatsoever, not
  // even a generic toast; the tab just silently appeared to do nothing.
  async function trySelectSession(sessionId: string) {
    if (!isOwner) {
      toast.error(OWNER_ONLY_NOTE);
      return;
    }
    if (lockedByOther) {
      toast.error(lockedMessage, { label: "Take Over", onClick: () => claimControl(true) });
      return;
    }
    const ok = await selectSession(sessionId);
    if (!ok) {
      if (lockedByOtherRef.current) {
        toast.error(lockedMessageRef.current, { label: "Take Over", onClick: () => claimControl(true) });
      } else if (getLastActionStatus(eventId) === 403) {
        toast.error("You no longer have permission to perform this action.");
      } else {
        toast.error("Couldn't switch session — try again");
      }
    }
  }

  function handleSessionClick(sessionId: string, label: string) {
    if (sessionId === state.activeSessionId) return;
    if (currentSessionHasProgress) {
      setConfirmKind({ session: sessionId, label });
    } else {
      trySelectSession(sessionId);
    }
  }

  if (!session) {
    return (
      <main className="h-screen w-full max-w-md mx-auto flex items-center justify-center bg-background px-6 text-center">
        <p className="text-body text-muted">
          {sessions.length === 0 ? "No sessions yet — add one from the Operator dashboard." : "Select a session to get started."}
        </p>
      </main>
    );
  }

  return (
    // w-full max-w-md mx-auto, not w-screen — Remote's giant one-handed
    // touch targets are correct at the phone widths this page is actually
    // designed for (a second, dedicated device — see docs/DESIGN.md), but
    // stretched edge-to-edge at a desktop viewport they read as an
    // unscaled phone UI rather than a considered surface (2026-09
    // convergence sprint, Workstream 7). body already carries the same
    // bg-background token, so capping main's width leaves a seamless,
    // identically-colored margin outside it rather than needing a second
    // wrapper — this page just never intentionally used the extra space.
    <main className="h-screen w-full max-w-md mx-auto overflow-hidden bg-background flex flex-col">
      {/* Compact header — session context, not a full navigation bar */}
      <div className="shrink-0 px-6 pt-6 pb-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-caption text-muted-2 truncate min-w-0">
            {session.dayLabel} • {session.sessionLabel}
          </p>
          <div className="flex items-center gap-3 shrink-0">
            <p className="text-caption text-muted-2 tabular-nums">
              {Math.min(currentOrder ?? 0, max)} / {max}
            </p>
            {/* 44×44 minimum touch target, not the 24×24 this used to be
                shrunk to for the compact header row — Remote is the app's
                one designated one-handed/thumb surface (see docs/DESIGN_
                SYSTEM.md), so an undersized target here specifically
                contradicts the surface's own reason to exist (2026-09-01
                UI/UX audit finding #15). Negative margin keeps the visual
                footprint from widening the header row now that the hit
                area is bigger than the icon it wraps. */}
            <Button type="button" variant="ghost" size="sm" square onClick={lock} aria-label="Lock" className="h-11 w-11 -mr-1.5 -my-1.5">
              <Lock className="h-4 w-4" strokeWidth={2} />
            </Button>
          </div>
        </div>
        <div className="flex gap-1.5 overflow-x-auto mt-3 pb-1 -mx-1 px-1">
          {sessions.map((s) => {
            const switchDisabled = !isOwner && s.id !== state.activeSessionId;
            return (
              <MaybeTooltip key={s.id} when={switchDisabled} content={OWNER_ONLY_NOTE}>
                <button
                  type="button"
                  onClick={() => handleSessionClick(s.id, `${s.dayLabel} ${s.sessionLabel}`)}
                  disabled={switchDisabled}
                  aria-current={s.id === state.activeSessionId ? "true" : undefined}
                  aria-label={`${s.dayLabel} ${s.sessionLabel}`}
                  className={cn(
                    "shrink-0 rounded-panel px-3 py-1.5 text-left transition-colors",
                    switchDisabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    s.id === state.activeSessionId ? "bg-card text-primary" : "text-muted-2"
                  )}
                >
                  <p className="text-caption font-medium">{s.dayLabel}</p>
                  <p className={cn("text-caption", s.id === state.activeSessionId ? "text-muted" : "text-muted-2")}>
                    {s.sessionLabel}
                  </p>
                </button>
              </MaybeTooltip>
            );
          })}
        </div>
      </div>

      {/* Main focus — current + next, huge countdown */}
      {/* Plain `justify-center` on a scrollable overflow
          container centers the overflow itself, so at scroll position 0 the
          browser shows the *middle* of a wrapped 3-line title, not the top —
          the top line was scrolled off above the visible viewport by
          default at 320-375px. `safe center` keeps the nice vertical
          centering for the common case (title fits) but falls back to
          start-alignment instead of clipping when content overflows, so the
          top of a long title is always what's visible on load. */}
      <div
        className="flex-1 min-h-0 flex flex-col items-center px-6 text-center overflow-y-auto"
        style={{ justifyContent: "safe center" }}
      >
        {currentOrder === null ? (
          <p className="text-body text-muted">Not started</p>
        ) : isFinished ? (
          <p className="text-body text-muted">Session finished</p>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <p className="text-caption uppercase tracking-wide text-muted-2">Now</p>
              {state.pausedAt && <OperationalStatus kind="hold" />}
            </div>
            <p className="text-title text-primary mt-2 leading-tight">{live?.title}</p>
            {live?.presenter && <p className="text-body text-muted mt-1">{live.presenter}</p>}

            {live && live.type === "item" && live.durationMinutes > 0 && (
              <div className="mt-8 w-full max-w-xs">
                <p className={cn("text-hero tabular-nums", countdown.isOverrun ? "text-status-red" : "text-primary")}>
                  {countdown.isOverrun ? "+" : ""}
                  {formatClock(countdown.remainingSeconds)}
                </p>
                <div className="mt-4">
                  <ProgressBar
                    fraction={countdown.fraction}
                    tone={state.pausedAt ? "orange" : countdown.isOverrun ? "red" : "green"}
                  />
                </div>
              </div>
            )}

            {next_ && (
              <div className="mt-10 pt-6 border-t border-white/5 w-full max-w-xs">
                <p className="text-caption uppercase tracking-wide text-muted-2">Next</p>
                <p className="text-body text-primary mt-1.5">{next_.title}</p>

                <button
                  type="button"
                  onClick={() => setSpeakerReady(next_.id, !nextReady)}
                  className={cn(
                    "mt-4 w-full flex items-center justify-center gap-2.5 rounded-full px-5 py-3 text-body font-semibold cursor-pointer transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    nextReady ? "bg-status-green/15 text-status-green" : "bg-white/5 text-muted hover:text-primary"
                  )}
                >
                  {nextReady ? <CheckCircle2 className="h-4 w-4" strokeWidth={2} /> : <Circle className="h-4 w-4" strokeWidth={2} />}
                  {nextReady ? "Speaker Ready" : "Mark Speaker Ready"}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Thumb zone — primary controls stay fixed at the bottom */}
      <div className="shrink-0 px-6 pb-8 pt-4">
        {panel !== "none" && (
          <QuickPanel
            panel={panel}
            onClose={() => setPanel("none")}
            max={max}
            currentNotes={live ? effectiveNotes(state, live) : ""}
            onRequestJump={(order) => {
              setConfirmKind({ jump: order });
              setPanel("none");
            }}
            onAlert={(message, severity) => {
              setAlert({ message, severity });
              setPanel("none");
            }}
            onSaveNotes={async (text) => {
              setPanel("none");
              if (!live) return;
              const ok = await setNotes(live.id, text);
              if (!ok) {
                toast.error(
                  getLastActionStatus(eventId) === 403
                    ? "You no longer have permission to perform this action."
                    : "Couldn't save notes — try again"
                );
              }
            }}
            onBroadcast={async (title, message) => {
              setPanel("none");
              const res = await sendBroadcast({
                type: "info",
                title,
                message,
                icon: null,
                priority: 2,
                target: { kind: "all" },
                expiresInMinutes: null,
                durationSeconds: null,
                acknowledgementRequired: false,
                persistent: false,
                scheduledFor: null,
              });
              if (!res || !res.ok) {
                toast.error(
                  res?.status === 403
                    ? "You no longer have permission to perform this action."
                    : "Couldn't send the broadcast — try again"
                );
              }
            }}
            onRequestEmergency={(preset) => {
              emergencyConfirm.request(preset);
              setPanel("none");
            }}
          />
        )}

        {currentOrder === null ? (
          <MaybeTooltip when={!isOwner} content={OWNER_ONLY_NOTE}>
            <BigActionButton onClick={() => setConfirmKind("start")} className="h-24" disabled={!isOwner || pending !== null}>
              <Play className="h-7 w-7" strokeWidth={2} />
              Start
            </BigActionButton>
          </MaybeTooltip>
        ) : isFinished ? null : (
          <>
            <MaybeTooltip when={!isOwner} content={OWNER_ONLY_NOTE}>
              <BigActionButton
                onClick={() => run("next", () => next(max))}
                className="h-28"
                disabled={!isOwner || isLastItem || pending !== null}
              >
                Next
              </BigActionButton>
            </MaybeTooltip>

            {isLastItem && (
              <MaybeTooltip when={!isOwner} content={OWNER_ONLY_NOTE}>
                <BigActionButton
                  variant="danger"
                  className="h-16 mt-3"
                  onClick={() => setConfirmKind("finish")}
                  disabled={!isOwner || pending !== null}
                >
                  <Square className="h-5 w-5" strokeWidth={2} />
                  Finish Session
                </BigActionButton>
              </MaybeTooltip>
            )}

            <div className="flex gap-3 mt-3">
              <MaybeTooltip when={!isOwner} content={OWNER_ONLY_NOTE}>
                <BigActionButton
                  variant="secondary"
                  className="h-16 text-base"
                  onClick={() => run("previous", () => previous(min))}
                  disabled={!isOwner || currentOrder === min || pending !== null}
                >
                  <ChevronLeft className="h-5 w-5" strokeWidth={2} />
                  Previous
                </BigActionButton>
              </MaybeTooltip>
              <MaybeTooltip when={!isOwner} content={OWNER_ONLY_NOTE}>
                <BigActionButton
                  variant={state.pausedAt ? "warning" : "secondary"}
                  className="h-16 text-base"
                  onClick={() => run("hold", togglePause)}
                  disabled={!isOwner || pending !== null}
                >
                  {state.pausedAt ? <Play className="h-5 w-5" strokeWidth={2} /> : <Pause className="h-5 w-5" strokeWidth={2} />}
                  {state.pausedAt ? "Resume" : "Hold"}
                </BigActionButton>
              </MaybeTooltip>
            </div>

            <div className="flex gap-3 mt-3">
              <MaybeTooltip when={!isOwner} content={OWNER_ONLY_NOTE}>
                <QuickActionButton
                  icon={Hash}
                  label="Jump"
                  active={panel === "jump"}
                  disabled={!isOwner}
                  onClick={() => setPanel(panel === "jump" ? "none" : "jump")}
                />
              </MaybeTooltip>
              <MaybeTooltip when={!isOwner} content={OWNER_ONLY_NOTE}>
                <QuickActionButton
                  icon={AlertTriangle}
                  label="Alert"
                  active={panel === "alert"}
                  disabled={!isOwner}
                  onClick={() => setPanel(panel === "alert" ? "none" : "alert")}
                />
              </MaybeTooltip>
              <MaybeTooltip when={!isOwner} content={OWNER_ONLY_NOTE}>
                <QuickActionButton
                  icon={NotebookPen}
                  label="Notes"
                  active={panel === "notes"}
                  disabled={!isOwner}
                  onClick={() => setPanel(panel === "notes" ? "none" : "notes")}
                />
              </MaybeTooltip>
              <MaybeTooltip when={!isOwner} content={OWNER_ONLY_NOTE}>
                <QuickActionButton
                  icon={Megaphone}
                  label="Broadcast"
                  active={panel === "broadcast"}
                  disabled={!isOwner}
                  onClick={() => setPanel(panel === "broadcast" ? "none" : "broadcast")}
                />
              </MaybeTooltip>
            </div>
          </>
        )}
      </div>

      <ConfirmDialog
        open={confirmKind === "start"}
        title="Start the session?"
        description="This puts the first item live on every connected display."
        confirmLabel="Start"
        onConfirm={() => {
          setConfirmKind(null);
          run("start", start);
        }}
        onCancel={() => setConfirmKind(null)}
      />

      <ConfirmDialog
        open={confirmKind === "finish"}
        title="Finish the session?"
        description="This marks the session complete on every connected display. You can still use Previous to go back."
        confirmLabel="Finish Session"
        tone="danger"
        onConfirm={() => {
          setConfirmKind(null);
          run("finish", () => finish(max));
        }}
        onCancel={() => setConfirmKind(null)}
      />

      <ConfirmDialog
        open={typeof confirmKind === "object" && confirmKind !== null && "session" in confirmKind}
        title={`Switch to ${typeof confirmKind === "object" && confirmKind && "session" in confirmKind ? confirmKind.label : ""}?`}
        description="The current session has already started. Switching changes what's live on every connected display."
        confirmLabel="Switch Session"
        tone="danger"
        onConfirm={() => {
          if (typeof confirmKind === "object" && confirmKind && "session" in confirmKind) {
            trySelectSession(confirmKind.session);
          }
          setConfirmKind(null);
        }}
        onCancel={() => setConfirmKind(null)}
      />

      <ConfirmDialog
        open={typeof confirmKind === "object" && confirmKind !== null && "jump" in confirmKind}
        title={`Jump to item ${typeof confirmKind === "object" && confirmKind && "jump" in confirmKind ? confirmKind.jump : ""}?`}
        description="This changes what's live on every connected display right now."
        confirmLabel="Jump Here"
        onConfirm={() => {
          // Previously called jumpTo() directly with its result never
          // checked — same silently-swallowed-rejection gap trySelectSession
          // had (jumpTo is owner-gated too, via the same /api/live route).
          // Routed through run() like every other sequencing action so a
          // rejection surfaces a real toast instead of nothing.
          if (typeof confirmKind === "object" && confirmKind && "jump" in confirmKind) {
            const order = confirmKind.jump;
            run("jump", () => jumpTo(order, max));
          }
          setConfirmKind(null);
        }}
        onCancel={() => setConfirmKind(null)}
      />

      <ConfirmDialog
        open={emergencyConfirm.isOpen}
        title={`Send "${emergencyConfirm.pending?.title}" to every display?`}
        description={`"${emergencyConfirm.pending?.message}" — takes over ${registeredCount} registered display${registeredCount === 1 ? "" : "s"} immediately. Send an update or Clear afterward if needed.`}
        confirmLabel="Send Emergency"
        tone="danger"
        loading={emergencySending}
        onConfirm={async () => {
          const preset = emergencyConfirm.pending;
          if (!preset || emergencySendingRef.current) return;
          emergencySendingRef.current = true;
          setEmergencySending(true);
          try {
            const res = await sendBroadcast({
              type: "emergency",
              title: preset.title,
              message: preset.message,
              icon: null,
              priority: 3,
              target: { kind: "all" },
              expiresInMinutes: null,
              durationSeconds: null,
              acknowledgementRequired: true,
              persistent: true,
              scheduledFor: null,
            });
            emergencyConfirm.cancel();
            if (res && res.ok) toast.success("Emergency broadcast sent");
            else if (res?.status === 403) toast.error("You no longer have permission to perform this action.");
            else toast.error("Couldn't send the emergency broadcast — try again immediately");
          } finally {
            emergencySendingRef.current = false;
            setEmergencySending(false);
          }
        }}
        onCancel={emergencyConfirm.cancel}
      />
    </main>
  );
}

function QuickPanel({
  panel,
  onClose,
  max,
  currentNotes,
  onRequestJump,
  onAlert,
  onSaveNotes,
  onBroadcast,
  onRequestEmergency,
}: {
  panel: Exclude<Panel, "none">;
  onClose: () => void;
  max: number;
  currentNotes: string;
  onRequestJump: (order: number) => void;
  onAlert: (message: string, severity: "info" | "warning" | "critical") => void;
  onSaveNotes: (text: string) => void;
  onBroadcast: (title: string, message: string) => void;
  onRequestEmergency: (preset: (typeof EMERGENCY_PRESETS)[number]) => void;
}) {
  const [jumpValue, setJumpValue] = useState("");
  const [alertValue, setAlertValue] = useState("");
  const [notesValue, setNotesValue] = useState(currentNotes);
  const [broadcastValue, setBroadcastValue] = useState("");

  // QuickPanel stays mounted across sub-panel switches (only which section
  // renders changes) — useState(currentNotes) above only captures the
  // value from the first mount, so switching to the jump/alert/broadcast
  // panel and back to notes without unmounting showed stale notes if the
  // live item changed in between. Adjusted during render (same pattern as
  // components/forms/event-settings-panel.tsx's trackedInitialName) rather
  // than an effect, and only on the rising edge into "notes" — not on
  // every currentNotes change while already viewing it, so a Realtime
  // update elsewhere doesn't clobber an in-progress edit.
  const [trackedPanel, setTrackedPanel] = useState(panel);
  if (panel !== trackedPanel) {
    setTrackedPanel(panel);
    if (panel === "notes") setNotesValue(currentNotes);
  }

  return (
    <div className="rounded-card bg-card p-5 mb-3">
      <div className="flex items-center justify-between mb-3">
        <p className="text-caption uppercase tracking-wide text-muted-2">
          {panel === "jump"
            ? "Jump to Item"
            : panel === "alert"
              ? "Send Alert"
              : panel === "notes"
                ? "Stage Notes"
                : "Broadcast to Displays"}
        </p>
        <Button type="button" variant="ghost" size="sm" square onClick={onClose} aria-label="Close">
          <X className="h-4 w-4" strokeWidth={2} />
        </Button>
      </div>

      {panel === "jump" && (
        <div className="flex gap-2">
          <Input
            size="lg"
            type="number"
            min={1}
            max={max}
            inputMode="numeric"
            placeholder={`1–${max}`}
            value={jumpValue}
            onChange={(e) => setJumpValue(e.target.value)}
            aria-label="Item number"
            className="flex-1 tabular-nums"
          />
          <Button
            type="button"
            variant="primary"
            size="lg"
            square
            aria-label="Jump"
            disabled={!jumpValue || Number(jumpValue) < 1 || Number(jumpValue) > max}
            onClick={() => onRequestJump(Number(jumpValue))}
          >
            <Send className="h-5 w-5" strokeWidth={2} />
          </Button>
        </div>
      )}

      {panel === "alert" && (
        <div className="flex gap-2">
          <Input
            size="lg"
            type="text"
            placeholder="Drama Team, report Stage Left"
            value={alertValue}
            onChange={(e) => setAlertValue(e.target.value)}
            aria-label="Alert message"
            className="flex-1"
          />
          <Button
            type="button"
            variant="primary"
            size="lg"
            square
            aria-label="Send alert"
            disabled={!alertValue.trim()}
            onClick={() => onAlert(alertValue.trim(), "warning")}
          >
            <Send className="h-5 w-5" strokeWidth={2} />
          </Button>
        </div>
      )}

      {panel === "notes" && (
        <div className="flex gap-2">
          <Textarea
            rows={2}
            placeholder="Cues, mic setup, entrances…"
            value={notesValue}
            onChange={(e) => setNotesValue(e.target.value)}
            aria-label="Stage notes"
            className="flex-1 h-14 rounded-card px-4 py-3 text-body resize-none"
          />
          <Button
            type="button"
            variant="primary"
            size="lg"
            square
            aria-label="Save notes"
            onClick={() => onSaveNotes(notesValue)}
          >
            <Send className="h-5 w-5" strokeWidth={2} />
          </Button>
        </div>
      )}

      {panel === "broadcast" && (
        <div className="flex flex-col gap-3">
          <div className="flex gap-2">
            <Input
              size="lg"
              type="text"
              placeholder="Message to every display"
              value={broadcastValue}
              onChange={(e) => setBroadcastValue(e.target.value)}
              aria-label="Broadcast message"
              className="flex-1"
            />
            <Button
              type="button"
              variant="primary"
              size="lg"
              square
              aria-label="Send broadcast"
              disabled={!broadcastValue.trim()}
              onClick={() => onBroadcast(broadcastValue.trim(), "")}
            >
              <Send className="h-5 w-5" strokeWidth={2} />
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            {EMERGENCY_PRESETS.map((preset) => (
              <Button
                key={preset.label}
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onRequestEmergency(preset)}
                className="rounded-full bg-status-red/15 text-status-red hover:bg-status-red/25 hover:text-status-red"
              >
                <AlertTriangle className="h-3.5 w-3.5" strokeWidth={2} />
                {preset.label}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
