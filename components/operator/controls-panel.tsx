"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, Pause, Play, Square, ChevronRight, HelpCircle } from "lucide-react";
import { useEventStore } from "@/lib/store";
import { useDisplayEngine } from "@/lib/display-engine/store";
import { useKeyboardShortcuts } from "@/lib/display-engine/use-keyboard-shortcuts";
import { useControlLock } from "@/lib/use-control-lock";
import { useControllerName } from "@/lib/use-controller-name";
import { useEventRole, useEventId, useIsOwner } from "@/lib/event-context";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { SectionLabel } from "@/components/ui/section-label";
import { Tooltip } from "@/components/ui/tooltip";
import { ControlLeaseStatus } from "@/components/ui/control-lease-status";
import { TargetHealthSummary } from "@/components/display-engine/target-health-summary";
import { SessionReadiness } from "./session-readiness";
import { JumpControl } from "./jump-control";
import { AlertComposer } from "./alert-composer";
import { ActivityLog } from "./activity-log";
import { OperatorBroadcastPanel } from "@/components/display-engine/operator-broadcast-panel";
import { useToast } from "@/components/ui/toast";
import type { Session } from "@/lib/types";

const FAILURE_MESSAGE: Record<string, string> = {
  next: "Couldn't advance to the next item. Try again.",
  previous: "Couldn't go back. Try again.",
  hold: "Couldn't toggle Hold. Try again.",
  start: "Couldn't start the session. Try again.",
  finish: "Couldn't finish the session. Try again.",
};

type ConfirmKind = "start" | "finish" | "takeover" | null;

export function ControlsPanel({
  session,
  broadcastAction,
  hideSecondaryTools = false,
}: {
  session: Session;
  /** Tells other connected /operator tabs what just happened here — see
   *  lib/use-operator-presence.ts and R2-BUG-1 (a Hold silently cleared by
   *  another tab's Next, with no indication to either operator). */
  broadcastAction: (message: string) => void;
  /** Mobile-only: Jump/Alert/Broadcast/Activity render separately via
   *  <ControlsSecondaryTools> further down the page instead of inline here
   *  — see operator/page.tsx's mobile ordering comment for why. Desktop/
   *  tablet never pass this, so their layout is unchanged. */
  hideSecondaryTools?: boolean;
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
  // 2026-09 permission-truth consolidation — same check Remote/Displays/
  // Broadcast now all share via useIsOwner() (lib/event-context.tsx), so
  // this and every other "is this owner-only" check stay in sync by
  // construction instead of independently re-deriving role !== "owner".
  const readOnly = !useIsOwner();
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

  // "Control lost" — Doherty threshold for the one transition that isn't
  // already announced anywhere: claim/release/take-over each already
  // surface their own success/failure directly at the button that
  // triggered them, but *being* taken over from was previously silent
  // (the strip below just quietly swapped to "locked by other" on its
  // own). `intentionalReleaseRef` is set synchronously in onRelease's own
  // click handler below so a deliberate Release never doubles up with
  // this — everything else that flips iHaveControl false (another
  // operator's Take Over, or this claim simply going stale) genuinely is
  // unannounced elsewhere and gets one here.
  const intentionalReleaseRef = useRef(false);
  const hadControlRef = useRef(iHaveControl);
  useEffect(() => {
    if (hadControlRef.current && !iHaveControl && !intentionalReleaseRef.current) {
      toast.info(controllerName ? `${controllerName} took over control.` : "You lost control.");
    }
    intentionalReleaseRef.current = false;
    hadControlRef.current = iHaveControl;
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
          toast.error(FAILURE_MESSAGE[kind] ?? "That didn't work. Try again.");
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
      {/* One grouped instrument, not four loosely-stacked pieces (spec:
          "grouping," Uniform Connectedness) — ownership state sits
          directly against the transport buttons it governs (Law of
          Proximity) inside a single bordered surface, instead of a plain
          heading followed by a loose link followed by buttons. */}
      <div className="rounded-panel border border-line-soft bg-card/40 p-4 flex flex-col gap-4">
        <div className="flex items-center gap-1.5">
          <SectionLabel>Controls</SectionLabel>
          {/* Shortcuts demoted to a tooltip rather than sitting inline next
              to the section title (spec: "don't let shortcut text compete
              with the section title") — still one glance away, not gone.
              Placed directly beside the label, not pushed to the row's far
              edge (no justify-between) — Tooltip always centers its
              content under its trigger with no built-in edge-collision
              handling, so a right-flush trigger this close to Controls'
              own floor (280px, CONTROLS_MIN) or the shared tablet column
              (380px) pushed the tooltip's own span, invisible but still
              real, past the viewport edge and into document.documentElement
              .scrollWidth. Anchored near the label instead, it has room on
              both sides regardless of column width. */}
          {currentOrder !== null && !isFinished && (
            <Tooltip content="← → Next/Prev · H Hold">
              <button
                type="button"
                aria-label="Keyboard shortcuts"
                className="text-muted-2 hover:text-primary cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-control p-1 transition-colors"
              >
                <HelpCircle className="h-3.5 w-3.5" strokeWidth={2} />
              </button>
            </Tooltip>
          )}
        </div>

        {/* Opt-in sequencing lock (see lib/types.ts's LiveState.controllerId
            doc comment) — unclaimed still lets a solo operator drive the
            show with nothing claimed, same as before this existed.
            QA_REPORT_ROUND2.md R2-BUG-1: this exists because two /operator
            tabs could otherwise drive the same show with a plain Next
            silently clearing another tab's just-set Hold. */}
        <ControlLeaseStatus
          role={role}
          iHaveControl={iHaveControl}
          lockedByOther={lockedByOther}
          controllerName={controllerName}
          busy={claimingOrReleasing}
          onRelease={async () => {
            intentionalReleaseRef.current = true;
            setClaimingOrReleasing(true);
            const ok = await releaseControl();
            setClaimingOrReleasing(false);
            if (!ok) {
              intentionalReleaseRef.current = false;
              toast.error("Couldn't release control. Try again.");
            }
          }}
          onTakeControl={async () => {
            setClaimingOrReleasing(true);
            const ok = await claimControl();
            setClaimingOrReleasing(false);
            if (ok) broadcastAction("took control");
            else toast.error("Couldn't take control. Try again.");
          }}
          onTakeOver={() => setConfirmKind("takeover")}
        />

        {/* "IS THIS SESSION READY TO GO LIVE?" — a pre-show question,
            answered once here and never again once the session has
            actually started (currentOrder !== null): re-flagging "the cue
            sheet is empty" mid-show would be noise, since by definition
            it isn't anymore. See lib/readiness.ts for what's checked and
            why collaborator access is deliberately not one of them. */}
        {currentOrder === null && <SessionReadiness session={session} registry={engine.registry} />}

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
          <TargetHealthSummary target={{ kind: "all" }} registry={engine.registry} groups={engine.groups} />
        )}

        <div className="flex flex-col gap-3">
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

      {!hideSecondaryTools && (
        <>
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
        </>
      )}

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
        description={`${controllerName ?? "Another operator"} is currently driving the show. Taking over lets you use Next, Previous, Hold, Jump, Start, and Finish here instead. They won't be able to until they take control back.`}
        confirmLabel="Take Over"
        loading={takingOver}
        tone="danger"
        onConfirm={async () => {
          setTakingOver(true);
          const ok = await claimControl(true);
          setTakingOver(false);
          setConfirmKind(null);
          if (ok) broadcastAction("took control");
          else toast.error("Couldn't take control. Try again.");
        }}
        onCancel={() => setConfirmKind(null)}
      />
    </div>
  );
}

// Mobile-only placement of Jump/Alert/Broadcast/Activity, positioned lower
// on the page (see operator/page.tsx) than the primary transport controls —
// see this file's ControlsPanel hideSecondaryTools prop comment. Each of
// these is already a fully self-contained component with no dependency on
// ControlsPanel's own local state (claim/release/pending/etc.), so this is
// a plain re-render, not a second copy of any control logic.
export function ControlsSecondaryTools({ session }: { session: Session }) {
  return (
    <div className="flex flex-col gap-10">
      <JumpControl max={session.items.length} />
      <div className="border-t border-line-soft pt-8">
        <AlertComposer />
      </div>
      <OperatorBroadcastPanel />
      <div className="border-t border-line-soft pt-8">
        <ActivityLog />
      </div>
    </div>
  );
}
