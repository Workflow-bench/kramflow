"use client";

import { useRef, useState } from "react";
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
import { useEventStore } from "@/lib/store";
import { useSessions } from "@/lib/use-sessions";
import { getSessionById } from "@/lib/data/sessions";
import { effectiveNotes, getLive, getNext } from "@/lib/types";
import { useCountdown } from "@/lib/use-countdown";
import { formatClock } from "@/lib/display-engine/use-display-timer";
import { useAuth } from "@/components/auth/auth-context";
import { useDisplayEngine } from "@/lib/display-engine/store";
import { EMERGENCY_PRESETS } from "@/lib/display-engine/types";
import { useControlLock } from "@/lib/use-control-lock";
import { ProgressBar } from "@/components/tv/progress-bar";
import { HoldBadge } from "@/components/tv/hold-badge";
import { BigActionButton } from "@/components/remote/big-action-button";
import { QuickActionButton } from "@/components/remote/quick-action-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog, useConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

type Panel = "none" | "jump" | "alert" | "notes" | "broadcast";
type ConfirmKind = "start" | "finish" | { session: string; label: string } | { jump: number } | null;

export default function RemotePage() {
  const { state, selectSession, start, next, previous, finish, togglePause, jumpTo, setAlert, setNotes, claimControl } =
    useEventStore();
  const { lock } = useAuth();
  const { sendBroadcast, state: engineState, setSpeakerReady } = useDisplayEngine();
  const sessions = useSessions();
  const session = getSessionById(sessions, state.activeSessionId);
  const [panel, setPanel] = useState<Panel>("none");
  const [confirmKind, setConfirmKind] = useState<ConfirmKind>(null);
  const [pending, setPending] = useState<"next" | "previous" | "hold" | "start" | "finish" | null>(null);
  const runningRef = useRef(false);
  const emergencyConfirm = useConfirmDialog<(typeof EMERGENCY_PRESETS)[number]>();
  const toast = useToast();
  const { lockedByOther } = useControlLock(state);

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

  const SEQUENCING_KINDS = new Set(["next", "previous", "hold", "start", "finish"]);

  async function run(kind: NonNullable<typeof pending>, action: () => Promise<unknown> | unknown) {
    // Same lock this surface's actions are gated by server-side
    // (app/api/live/route.ts) — see components/operator/controls-panel.tsx
    // for the full Take Control/Release/Take Over UI, which lives on
    // /operator as the primary coordination surface. Remote is a lighter
    // controller, so it gets a toast with the same "Take Over" escape
    // hatch rather than its own persistent lock-status affordance.
    if (lockedByOther && SEQUENCING_KINDS.has(kind)) {
      toast.error("Locked by the operator dashboard", {
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
        toast.error("That didn't work — try again");
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
  // branching before the actual call.
  function trySelectSession(sessionId: string) {
    if (lockedByOther) {
      toast.error("Locked by the operator dashboard", { label: "Take Over", onClick: () => claimControl(true) });
      return;
    }
    selectSession(sessionId);
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
      <main className="h-screen w-screen flex items-center justify-center bg-background px-6 text-center">
        <p className="text-body text-muted">
          {sessions.length === 0 ? "No sessions yet — add one from the Operator dashboard." : "Select a session to get started."}
        </p>
      </main>
    );
  }

  return (
    <main className="h-screen w-screen overflow-hidden bg-background flex flex-col">
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
            <Button type="button" variant="ghost" size="sm" square onClick={lock} aria-label="Lock" className="h-6 w-6">
              <Lock className="h-4 w-4" strokeWidth={2} />
            </Button>
          </div>
        </div>
        <div className="flex gap-1.5 overflow-x-auto mt-3 pb-1 -mx-1 px-1">
          {sessions.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => handleSessionClick(s.id, `${s.dayLabel} ${s.sessionLabel}`)}
              aria-current={s.id === state.activeSessionId ? "true" : undefined}
              aria-label={`${s.dayLabel} ${s.sessionLabel}`}
              className={cn(
                "shrink-0 rounded-panel px-3 py-1.5 text-left cursor-pointer transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                s.id === state.activeSessionId ? "bg-card text-primary" : "text-muted-2"
              )}
            >
              <p className="text-caption font-medium">{s.dayLabel}</p>
              <p className={cn("text-caption", s.id === state.activeSessionId ? "text-muted" : "text-muted-2")}>
                {s.sessionLabel}
              </p>
            </button>
          ))}
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
              {state.pausedAt && <HoldBadge />}
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
            onSaveNotes={(text) => {
              if (live) setNotes(live.id, text);
              setPanel("none");
            }}
            onBroadcast={(title, message) => {
              sendBroadcast({
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
              setPanel("none");
            }}
            onRequestEmergency={(preset) => {
              emergencyConfirm.request(preset);
              setPanel("none");
            }}
          />
        )}

        {currentOrder === null ? (
          <BigActionButton onClick={() => setConfirmKind("start")} className="h-24" disabled={pending !== null}>
            <Play className="h-7 w-7" strokeWidth={2} />
            Start
          </BigActionButton>
        ) : isFinished ? null : (
          <>
            <BigActionButton
              onClick={() => run("next", () => next(max))}
              className="h-28"
              disabled={isLastItem || pending !== null}
            >
              Next
            </BigActionButton>

            {isLastItem && (
              <BigActionButton
                variant="danger"
                className="h-16 mt-3"
                onClick={() => setConfirmKind("finish")}
                disabled={pending !== null}
              >
                <Square className="h-5 w-5" strokeWidth={2} />
                Finish Session
              </BigActionButton>
            )}

            <div className="flex gap-3 mt-3">
              <BigActionButton
                variant="secondary"
                className="h-16 text-base"
                onClick={() => run("previous", () => previous(min))}
                disabled={currentOrder === min || pending !== null}
              >
                <ChevronLeft className="h-5 w-5" strokeWidth={2} />
                Previous
              </BigActionButton>
              <BigActionButton
                variant={state.pausedAt ? "warning" : "secondary"}
                className="h-16 text-base"
                onClick={() => run("hold", togglePause)}
                disabled={pending !== null}
              >
                {state.pausedAt ? <Play className="h-5 w-5" strokeWidth={2} /> : <Pause className="h-5 w-5" strokeWidth={2} />}
                {state.pausedAt ? "Resume" : "Hold"}
              </BigActionButton>
            </div>

            <div className="flex gap-3 mt-3">
              <QuickActionButton
                icon={Hash}
                label="Jump"
                active={panel === "jump"}
                onClick={() => setPanel(panel === "jump" ? "none" : "jump")}
              />
              <QuickActionButton
                icon={AlertTriangle}
                label="Alert"
                active={panel === "alert"}
                onClick={() => setPanel(panel === "alert" ? "none" : "alert")}
              />
              <QuickActionButton
                icon={NotebookPen}
                label="Notes"
                active={panel === "notes"}
                onClick={() => setPanel(panel === "notes" ? "none" : "notes")}
              />
              <QuickActionButton
                icon={Megaphone}
                label="Broadcast"
                active={panel === "broadcast"}
                onClick={() => setPanel(panel === "broadcast" ? "none" : "broadcast")}
              />
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
          if (typeof confirmKind === "object" && confirmKind && "jump" in confirmKind) {
            jumpTo(confirmKind.jump);
          }
          setConfirmKind(null);
        }}
        onCancel={() => setConfirmKind(null)}
      />

      <ConfirmDialog
        open={emergencyConfirm.isOpen}
        title={`Send "${emergencyConfirm.pending?.title}" to every display?`}
        description="This takes over every connected screen immediately."
        confirmLabel="Send Emergency"
        tone="danger"
        onConfirm={() => {
          const preset = emergencyConfirm.pending;
          if (preset) {
            sendBroadcast({
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
          }
          emergencyConfirm.cancel();
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
