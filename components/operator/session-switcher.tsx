"use client";

import { useEffect, useRef, useState } from "react";
import { useSessions } from "@/lib/use-sessions";
import { useEventStore } from "@/lib/store";
import { ConfirmDialog, useConfirmDialog } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";

export function SessionSwitcher() {
  const { state, selectSession } = useEventStore();
  const sessions = useSessions();
  const switchConfirm = useConfirmDialog<{ id: string; label: string }>();
  const scrollRef = useRef<HTMLDivElement>(null);
  // QA_REPORT.md BUG-2 / QA_REPORT_ROUND2.md R2-EXT-1: at narrower widths
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

  function handleClick(sessionId: string, label: string) {
    if (sessionId === state.activeSessionId) return;
    if (currentSessionHasProgress) {
      switchConfirm.request({ id: sessionId, label });
    } else {
      selectSession(sessionId);
    }
  }

  return (
    <div className="relative min-w-0">
      <div ref={scrollRef} className="flex gap-1.5 overflow-x-auto pb-1">
        {sessions.map((s) => {
          const active = s.id === state.activeSessionId;
          const progress = state.progressBySession[s.id];
          const isLive = progress && progress.currentOrder !== null && progress.currentOrder <= s.items.length;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => handleClick(s.id, `${s.dayLabel} ${s.sessionLabel}`)}
              aria-current={active ? "true" : undefined}
              aria-label={`${s.dayLabel} ${s.sessionLabel}${isLive ? " (in progress)" : ""}`}
              className={cn(
                "shrink-0 rounded-lg px-3 py-2 text-left transition-colors cursor-pointer",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                active ? "bg-card" : "hover:bg-card/60"
              )}
            >
              <span className="flex items-center gap-1.5">
                <span className={cn("text-caption font-medium", active ? "text-primary" : "text-muted")}>
                  {s.dayLabel}
                </span>
                {isLive && <span className="h-1.5 w-1.5 rounded-full bg-status-green" aria-hidden="true" />}
              </span>
              <p className={cn("text-caption", active ? "text-muted" : "text-muted-2")}>{s.sessionLabel}</p>
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
          if (switchConfirm.pending) selectSession(switchConfirm.pending.id);
          switchConfirm.cancel();
        }}
        onCancel={switchConfirm.cancel}
      />
    </div>
  );
}
