"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Check, Loader2 } from "lucide-react";
import { useSessions } from "@/lib/use-sessions";
import { getLastActionStatus, useEventStore } from "@/lib/store";
import { useControlLock } from "@/lib/use-control-lock";
import { useControllerName } from "@/lib/use-controller-name";
import { useEventId, useIsOwner } from "@/lib/event-context";
import {
  activeSessionHasStarted,
  classifySwitchFailure,
  switchFailureMessage,
  switchPreflight,
} from "@/lib/session-switch";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Target = { id: string; label: string };

type Notice = {
  tone: "info" | "error";
  text: string;
  /** The session the notice is about, so its row can show "Not switched". */
  targetId?: string;
  /** The one legitimate next step, if there is one. */
  action?: { kind: "take-control" | "take-over"; target: Target };
};

export type SessionSwitchDialog =
  | { kind: "confirm-switch"; target: Target }
  | { kind: "take-over"; target: Target; controllerName: string | null };

// All of the picker's state and server calls, owned by SessionPopover
// (which outlives the popover's content) so a confirm dialog or an
// in-flight switch survives the popover panel closing underneath it.
//
// The switch itself is sent at most once per operator action. Nothing here
// retries a selectSession whose outcome is unknown; lib/store.tsx's own
// bounded retry only covers a 409 version conflict, which is a refused
// write, not an uncertain one.
export function useSessionSwitch({ onSwitched }: { onSwitched: () => void }) {
  const eventId = useEventId();
  const isOwner = useIsOwner();
  const { state, selectSession, claimControl } = useEventStore();
  const { iHaveControl, lockedByOther } = useControlLock(state);
  const controllerName = useControllerName(eventId, lockedByOther ? state.controllerId : null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [dialog, setDialog] = useState<SessionSwitchDialog | null>(null);
  const [claiming, setClaiming] = useState(false);
  const busyRef = useRef(false);
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const send = useCallback(
    async (target: Target) => {
      if (busyRef.current) return;
      busyRef.current = true;
      setPendingId(target.id);
      setNotice(null);
      const ok = await selectSession(target.id);
      const status = getLastActionStatus(eventId);
      busyRef.current = false;
      if (!mountedRef.current) return;
      setPendingId(null);
      if (ok) {
        onSwitched();
        return;
      }
      const failure = classifySwitchFailure(status);
      setNotice({
        tone: "error",
        text: switchFailureMessage(failure),
        targetId: target.id,
        action:
          failure.kind === "control-refused" ? { kind: lockedByOther ? "take-over" : "take-control", target } : undefined,
      });
    },
    [eventId, lockedByOther, onSwitched, selectSession]
  );

  const request = useCallback(
    (target: Target) => {
      if (busyRef.current || claiming || target.id === state.activeSessionId) return;
      const preflight = switchPreflight({ isOwner, iHaveControl, lockedByOther });
      switch (preflight.kind) {
        case "read-only":
          setNotice({ tone: "error", targetId: target.id, text: "Only the event owner can change the live session." });
          return;
        case "needs-control":
          setNotice({
            tone: "info",
            targetId: target.id,
            text: "Changing the live session needs control of the show. No one has control right now.",
            action: { kind: "take-control", target },
          });
          return;
        case "held-by-other":
          setNotice({
            tone: "error",
            targetId: target.id,
            text: `${controllerName ?? "Another operator"} has control. Only the operator with control can change the live session.`,
            action: { kind: "take-over", target },
          });
          return;
        case "ready":
          if (activeSessionHasStarted(state)) setDialog({ kind: "confirm-switch", target });
          else void send(target);
      }
    },
    [claiming, controllerName, iHaveControl, isOwner, lockedByOther, send, state]
  );

  // Claims the lease (force only after the take-over confirm), then sends
  // the switch the operator already chose — once. If the claim fails, no
  // switch is sent.
  const claimThenSend = useCallback(
    async (target: Target, force: boolean) => {
      setClaiming(true);
      setNotice(null);
      const claimed = await claimControl(force);
      if (!mountedRef.current) return;
      setClaiming(false);
      if (!claimed) {
        setNotice({
          tone: "error",
          targetId: target.id,
          text: "Not switched. Couldn't take control; another operator may have just taken it.",
        });
        return;
      }
      await send(target);
    },
    [claimControl, send]
  );

  return {
    activeSessionId: state.activeSessionId,
    progressBySession: state.progressBySession,
    readOnly: !isOwner,
    pendingId,
    claiming,
    notice,
    dialog,
    request,
    takeControl: (target: Target) => void claimThenSend(target, false),
    askTakeOver: (target: Target) => setDialog({ kind: "take-over", target, controllerName }),
    confirmDialog: () => {
      const current = dialog;
      setDialog(null);
      if (!current) return;
      if (current.kind === "confirm-switch") void send(current.target);
      else void claimThenSend(current.target, true);
    },
    cancelDialog: () => setDialog(null),
    clearNotice: () => setNotice(null),
  };
}

export type SessionSwitchController = ReturnType<typeof useSessionSwitch>;

export function SessionSwitcher({ controller }: { controller: SessionSwitchController }) {
  const sessions = useSessions();
  const { activeSessionId, progressBySession, pendingId, claiming, notice, readOnly } = controller;
  const listRef = useRef<HTMLUListElement>(null);
  const busy = pendingId !== null || claiming;

  // Land keyboard focus on the current session (or the first one) when the
  // picker opens, so arrow keys work straight away.
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const target = list.querySelector<HTMLButtonElement>('[aria-current="true"]') ?? list.querySelector("button");
    target?.focus();
  }, []);

  function onListKeyDown(e: KeyboardEvent<HTMLUListElement>) {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) return;
    const buttons = Array.from(listRef.current?.querySelectorAll<HTMLButtonElement>("button[data-session-option]") ?? []);
    if (buttons.length === 0) return;
    e.preventDefault();
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const next =
      e.key === "Home"
        ? 0
        : e.key === "End"
          ? buttons.length - 1
          : (index + (e.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length;
    buttons[next]?.focus();
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="px-1 text-console-meta text-muted-2">Live session: changes what every display shows</p>
      <ul
        ref={listRef}
        onKeyDown={onListKeyDown}
        aria-label="Sessions"
        aria-busy={busy}
        className="flex max-h-[min(20rem,60vh)] flex-col gap-1 overflow-y-auto overscroll-contain p-1"
      >
        {sessions.map((s) => {
          const label = `${s.dayLabel} ${s.sessionLabel}`;
          const active = s.id === activeSessionId;
          const pending = s.id === pendingId;
          const refused = notice?.tone === "error" && notice.targetId === s.id;
          const progress = progressBySession[s.id];
          const inProgress = active && progress != null && progress.currentOrder !== null;
          const unavailable = readOnly || (busy && !pending);
          const status = pending
            ? "Switching…"
            : active
              ? inProgress
                ? "Live · in progress"
                : "Live"
              : refused
                ? "Not switched"
                : null;
          return (
            <li key={s.id}>
              <button
                type="button"
                data-session-option
                onClick={() => controller.request({ id: s.id, label })}
                aria-current={active ? "true" : undefined}
                aria-disabled={unavailable || undefined}
                aria-label={`${label}${status ? `, ${status}` : ""}`}
                className={cn(
                  "flex w-full items-center gap-3 rounded-control border px-3 py-2 text-left min-h-11",
                  "transition-[background-color,border-color] duration-[110ms] ease-out",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-card",
                  active
                    ? "bg-raised border-line"
                    : refused
                      ? "border-status-red/40 bg-status-red/5"
                      : "border-transparent hover:bg-card-hover",
                  unavailable && !active ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
                )}
              >
                <span className="flex h-4 w-4 shrink-0 items-center justify-center" aria-hidden="true">
                  {pending ? (
                    <Loader2 className="h-4 w-4 animate-spin text-muted" strokeWidth={2} />
                  ) : active ? (
                    <Check className="h-4 w-4 text-primary" strokeWidth={2.25} />
                  ) : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={cn("block text-console-sm font-medium", active ? "text-primary" : "text-muted")}>
                    {s.dayLabel}
                  </span>
                  <span className={cn("block text-console-meta", active ? "text-muted" : "text-muted-2")}>
                    {s.sessionLabel}
                  </span>
                </span>
                {status && (
                  <span
                    className={cn(
                      "flex shrink-0 items-center gap-1.5 text-console-meta",
                      refused ? "text-status-red" : inProgress ? "text-status-green" : "text-muted-2"
                    )}
                  >
                    {inProgress && <span className="h-1.5 w-1.5 rounded-full bg-status-green" aria-hidden="true" />}
                    {status}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      {readOnly && (
        <p className="px-1 text-console-meta text-muted-2">Only the event owner can change the live session.</p>
      )}

      <div aria-live="polite" role="status">
        {notice && (
          <div
            className={cn(
              "rounded-control border px-3 py-2.5",
              notice.tone === "error" ? "border-status-red/30 bg-status-red/8" : "border-line-soft bg-raised/60"
            )}
          >
            <p className={cn("text-console-sm", notice.tone === "error" ? "text-status-red" : "text-primary")}>
              {notice.text}
            </p>
            {notice.action && (
              <div className="mt-2 flex flex-wrap gap-2">
                {notice.action.kind === "take-control" ? (
                  <Button
                    size="sm"
                    variant="primary"
                    loading={claiming}
                    onClick={() => notice.action && controller.takeControl(notice.action.target)}
                  >
                    Take control and show {notice.action.target.label}
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="warning"
                    loading={claiming}
                    onClick={() => notice.action && controller.askTakeOver(notice.action.target)}
                  >
                    Take over…
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
