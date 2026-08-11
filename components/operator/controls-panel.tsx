"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, Pause, Play, Square, ChevronRight, Lock, Unlock } from "lucide-react";
import { useEventStore } from "@/lib/store";
import { useKeyboardShortcuts } from "@/lib/display-engine/use-keyboard-shortcuts";
import { useControlLock } from "@/lib/use-control-lock";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { SectionLabel } from "@/components/tv/section-label";
import { JumpControl } from "./jump-control";
import { AlertComposer } from "./alert-composer";
import { ActivityLog } from "./activity-log";
import { OperatorBroadcastPanel } from "@/components/display-engine/operator-broadcast-panel";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import type { Session } from "@/lib/types";

const FAILURE_MESSAGE: Record<string, string> = {
  next: "Couldn't advance to the next item — try again",
  previous: "Couldn't go back — try again",
  hold: "Couldn't toggle Hold — try again",
  start: "Couldn't start the session — try again",
  finish: "Couldn't finish the session — try again",
};

type ConfirmKind = "start" | "finish" | "takeover" | null;

export function ControlsPanel({
  session,
  broadcastAction,
}: {
  session: Session;
  /** Tells other connected /operator tabs what just happened here — see
   *  lib/use-operator-presence.ts and R2-BUG-1 (a Hold silently cleared by
   *  another tab's Next, with no indication to either operator). */
  broadcastAction: (message: string) => void;
}) {
  const { state, start, next, previous, finish, togglePause, claimControl, releaseControl, renewControl } =
    useEventStore();
  const progress = state.progressBySession[state.activeSessionId];
  const currentOrder = progress?.currentOrder ?? null;
  const min = 1;
  const max = session.items.length;
  const isFinished = currentOrder !== null && currentOrder > max;
  const isLastItem = currentOrder === max;

  const [confirmKind, setConfirmKind] = useState<ConfirmKind>(null);
  // Disables the button that triggered a request until it resolves, so a
  // fast double-click can't fire the same action twice before the first
  // PATCH lands server-side. The ref guard is needed because two clicks
  // dispatched in the same tick both run before React re-renders with the
  // disabled prop from setPending.
  const [pending, setPending] = useState<"next" | "previous" | "hold" | "start" | "finish" | null>(null);
  const [takingOver, setTakingOver] = useState(false);
  const runningRef = useRef(false);
  const toast = useToast();
  const { iHaveControl, lockedByOther } = useControlLock(state);

  // Renew the claim every 15s while held — comfortably inside the server's
  // 45s staleness window — so it survives as long as this tab is actually
  // open, and lapses on its own (no explicit release needed) if the tab
  // crashes or the browser closes.
  useEffect(() => {
    if (!iHaveControl) return;
    const id = setInterval(renewControl, 15000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iHaveControl]);

  const SEQUENCING_KINDS = new Set(["next", "previous", "hold", "start", "finish"]);

  // sendAction() (lib/store.tsx) already returns false on failure so
  // callers "can show an error instead of a false 'it worked'" — this
  // wrapper used to await the action and discard that result, so Next/
  // Previous/Hold (the three highest-frequency buttons in the app) failed
  // completely silently during a backend outage (QA_REPORT_ROUND2.md
  // R2-BUG-2). Every action here returns that same boolean now.
  async function run(kind: NonNullable<typeof pending>, action: () => Promise<boolean>, successMessage?: string) {
    // Client-side check purely for a faster, more specific message than
    // "that didn't work" — app/api/live/route.ts enforces the real lock
    // server-side regardless, so a stale read here (e.g. this tab hasn't
    // gotten the latest Realtime update yet) just means the server's own
    // 423 falls through to the generic failure toast below instead of this
    // one. Either way the action never actually runs against a lock someone
    // else holds.
    if (lockedByOther && SEQUENCING_KINDS.has(kind)) {
      toast.error("Locked by another operator", { label: "Take Over", onClick: () => setConfirmKind("takeover") });
      return;
    }
    if (runningRef.current) return;
    runningRef.current = true;
    setPending(kind);
    try {
      const ok = await action();
      if (!ok) {
        toast.error(FAILURE_MESSAGE[kind] ?? "That didn't work — try again");
      } else if (successMessage) {
        broadcastAction(successMessage);
      }
    } finally {
      runningRef.current = false;
      setPending(null);
    }
  }

  // Presenter already has a real shortcut set (Space/±/R/F/H/Esc) — the
  // Operator Dashboard, where the highest-frequency actions actually live,
  // had none. Reuses the same generic hook (never global — scoped to this
  // page, ignored while typing in an input) rather than a second
  // implementation. Disabled while a confirm dialog is open or the session
  // hasn't started, so e.g. pressing H during the Start confirmation can't
  // fire Hold in the background.
  useKeyboardShortcuts(
    {
      ArrowRight: () => {
        if (!isLastItem && pending === null) run("next", () => next(max), "advanced to the next item");
      },
      ArrowLeft: () => {
        if (currentOrder !== min && pending === null) run("previous", () => previous(min), "went back to the previous item");
      },
      h: () => {
        if (pending === null) run("hold", togglePause, state.pausedAt ? "resumed the show" : "put the show on Hold");
      },
      H: () => {
        if (pending === null) run("hold", togglePause, state.pausedAt ? "resumed the show" : "put the show on Hold");
      },
    },
    confirmKind === null && currentOrder !== null && !isFinished
  );

  return (
    <div className="flex flex-col gap-10">
      <div>
        <div className="flex items-center justify-between gap-3">
          <SectionLabel>Controls</SectionLabel>
          {currentOrder !== null && !isFinished && (
            <p className="text-caption text-muted-2 tabular-nums">← → Next/Prev · H Hold</p>
          )}
        </div>

        {/* Opt-in sequencing lock (see lib/types.ts's LiveState.controllerId
            doc comment) — unclaimed shows only a quiet "Take Control" link
            so a single operator's screen looks exactly like it did before
            this existed. QA_REPORT_ROUND2.md R2-BUG-1: this exists because
            two /operator tabs could otherwise drive the same show with a
            plain Next silently clearing another tab's just-set Hold. */}
        <div className="mt-2 flex items-center gap-2 text-caption">
          {iHaveControl ? (
            <>
              <span className="flex items-center gap-1.5 text-status-green">
                <Lock className="h-3 w-3" strokeWidth={2} />
                You have control
              </span>
              <button
                type="button"
                onClick={() => releaseControl()}
                className="text-muted-2 hover:text-primary cursor-pointer underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 rounded"
              >
                Release
              </button>
            </>
          ) : lockedByOther ? (
            <>
              <span className="flex items-center gap-1.5 text-status-orange">
                <Lock className="h-3 w-3" strokeWidth={2} />
                Locked by another operator
              </span>
              <button
                type="button"
                onClick={() => setConfirmKind("takeover")}
                className="text-status-orange hover:text-primary cursor-pointer underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 rounded"
              >
                Take Over
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => claimControl()}
              className={cn(
                "flex items-center gap-1.5 text-muted-2 hover:text-primary cursor-pointer",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 rounded"
              )}
            >
              <Unlock className="h-3 w-3" strokeWidth={2} />
              Take Control
            </button>
          )}
        </div>
        <div className="mt-3 flex flex-col gap-3">
          {currentOrder === null ? (
            <Button
              variant="primary"
              size="lg"
              className="w-full"
              disabled={pending !== null}
              onClick={() => setConfirmKind("start")}
            >
              <Play className="h-5 w-5" strokeWidth={2} />
              Start
            </Button>
          ) : (
            <>
              {isFinished ? (
                <p className="text-body text-muted-2 py-2">Session finished.</p>
              ) : (
                <>
                  <Button
                    variant="primary"
                    size="lg"
                    className="w-full"
                    disabled={isLastItem || pending !== null}
                    onClick={() => run("next", () => next(max))}
                  >
                    Next
                    <ChevronRight className="h-5 w-5" strokeWidth={2} />
                  </Button>
                  {isLastItem && (
                    <Button
                      variant="danger"
                      size="lg"
                      className="w-full"
                      disabled={pending !== null}
                      onClick={() => setConfirmKind("finish")}
                    >
                      <Square className="h-5 w-5" strokeWidth={2} />
                      Finish Session
                    </Button>
                  )}
                </>
              )}
              <div className="flex items-center gap-3">
                <Button
                  variant="secondary"
                  size="md"
                  className="flex-1"
                  onClick={() => run("previous", () => previous(min))}
                  disabled={currentOrder === min || pending !== null}
                >
                  <ChevronLeft className="h-4 w-4" strokeWidth={2} />
                  Previous
                </Button>
                <Button
                  variant="secondary"
                  size="md"
                  className="flex-1"
                  onClick={() => run("hold", togglePause, state.pausedAt ? "resumed the show" : "put the show on Hold")}
                  disabled={pending !== null}
                  aria-label={state.pausedAt ? "Resume" : "Hold"}
                >
                  {state.pausedAt ? (
                    <Play className="h-4 w-4" strokeWidth={2} />
                  ) : (
                    <Pause className="h-4 w-4" strokeWidth={2} />
                  )}
                  {state.pausedAt ? "Resume" : "Hold"}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="border-t border-white/5 pt-8">
        <JumpControl max={max} />
      </div>

      <div className="border-t border-white/5 pt-8">
        <AlertComposer />
      </div>

      <OperatorBroadcastPanel />

      <div className="border-t border-white/5 pt-8">
        <ActivityLog />
      </div>

      <ConfirmDialog
        open={confirmKind === "start"}
        title="Start the session?"
        description="This puts the first item live on every connected display."
        confirmLabel="Start"
        loading={pending === "start"}
        onConfirm={async () => {
          await run("start", start, "started the session");
          setConfirmKind(null);
        }}
        onCancel={() => setConfirmKind(null)}
      />

      <ConfirmDialog
        open={confirmKind === "finish"}
        title="Finish the session?"
        description="This marks the session complete on every connected display. You can still use Previous to go back."
        confirmLabel="Finish Session"
        loading={pending === "finish"}
        tone="danger"
        onConfirm={async () => {
          await run("finish", () => finish(max), "finished the session");
          setConfirmKind(null);
        }}
        onCancel={() => setConfirmKind(null)}
      />

      <ConfirmDialog
        open={confirmKind === "takeover"}
        title="Take over control?"
        description="Another operator is currently driving the show. Taking over lets you use Next/Previous/Hold/Jump/Start/Finish here — they won't be able to until they take control back."
        confirmLabel="Take Over"
        loading={takingOver}
        tone="danger"
        onConfirm={async () => {
          setTakingOver(true);
          const ok = await claimControl(true);
          setTakingOver(false);
          setConfirmKind(null);
          if (ok) broadcastAction("took control");
          else toast.error("Couldn't take control — try again");
        }}
        onCancel={() => setConfirmKind(null)}
      />
    </div>
  );
}
