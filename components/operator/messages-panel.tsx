"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ChevronRight } from "lucide-react";
import { useDisplayEngine } from "@/lib/display-engine/store";
import { describeTarget, isUnexpired } from "@/lib/display-engine/broadcast-status";
import { useEventId } from "@/lib/event-context";
import { AlertComposer } from "./alert-composer";
import { OperatorBroadcastPanel } from "@/components/display-engine/operator-broadcast-panel";
import { cn } from "@/lib/utils";
import { useMessageDrafts, type MessagesMode } from "@/lib/message-drafts";

type Mode = MessagesMode;

// F09 (2026-10 review): one stable Messages region with two explicitly
// different intents. Both underlying systems are unchanged — presentation
// only:
//   Quick alert -> live_state.alert: one banner, a new one replaces it,
//                  stays until dismissed.
//   Broadcast   -> display-engine broadcasts: queued alongside others,
//                  stays until dismissed in Broadcast Center.
// R1 (correction pass): both composers stay mounted and the inactive one is
// `hidden` (out of the layout, tab order and accessibility tree). The drafts
// and the selected tab live in the event's Messages store
// (lib/message-drafts.tsx), so they also survive OperatorGrid remounting
// this panel in a different tree when the layout crosses a breakpoint.
const MODE_COPY: Record<Mode, { label: string; consequence: string }> = {
  alert: {
    label: "Quick alert",
    // R4: matches where the banner actually renders — Presenter only shows
    // it in its timer views, and no output shows it while on Hold.
    consequence:
      "One alert banner on General, AV, Green Room and Custom displays, and on Presenter in its timer views. A new alert replaces the current one. It stays until you dismiss it, and is hidden while a display is on Hold.",
  },
  broadcast: {
    label: "Broadcast",
    consequence:
      "Adds a banner to all displays, shown alongside other broadcasts. It stays until it's dismissed in Broadcast Center.",
  },
};

export function MessagesPanel() {
  const { state: engine } = useDisplayEngine();
  const eventId = useEventId();
  const { drafts, update } = useMessageDrafts();
  const mode = drafts.mode;
  const setMode = (m: Mode) => update((prev) => ({ ...prev, mode: m }));
  const [emergencyOpen, setEmergencyOpen] = useState(false);
  const baseId = useId();

  // R4: same "still showing" rule the displays use (expiry), and the
  // audience it was addressed to — not a claim about physical receipt.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(id);
  }, []);
  const activeEmergencies = engine.broadcasts.active.filter((m) => m.type === "emergency" && isUnexpired(m, now));

  return (
    <section aria-labelledby={`${baseId}-heading`} className="flex flex-col gap-4">
      <h2 id={`${baseId}-heading`} className="text-console-label uppercase text-muted-2">
        Messages
      </h2>

      {activeEmergencies.map((m) => (
        <div key={m.id} role="status" className="rounded-panel border border-status-red/40 bg-status-red/10 px-3 py-2.5 text-console-sm">
          <p className="font-medium text-status-red">Emergency active: &ldquo;{m.title}&rdquo;</p>
          <p className="text-muted mt-0.5">
            Addressed to {describeTarget(m.target, engine.registry, engine.groups)}
            {m.acknowledgementRequired ? ` · acknowledged by ${m.acknowledgedBy.length}` : ""}.
          </p>
          <Link href={`/e/${eventId}/broadcast`} className="text-primary underline underline-offset-2">
            Clear it in Broadcast Center
          </Link>
        </div>
      ))}

      <div className="rounded-panel border border-status-red/30">
        <button
          type="button"
          onClick={() => setEmergencyOpen((v) => !v)}
          aria-expanded={emergencyOpen}
          aria-controls={`${baseId}-emergency`}
          className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-console-sm text-status-red font-medium cursor-pointer hover:bg-status-red/10 rounded-panel focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
        >
          <AlertTriangle className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden="true" />
          Emergency
          <span className="text-console-meta font-normal text-muted">· takes over all displays</span>
          <ChevronRight
            className={cn("ml-auto h-3.5 w-3.5 shrink-0 transition-transform", emergencyOpen && "rotate-90")}
            strokeWidth={2}
            aria-hidden="true"
          />
        </button>
        <div id={`${baseId}-emergency`} hidden={!emergencyOpen} className="px-3 pb-3">
          <OperatorBroadcastPanel section="emergency" embedded />
        </div>
      </div>

      <div role="tablist" aria-label="Message type" className="grid grid-cols-2 gap-1 rounded-control border border-line-soft p-1">
        {(Object.keys(MODE_COPY) as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            id={`${baseId}-tab-${m}`}
            aria-selected={mode === m}
            aria-controls={`${baseId}-panel-${m}`}
            tabIndex={mode === m ? 0 : -1}
            onClick={() => setMode(m)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                e.preventDefault();
                const next: Mode = m === "alert" ? "broadcast" : "alert";
                setMode(next);
                document.getElementById(`${baseId}-tab-${next}`)?.focus();
              }
            }}
            className={cn(
              "min-h-9 rounded-[5px] px-3 py-1.5 text-console-sm cursor-pointer transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
              mode === m ? "bg-raised text-primary font-medium" : "text-muted hover:text-primary"
            )}
          >
            {MODE_COPY[m].label}
          </button>
        ))}
      </div>

      {(Object.keys(MODE_COPY) as Mode[]).map((m) => (
        <div
          key={m}
          role="tabpanel"
          id={`${baseId}-panel-${m}`}
          aria-labelledby={`${baseId}-tab-${m}`}
          hidden={mode !== m}
          className="flex flex-col gap-3"
        >
          <p className="text-console-meta text-muted">{MODE_COPY[m].consequence}</p>
          {m === "alert" ? <AlertComposer embedded /> : <OperatorBroadcastPanel section="form" embedded />}
        </div>
      ))}
    </section>
  );
}
