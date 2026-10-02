"use client";

import { useEffect, useRef, useState } from "react";
import { useSessions } from "@/lib/use-sessions";
import { useEventStore } from "@/lib/store";
import { useControlLock } from "@/lib/use-control-lock";
import { useEventRole } from "@/lib/event-context";
import { ConfirmDialog, useConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

/**
 * Picks a session as the live one. Every sequencing action, this one
 * included, needs an active control claim (see LOCKED_ACTIONS in
 * app/api/live/route.ts). On a fresh event nobody holds the claim yet and the
 * Take Control button only exists once a session is chosen, so a bare
 * selectSession() failed with a silent 423 and the show could never start.
 * This claims control first when nobody else holds it, and says so when
 * anything fails.
 */
export function useSelectSession() {
  const { state, selectSession, claimControl } = useEventStore();
  const { iHaveControl, lockedByOther } = useControlLock(state);
  const role = useEventRole();
  const toast = useToast();

  return async function trySelectSession(sessionId: string) {
    if (role !== "owner") {
      toast.error("Only the event owner can run the show.");
      return;
    }
    if (lockedByOther) {
      toast.error("Locked by another operator", { label: "Take Over", onClick: () => claimControl(true) });
      return;
    }
    if (!iHaveControl && !(await claimControl())) {
      toast.error("Couldn't take control. Try again.");
      return;
    }
    if (!(await selectSession(sessionId))) toast.error("Couldn't switch session. Try again.");
  };
}

export function SessionSwitcher() {
  const { state } = useEventStore();
  const trySelectSession = useSelectSession();
  const sessions = useSessions();
  const switchConfirm = useConfirmDialog<{ id: string; label: string }>();
  const scrollRef = useRef<HTMLDivElement>(null);
  // At narrower widths
  // (the operator dashboard's own 1250-1440px band, or any width once
  // zoomed) not every session pill fits, and overflow-x-auto alone gives
  // no visible sign there's more to scroll to. Only rendered once there
  // really is overflow, not as a permanent decoration.
  const [hasOverflow, setHasOverflow] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const check = () => setHasOverflow(el.scrollWidth > el.clientWidth + 1);
    check();
    const observer = new ResizeObserver(check);
    observer.observe(el);
    el.addEventListener("scroll", check);
    return () => {
      observer.disconnect();
      el.removeEventListener("scroll", check);
    };
  }, [sessions.length]);

  // `?.currentOrder !== null` is true when there is no active session at all
  // (undefined !== null), which made a fresh event claim "the current session
  // has already started". Progress exists only when an entry is present.
  const activeProgress = state.progressBySession[state.activeSessionId];
  const currentSessionHasProgress = activeProgress != null && activeProgress.currentOrder !== null;

  function handleClick(sessionId: string, label: string) {
    if (sessionId === state.activeSessionId) return;
    if (currentSessionHasProgress) {
      switchConfirm.request({ id: sessionId, label });
    } else {
      trySelectSession(sessionId);
    }
  }

  return (
    <div className="relative min-w-0">
      <div ref={scrollRef} className="flex gap-1.5 overflow-x-auto pb-1">
        {sessions.map((s) => {
          const active = s.id === state.activeSessionId;
          const progress = state.progressBySession[s.id];
          // `active` is required, not just recorded progress — without it,
          // *every* session ever started stayed marked "(in progress)"
          // forever, including ones the operator moved on from hours ago.
          // Confirmed live: Friday Evening and Saturday Morning both read
          // "(in progress)" simultaneously despite only one being the
          // session actually live on every display (2026-09-01 UI/UX audit
          // finding #14 — reproduced exactly, not overstated).
          const isLive = active && progress && progress.currentOrder !== null && progress.currentOrder <= s.items.length;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => handleClick(s.id, `${s.dayLabel} ${s.sessionLabel}`)}
              aria-current={active ? "true" : undefined}
              aria-label={`${s.dayLabel} ${s.sessionLabel}${isLive ? " (in progress)" : ""}`}
              className={cn(
                "shrink-0 rounded-control border px-2.5 py-1.5 text-left cursor-pointer",
                "transition-[background-color,border-color] duration-[110ms] ease-out",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                // The switcher changes what every display in the venue is
                // showing, so the current session is stated with a border
                // as well as a fill — at a glance, from a metre away, a
                // fill alone was too easy to misread on this dark ground.
                active ? "bg-raised border-line" : "border-transparent hover:bg-card-hover"
              )}
            >
              <span className="flex items-center gap-1.5">
                <span className={cn("text-console-meta font-medium", active ? "text-primary" : "text-muted")}>
                  {s.dayLabel}
                </span>
                {isLive && (
                  <span className="h-1.5 w-1.5 rounded-full bg-status-green" aria-hidden="true" />
                )}
              </span>
              <p className={cn("text-console-meta", active ? "text-muted" : "text-muted-2")}>{s.sessionLabel}</p>
            </button>
          );
        })}
      </div>

      {hasOverflow && (
        <div
          className="pointer-events-none absolute top-0 right-0 bottom-1 w-10 bg-gradient-to-l from-background to-transparent"
          aria-hidden="true"
        />
      )}

      <ConfirmDialog
        open={switchConfirm.isOpen}
        title={`Switch to ${switchConfirm.pending?.label}?`}
        description="The current session has already started. Switching changes what's live on every connected display."
        confirmLabel="Switch Session"
        tone="danger"
        onConfirm={() => {
          if (switchConfirm.pending) trySelectSession(switchConfirm.pending.id);
          switchConfirm.cancel();
        }}
        onCancel={switchConfirm.cancel}
      />
    </div>
  );
}
