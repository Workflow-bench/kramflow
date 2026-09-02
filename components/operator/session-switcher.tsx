"use client";

import { useEffect, useRef, useState } from "react";
import { useSessions } from "@/lib/use-sessions";
import { useEventStore } from "@/lib/store";
import { useControlLock } from "@/lib/use-control-lock";
import { ConfirmDialog, useConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

export function SessionSwitcher() {
  const { state, selectSession, claimControl } = useEventStore();
  const { lockedByOther } = useControlLock(state);
  const toast = useToast();
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

  const currentSessionHasProgress = state.progressBySession[state.activeSessionId]?.currentOrder !== null;

  // selectSession is one of app/api/live/route.ts's LOCKED_ACTIONS — switching
  // the active session out from under whoever holds the control lock is
  // exactly the kind of clobber it exists to prevent. Same escape hatch as
  // components/operator/controls-panel.tsx's sequencing buttons.
  function trySelectSession(sessionId: string) {
    if (lockedByOther) {
      toast.error("Locked by another operator", { label: "Take Over", onClick: () => claimControl(true) });
      return;
    }
    selectSession(sessionId);
  }

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
