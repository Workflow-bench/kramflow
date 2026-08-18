"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ChevronDown, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDialog, useConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { SectionLabel } from "@/components/tv/section-label";
import { useDisplayEngine } from "@/lib/display-engine/store";
import { EMERGENCY_PRESETS, type BroadcastType } from "@/lib/display-engine/types";
import { useEventId } from "@/lib/event-context";
import { cn } from "@/lib/utils";

const QUICK_TYPES: { value: BroadcastType; label: string; tone: string }[] = [
  { value: "info", label: "Info", tone: "bg-status-blue/15 text-status-blue" },
  { value: "reminder", label: "Reminder", tone: "bg-status-blue/15 text-status-blue" },
  { value: "warning", label: "Warning", tone: "bg-status-orange/15 text-status-orange" },
  { value: "success", label: "Success", tone: "bg-status-green/15 text-status-green" },
];

/**
 * Quick-send broadcast controls embedded directly in the Operator
 * Dashboard's Controls panel — collapsed by default so it adds zero
 * visual weight until an operator opens it. Covers the common case (a
 * quick message to every display) plus one-tap emergency presets; the
 * full Broadcast Center (/broadcast) stays linked for scheduling,
 * templates, drafts, history, and per-display targeting.
 */
export function OperatorBroadcastPanel() {
  const eventId = useEventId();
  const { sendBroadcast } = useDisplayEngine();
  const toast = useToast();
  const [expanded, setExpanded] = useState(false);
  const [type, setType] = useState<BroadcastType>("info");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const emergencyConfirm = useConfirmDialog<(typeof EMERGENCY_PRESETS)[number]>();
  const [emergencySending, setEmergencySending] = useState(false);
  // Ref, not just `emergencySending` — ConfirmDialog's confirm button has no
  // disabled-while-submitting state of its own, so a rapid multi-click
  // burst fires onConfirm several times before React commits the `loading`
  // prop's disabled attribute. QA_REPORT.md BUG-3: reproduced live here (3
  // clicks -> 3 duplicate live emergency broadcasts) before this guard
  // existed; see the identical pattern in components/operator/jump-control.tsx.
  const emergencySendingRef = useRef(false);

  function send() {
    if (!title.trim()) return;
    sendBroadcast({
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
    setTitle("");
    setMessage("");
    toast.success("Broadcast sent");
  }

  return (
    <div className="border-t border-white/5 pt-8">
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

      {expanded && (
        <div className="mt-4 flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            {QUICK_TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setType(t.value)}
                aria-pressed={type === t.value}
                className={cn(
                  "rounded-full px-3 py-1.5 text-caption font-semibold uppercase tracking-wide transition-opacity cursor-pointer whitespace-nowrap",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  t.tone,
                  type !== t.value && "opacity-40"
                )}
              >
                {t.label}
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

          <Button variant="primary" size="sm" className="w-full" disabled={!title.trim()} onClick={send}>
            <Send className="h-4 w-4" strokeWidth={2} />
            Send to All Displays
          </Button>

          <Link
            href={`/e/${eventId}/broadcast`}
            className="text-caption text-muted-2 hover:text-primary text-center underline-offset-2 hover:underline"
          >
            More options — schedule, templates, target one display →
          </Link>

          <div className="border-t border-white/5 pt-3 mt-1">
            <div className="flex flex-wrap gap-2">
              {EMERGENCY_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => emergencyConfirm.request(preset)}
                  className="flex items-center gap-1.5 rounded-full bg-status-red/15 text-status-red px-3 py-1.5 text-caption font-semibold cursor-pointer hover:bg-status-red/25 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  <AlertTriangle className="h-3.5 w-3.5" strokeWidth={2} />
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={emergencyConfirm.isOpen}
        title={`Send "${emergencyConfirm.pending?.title}" to every display?`}
        description="This takes over every connected screen immediately."
        confirmLabel="Send Emergency"
        tone="danger"
        loading={emergencySending}
        onConfirm={async () => {
          const preset = emergencyConfirm.pending;
          if (!preset || emergencySendingRef.current) return;
          emergencySendingRef.current = true;
          setEmergencySending(true);
          const res = await sendBroadcast({
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
          emergencySendingRef.current = false;
          setEmergencySending(false);
          emergencyConfirm.cancel();
          if (res && res.ok) toast.success("Emergency broadcast sent");
          else toast.error("Couldn't send the emergency broadcast — try again immediately");
        }}
        onCancel={emergencyConfirm.cancel}
      />
    </div>
  );
}
