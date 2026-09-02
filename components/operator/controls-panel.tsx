"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, Pause, Play, Square, ChevronRight } from "lucide-react";
import { useEventStore } from "@/lib/store";
import { useDisplayEngine } from "@/lib/display-engine/store";
import { useKeyboardShortcuts } from "@/lib/display-engine/use-keyboard-shortcuts";
import { useControlLock } from "@/lib/use-control-lock";
import { useControllerName } from "@/lib/use-controller-name";
import { useEventRole, useEventId } from "@/lib/event-context";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { SectionLabel } from "@/components/ui/section-label";
import { ControlLeaseStatus } from "@/components/ui/control-lease-status";
import { TargetHealthSummary } from "@/components/display-engine/target-health-summary";
import { JumpControl } from "./jump-control";
import { AlertComposer } from "./alert-composer";
import { ActivityLog } from "./activity-log";
import { OperatorBroadcastPanel } from "@/components/display-engine/operator-broadcast-panel";
import { useToast } from "@/components/ui/toast";
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
  const { state: engine } = useDisplayEngine();
  // Report finding #26 — "can-edit vs. can-go-live": an editor/viewer
  // collaborator can see this screen but every one of these actions 403s
  // server-side (app/api/live/route.ts's requireEventAccess(..., "owner")),
  // since running the live show is owner-only. Disabling here is the
  // courtesy layer so that shows up as a clear, upfront "you can't do this"
  // instead of a click-and-fail loop.
  const role = useEventRole();
  const readOnly = role !== "owner";
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
  // Plain (uncontested) claim/release — distinct from `takingOver` because
  // that one's paired with a ConfirmDialog's own `loading` prop, while
  // these two are a bare inline button each. Added alongside the identical
  // gap in "Take Over" above: the 2026-09-01 audit's KF-004 found this
  // exact button (unlike Next/Previous/Hold, already fixed for R2-BUG-2)
  // still fire-and-forget — a failed claim looked exactly like a successful
  // one, with nothing on screen to tell the two apart.
  const [claimingOrReleasing, setClaimingOrReleasing] = useState(false);
  const runningRef = useRef(false);
  const toast = useToast();
  const { iHaveControl, lockedByOther } = useControlLock(state);
  const eventId = useEventId();
  const controllerName = useControllerName(eventId, lockedByOther ? state.controllerId : null);
  // run() below is async and needs the *current* lockedByOther at the
  // moment a request comes back, not the value closed over when the click
  // fired — an in-flight request outlives the render it started in, and a
  // Realtime push telling this tab someone else now holds the lock can
  // land during that request. A plain ref read (not the destructured
  // value above) is what makes that live.
  const lockedByOtherRef = useRef(lockedByOther);
  useEffect(() => {
    lockedByOtherRef.current = lockedByOther;
  }, [lockedByOther]);

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
    // server-side regardless, so a stale read here (this tab hasn't gotten
    // the latest Realtime update yet — a real, reachable race, not just
    // theoretical: confirmed live during the multi-operator stress test,
    // clicking within ~1s of another tab's claim) falls through to the
    // action attempt below instead of stopping here.
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
        // By the time the server's 423 comes back, the Realtime push for
        // whoever holds the lock has often *also* landed — re-check rather
        // than always falling back to a generic "try again" that actively
        // misleads (retrying changes nothing while someone else holds the
        // lock). Confirmed live: the stale-read window above is real often
        // enough that this path fires, not just a defensive fallback.
        if (SEQUENCING_KINDS.has(kind) && lockedByOtherRef.current) {
          toast.error("Locked by another operator", { label: "Take Over", onClick: () => setConfirmKind("takeover") });
        } else {
          toast.error(FAILURE_MESSAGE[kind] ?? "That didn't work — try again");
        }
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
    confirmKind === null && currentOrder !== null && !isFinished && !readOnly
  );

  return (
    <div className="flex flex-col gap-10">
      <div>
        <div className="flex items-center justify-between gap-3">
          <SectionLabel>Controls</SectionLabel>
          {currentOrder !== null && !isFinished && (
            <p className="text-console-meta text-muted-2 tabular-nums">← → Next/Prev · H Hold</p>
          )}
        </div>

        {/* Opt-in sequencing lock (see lib/types.ts's LiveState.controllerId
            doc comment) — unclaimed shows only a quiet "Take Control" link
            so a single operator's screen looks exactly like it did before
            this existed. QA_REPORT_ROUND2.md R2-BUG-1: this exists because
            two /operator tabs could otherwise drive the same show with a
            plain Next silently clearing another tab's just-set Hold. */}
        <div className="mt-2">
          <ControlLeaseStatus
            role={role}
            iHaveControl={iHaveControl}
            lockedByOther={lockedByOther}
            controllerName={controllerName}
            busy={claimingOrReleasing}
            onRelease={async () => {
              setClaimingOrReleasing(true);
              const ok = await releaseControl();
              setClaimingOrReleasing(false);
              if (!ok) toast.error("Couldn't release control — try again");
            }}
            onTakeControl={async () => {
              setClaimingOrReleasing(true);
              const ok = await claimControl();
              setClaimingOrReleasing(false);
              if (ok) broadcastAction("took control");
              else toast.error("Couldn't take control — try again");
            }}
            onTakeOver={() => setConfirmKind("takeover")}
          />
        </div>

        {/* "IS THE SYSTEM HEALTHY?" — a question this screen had no answer
            to at all before (an operator had to leave Console for Displays
            or Broadcast Center to find out). Reuses TargetHealthSummary
            exactly as Broadcast Center's own pre-send check does, with
            target={{kind:"all"}} standing in for "the whole fleet" — same
            matching/health logic, not a second implementation. Skipped
            entirely (not even an empty state) when nothing has registered
            yet — that's the normal pre-show state, not something worth a
            dashed-box callout in a dense controls column. */}
        {Object.keys(engine.registry).length > 0 && (
          <div className="mt-3">
            <TargetHealthSummary target={{ kind: "all" }} registry={engine.registry} groups={engine.groups} />
          </div>
        )}

        <div className="mt-3 flex flex-col gap-3">
          {currentOrder === null ? (
            <Button
              variant="primary"
              size="lg"
              className="w-full"
              disabled={pending !== null || readOnly}
              onClick={() => setConfirmKind("start")}
            >
              <Play className="h-5 w-5" strokeWidth={2} />
              Start
            </Button>
          ) : (
            <>
              {isFinished ? (
                <p className="text-console-sm text-muted-2 py-2">Session finished.</p>
              ) : (
                <>
                  <Button
                    variant="primary"
                    size="lg"
                    className="w-full"
                    disabled={isLastItem || pending !== null || readOnly}
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
                      disabled={pending !== null || readOnly}
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
                  disabled={currentOrder === min || pending !== null || readOnly}
                >
                  <ChevronLeft className="h-4 w-4" strokeWidth={2} />
                  Previous
                </Button>
                <Button
                  variant="secondary"
                  size="md"
                  className="flex-1"
                  onClick={() => run("hold", togglePause, state.pausedAt ? "resumed the show" : "put the show on Hold")}
                  disabled={isFinished || pending !== null || readOnly}
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

      <div className="border-t border-line-soft pt-8">
        <JumpControl max={max} />
      </div>

      <div className="border-t border-line-soft pt-8">
        <AlertComposer />
      </div>

      <OperatorBroadcastPanel />

      <div className="border-t border-line-soft pt-8">
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
        description={`${controllerName ?? "Another operator"} is currently driving the show. Taking over lets you use Next/Previous/Hold/Jump/Start/Finish here — they won't be able to until they take control back.`}
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
