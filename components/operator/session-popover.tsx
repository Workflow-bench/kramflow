"use client";

import { ChevronDown } from "lucide-react";
import { useEventStore } from "@/lib/store";
import { useSessions } from "@/lib/use-sessions";
import { getSessionById } from "@/lib/data/sessions";
import { Popover } from "@/components/ui/popover";
import { SessionSwitcher } from "@/components/operator/session-switcher";
import { cn } from "@/lib/utils";

// Kramflow UI Shell v1 (Phase 4): Console previously rendered
// SessionSwitcher unconditionally in its own full-width, bordered row
// below the header — a third permanent band of chrome on the one screen
// that had it, and the exact "session context becomes a permanent wall"
// pattern the shell redesign was asked to avoid. This wraps the same,
// completely unmodified SessionSwitcher (same click-to-switch, same
// locked-by-other toast, same in-progress confirm dialog — zero behavior
// changes) behind a compact trigger that always shows the current day and
// session, so context is visible at a glance without the full session
// list competing for space until the operator actually wants to switch.
export function SessionPopover() {
  const { state } = useEventStore();
  const sessions = useSessions();
  const session = getSessionById(sessions, state.activeSessionId);

  return (
    <Popover
      align="start"
      className="w-[min(92vw,28rem)] p-2"
      trigger={({ open, toggle }) => (
        <button
          type="button"
          onClick={toggle}
          aria-haspopup="true"
          aria-expanded={open}
          className="flex items-center gap-1.5 rounded-control border border-line-soft bg-raised/60 px-2.5 py-1.5 text-console-sm text-primary hover:bg-card-hover transition-colors max-w-[12rem] sm:max-w-[18rem]"
        >
          <span className="truncate">{session ? `${session.dayLabel} · ${session.sessionLabel}` : "Select session"}</span>
          <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 transition-transform", open && "rotate-180")} strokeWidth={2} />
        </button>
      )}
    >
      <SessionSwitcher />
    </Popover>
  );
}
