"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, ChevronDown, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDialog, useConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { SectionLabel } from "@/components/ui/section-label";
import { MaybeTooltip } from "@/components/ui/tooltip";
import { useDisplayEngine } from "@/lib/display-engine/store";
import { EMERGENCY_PRESETS, type BroadcastType } from "@/lib/display-engine/types";
import { patchBroadcast, useMessageDrafts } from "@/lib/message-drafts";
import { BROADCAST_TYPE_META } from "@/lib/display-engine/broadcast-style";
import { useEventId, useEventRole } from "@/lib/event-context";
import { cn } from "@/lib/utils";

// The routine quick-send types only — emergency has its own dedicated
// presets below, and "custom" doesn't make sense as a one-tap quick type.
// Colors come from BROADCAST_TYPE_META, the same mapping Broadcast Center
// and the display-side rendering both use, rather than a fourth locally
// hand-tinted copy.
const QUICK_TYPES: BroadcastType[] = ["info", "reminder", "warning", "success"];

/**
 * Quick-send broadcast controls embedded directly in the Operator
 * Dashboard's Controls panel — collapsed by default so it adds zero
 * visual weight until an operator opens it. Covers the common case (a
 * quick message to every display) plus one-tap emergency presets; the
 * full Broadcast Center (/broadcast) stays linked for scheduling,
 * templates, drafts, history, and per-display targeting.
 */
export function OperatorBroadcastPanel({
  section = "all",
  embedded = false,
}: {
  /** F09: the Messages region (components/operator/messages-panel.tsx)
   *  renders the routine form and the emergency presets in different
   *  places; "all" keeps the original combined panel. */
  section?: "all" | "form" | "emergency";
  /** Skip the collapsible wrapper and heading — the host provides them. */
  embedded?: boolean;
} = {}) {
  const eventId = useEventId();
  // Broadcasts are owner-gated server-side (requireEventAccess(eventId,
  // "owner") in api/display-engine/broadcasts/route.ts) — an editor could
  // fill this whole panel out and only discover it 403s on Send. Disabling
  // up front is a courtesy on top of that real boundary, matching the
  // pattern controls-panel.tsx already uses for the transport controls.
  const readOnly = useEventRole() !== "owner";
  const { sendBroadcast, state: engine } = useDisplayEngine();
  const registeredCount = Object.keys(engine.registry).length;
  const toast = useToast();
  const [expanded, setExpanded] = useState(false);
  // Routine form draft lives in the event's Messages store
  // (lib/message-drafts.tsx) so a responsive remount doesn't drop it.
  const { drafts, update, claim, release } = useMessageDrafts();
  const { type, title, message, sending } = drafts.broadcast;
  const setType = (v: BroadcastType) => update(patchBroadcast({ type: v }));
  const setTitle = (v: string) => update(patchBroadcast({ title: v }));
  const setMessage = (v: string) => update(patchBroadcast({ message: v }));
  const emergencyConfirm = useConfirmDialog<(typeof EMERGENCY_PRESETS)[number]>();
  // In the shared store with a claim/release guard, not local state: a rapid
  // multi-click burst fires onConfirm before React disables the button (3
  // clicks -> 3 live emergency broadcasts, QA_REPORT.md BUG-3), and a layout
  // remount mid-send must not re-arm the presets either.
  const emergencySending = drafts.emergencySending;

  async function send() {
    if (!title.trim() || !claim("broadcastSending")) return;
    update(patchBroadcast({ sending: true }));
    let ok = false;
    try {
      const res = await sendBroadcast({
        type,
        title: title.trim(),
        message: message.trim(),
        icon: null,
        priority: 2,
        target: { kind: "all" },
        expiresInMinutes: null,
        durationSeconds: null,
        acknowledgementRequired: false,
        persistent: false,
        scheduledFor: null,
      });
      ok = Boolean(res && res.ok);
    } finally {
      release("broadcastSending");
      update(patchBroadcast({ sending: false, ...(ok ? { title: "", message: "" } : {}) }));
    }
    if (ok) {
      toast.success("Broadcast sent");
    } else {
      toast.error("Couldn't send the broadcast. Try again.");
    }
  }

  const showForm = section !== "emergency";
  const showEmergency = section !== "form";
  const isOpen = embedded || expanded;

  return (
    <div className={embedded ? undefined : "border-t border-line-soft pt-8"}>
      {!embedded && (
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex items-center justify-between w-full cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded"
      >
        <SectionLabel>Broadcast</SectionLabel>
        <ChevronDown
          className={cn("h-4 w-4 text-muted-2 transition-transform", expanded && "rotate-180")}
          strokeWidth={2}
        />
      </button>
      )}

      {isOpen && (
        <div className={cn("flex flex-col gap-3", !embedded && "mt-4")}>
          {showForm && (
          <>
          <div className="flex flex-wrap gap-2">
            {QUICK_TYPES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                aria-pressed={type === t}
                className={cn(
                  "rounded-full px-3 py-1.5 text-console-meta font-semibold uppercase tracking-wide transition-opacity cursor-pointer whitespace-nowrap",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  // Same fix as the Quick alert severities: unselected
                  // options are full-strength neutral, not a 40%-opacity tone.
                  type === t ? BROADCAST_TYPE_META[t].accentClass : "border border-line-soft text-muted hover:text-primary"
                )}
              >
                {BROADCAST_TYPE_META[t].label}
              </button>
            ))}
          </div>

          <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Broadcast title" />
          <Input
            placeholder="Message (optional)"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            aria-label="Broadcast message"
          />

          <MaybeTooltip when={readOnly} content="Only the event owner can send broadcasts">
            <Button
              variant="primary"
              size="sm"
              className="w-full"
              disabled={!title.trim() || sending || readOnly}
              loading={sending}
              onClick={send}
            >
              <Send className="h-4 w-4" strokeWidth={2} />
              Send to All Displays
            </Button>
          </MaybeTooltip>

          <Link
            href={`/e/${eventId}/broadcast`}
            className="text-console-meta text-muted-2 hover:text-primary text-center underline-offset-2 hover:underline"
          >
            More options: schedule, templates, target one display →
          </Link>
          </>
          )}

          {showEmergency && (
          <div className={cn(showForm && "border-t border-line-soft pt-3 mt-1")}>
            <div className="flex flex-wrap gap-2">
              {EMERGENCY_PRESETS.map((preset) => (
                <MaybeTooltip key={preset.label} when={readOnly} content="Only the event owner can send broadcasts">
                  <button
                    type="button"
                    onClick={() => emergencyConfirm.request(preset)}
                    disabled={readOnly || emergencySending}
                    className="flex items-center gap-1.5 rounded-full bg-status-red/15 text-status-red px-3 py-1.5 text-console-meta font-semibold cursor-pointer hover:bg-status-red/25 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-status-red/15"
                  >
                    <AlertTriangle className="h-3.5 w-3.5" strokeWidth={2} />
                    {preset.label}
                  </button>
                </MaybeTooltip>
              ))}
            </div>
          </div>
          )}
        </div>
      )}

      {/* Exact broadcast body + a real target count — see broadcast/page.tsx's
          identical fix for why (KF-031). */}
      <ConfirmDialog
        open={emergencyConfirm.isOpen}
        title={`Send "${emergencyConfirm.pending?.title}" to every display?`}
        description={`"${emergencyConfirm.pending?.message}": takes over ${registeredCount} registered display${registeredCount === 1 ? "" : "s"} immediately. Send an update or Clear afterward if needed.`}
        confirmLabel="Send Emergency"
        tone="danger"
        loading={emergencySending}
        onConfirm={async () => {
          const preset = emergencyConfirm.pending;
          if (!preset || !claim("emergencySending")) return;
          update((prev) => ({ ...prev, emergencySending: true }));
          let res: Awaited<ReturnType<typeof sendBroadcast>> | undefined;
          try {
            res = await sendBroadcast({
              type: "emergency",
              title: preset.title,
              message: preset.message,
              icon: null,
              priority: 3,
              target: { kind: "all" },
              expiresInMinutes: null,
              durationSeconds: null,
              acknowledgementRequired: true,
              persistent: true,
              scheduledFor: null,
            });
          } finally {
            release("emergencySending");
            update((prev) => ({ ...prev, emergencySending: false }));
          }
          emergencyConfirm.cancel();
          if (res && res.ok) toast.success("Emergency broadcast sent");
          else toast.error("Couldn't send the emergency broadcast. Try again immediately.");
        }}
        onCancel={emergencyConfirm.cancel}
      />
    </div>
  );
}
