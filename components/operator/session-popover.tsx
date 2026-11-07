"use client";

import { useCallback, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import { useEventStore } from "@/lib/store";
import { useSessions } from "@/lib/use-sessions";
import { getSessionById } from "@/lib/data/sessions";
import { Popover } from "@/components/ui/popover";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { SessionSwitcher, useSessionSwitch } from "@/components/operator/session-switcher";
import { cn } from "@/lib/utils";

// Kramflow UI Shell v1 (Phase 4): Console previously rendered
// SessionSwitcher unconditionally in its own full-width, bordered row
// below the header — a third permanent band of chrome on the one screen
// that had it, and the exact "session context becomes a permanent wall"
// pattern the shell redesign was asked to avoid. This wraps SessionSwitcher
// behind a compact trigger that always shows the current day and session,
// so context is visible at a glance without the full session list
// competing for space until the operator actually wants to switch.
//
// The switch state lives here rather than in the popover's content so it
// survives the panel closing, and the confirm dialogs are portalled to
// <body>: the header's backdrop-filter makes it the containing block for
// position:fixed descendants, which used to squeeze the "Switch session?"
// dialog into the 105px header band with its title cut off.
export function SessionPopover() {
  const { state } = useEventStore();
  const sessions = useSessions();
  const session = getSessionById(sessions, state.activeSessionId);
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Close only once the server has confirmed the switch, and hand focus
  // back to the trigger, which now names the new session.
  const onSwitched = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);
  const controller = useSessionSwitch({ onSwitched });

  function onOpenChange(next: boolean) {
    // A click inside a portalled dialog counts as "outside" the popover, and
    // an in-flight switch must stay visible until it resolves.
    if (!next && (controller.dialog !== null || controller.pendingId !== null || controller.claiming)) return;
    setOpen(next);
    if (!next) controller.clearNotice();
  }

  const dialog = controller.dialog;

  return (
    <>
      <Popover
        align="start"
        open={open}
        onOpenChange={onOpenChange}
        className="w-[min(calc(100vw-1.5rem),22rem)] p-2"
        trigger={({ open: isOpen, toggle }) => (
          <button
            ref={triggerRef}
            type="button"
            onClick={toggle}
            aria-haspopup="true"
            aria-expanded={isOpen}
            aria-label={`Live session: ${session ? `${session.dayLabel} ${session.sessionLabel}` : "none selected"}. Change the live session`}
            className="flex items-center gap-1.5 rounded-control border border-line-soft bg-raised/60 px-2.5 py-1.5 text-console-sm text-primary hover:bg-card-hover transition-colors max-w-[12rem] sm:max-w-[18rem]"
          >
            <span className="truncate">{session ? `${session.dayLabel} · ${session.sessionLabel}` : "Select session"}</span>
            <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 transition-transform", isOpen && "rotate-180")} strokeWidth={2} />
          </button>
        )}
      >
        <SessionSwitcher controller={controller} />
      </Popover>

      {dialog &&
        createPortal(
          dialog.kind === "confirm-switch" ? (
            <ConfirmDialog
              open
              title={`Switch to ${dialog.target.label}?`}
              description="The current session has already started. Switching changes what's live on every connected display."
              confirmLabel="Switch Session"
              tone="danger"
              onConfirm={controller.confirmDialog}
              onCancel={controller.cancelDialog}
            />
          ) : (
            <ConfirmDialog
              open
              title={`Take over and show ${dialog.target.label}?`}
              description={`${dialog.controllerName ?? "Another operator"} is currently driving the show. Taking over moves control to this screen and switches every connected display to ${dialog.target.label}. They won't be able to control the show until they take control back.`}
              confirmLabel="Take Over and Switch"
              tone="danger"
              onConfirm={controller.confirmDialog}
              onCancel={controller.cancelDialog}
            />
          ),
          document.body
        )}
    </>
  );
}
