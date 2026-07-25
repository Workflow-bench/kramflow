"use client";

import { useRef, useState } from "react";
import { ChevronLeft, Pause, Play, Square, ChevronRight } from "lucide-react";
import { useEventStore } from "@/lib/store";
import { useKeyboardShortcuts } from "@/lib/display-engine/use-keyboard-shortcuts";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { SectionLabel } from "@/components/tv/section-label";
import { JumpControl } from "./jump-control";
import { AlertComposer } from "./alert-composer";
import { ActivityLog } from "./activity-log";
import { OperatorBroadcastPanel } from "@/components/display-engine/operator-broadcast-panel";
import type { Session } from "@/lib/types";

type ConfirmKind = "start" | "finish" | null;

export function ControlsPanel({ session }: { session: Session }) {
  const { state, start, next, previous, finish, togglePause } = useEventStore();
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
  const runningRef = useRef(false);

  async function run(kind: NonNullable<typeof pending>, action: () => Promise<unknown> | unknown) {
    if (runningRef.current) return;
    runningRef.current = true;
    setPending(kind);
    try {
      await action();
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
        if (!isLastItem && pending === null) run("next", () => next(max));
      },
      ArrowLeft: () => {
        if (currentOrder !== min && pending === null) run("previous", () => previous(min));
      },
      h: () => {
        if (pending === null) run("hold", togglePause);
      },
      H: () => {
        if (pending === null) run("hold", togglePause);
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
                  onClick={() => run("hold", togglePause)}
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
          await run("start", start);
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
          await run("finish", () => finish(max));
          setConfirmKind(null);
        }}
        onCancel={() => setConfirmKind(null)}
      />
    </div>
  );
}
