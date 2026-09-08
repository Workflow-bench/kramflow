"use client";

import { useEffect, useRef, useState } from "react";
import { Minus, Plus, Settings2 } from "lucide-react";
import { useEventStore, getLastActionStatus } from "@/lib/store";
import { useControlLock } from "@/lib/use-control-lock";
import { useControllerName } from "@/lib/use-controller-name";
import { useEventId, useIsOwner } from "@/lib/event-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

// Fast corrections an operator actually reaches for mid-cue — a small
// nudge (10s) and a bigger one (30s), each way. Anything larger goes
// through the precision row below, which requires an explicit confirm
// (LARGE_CORRECTION_THRESHOLD_SECONDS) rather than being a fifth quick
// button — see this file's own design note below.
const QUICK_DELTAS = [-30, -10, 10, 30] as const;

// Above this magnitude, a precise correction gets a confirm step before
// it commits — a large correction should never land from a single
// keystroke + click. The four quick buttons above never reach this
// threshold on their own, so they never interrupt the fast path.
const LARGE_CORRECTION_THRESHOLD_SECONDS = 120;

function formatSigned(deltaSeconds: number): string {
  const sign = deltaSeconds < 0 ? "-" : "+";
  const abs = Math.abs(deltaSeconds);
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  return `${sign}${m}:${String(s).padStart(2, "0")}`;
}

// Parses "mm:ss", "m:ss", or a bare seconds count ("90") into whole
// seconds. Returns null for anything else rather than guessing — an
// ambiguous precise-entry value should fail to apply, not silently
// round or truncate a stage operator's typed correction.
function parseMagnitude(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/^\d+$/.test(trimmed)) return Number(trimmed);
  const m = trimmed.match(/^(\d{1,3}):([0-5]?\d)$/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

/**
 * Correct the live item's running clock — a signed shift of the same
 * `startedAt` every countdown (Console, Remote, and any "auto" display)
 * already derives elapsed/remaining from. Not a second timer state: the
 * server-side "correctTimer" action (app/api/live/route.ts) reuses the
 * exact control-lease + optimistic-concurrency + activity-log path every
 * other sequencing action goes through.
 *
 * `compact` — Remote's reduced footprint: quick buttons only, larger
 * touch targets, no precision row. Console gets the full control,
 * including the collapsed-by-default precision entry.
 */
export function TimeCorrectionControl({ compact = false }: { compact?: boolean }) {
  const { state, correctTimer } = useEventStore();
  const { lockedByOther } = useControlLock(state);
  const eventId = useEventId();
  const controllerName = useControllerName(eventId, lockedByOther ? state.controllerId : null);
  const readOnly = !useIsOwner();
  const toast = useToast();

  const [pending, setPending] = useState(false);
  const runningRef = useRef(false);
  // Async requests outlive the render that started them — a Realtime push
  // telling this tab someone else now holds the lock can land mid-request,
  // same reasoning as controls-panel.tsx's identical ref.
  const lockedByOtherRef = useRef(lockedByOther);
  useEffect(() => {
    lockedByOtherRef.current = lockedByOther;
  }, [lockedByOther]);

  const [preciseOpen, setPreciseOpen] = useState(false);
  const [preciseDraft, setPreciseDraft] = useState("");
  const [confirmDelta, setConfirmDelta] = useState<number | null>(null);

  const disabled = readOnly || pending;

  async function apply(deltaSeconds: number) {
    if (lockedByOther) {
      toast.error(controllerName ? `${controllerName} has control` : "Locked by another operator");
      return;
    }
    if (runningRef.current) return;
    runningRef.current = true;
    setPending(true);
    try {
      const ok = await correctTimer(deltaSeconds);
      if (!ok) {
        if (lockedByOtherRef.current) {
          toast.error("Locked by another operator");
        } else if (getLastActionStatus(eventId) === 403) {
          toast.error("You no longer have permission to do this.");
        } else {
          toast.error("Couldn't correct the timer. Try again.");
        }
      }
    } finally {
      runningRef.current = false;
      setPending(false);
    }
  }

  function submitPrecise(sign: 1 | -1) {
    const magnitude = parseMagnitude(preciseDraft);
    if (magnitude === null || magnitude === 0) {
      toast.error("Enter a duration like 1:30 or 90.");
      return;
    }
    const deltaSeconds = sign * magnitude;
    if (magnitude >= LARGE_CORRECTION_THRESHOLD_SECONDS) {
      setConfirmDelta(deltaSeconds);
      return;
    }
    void apply(deltaSeconds);
  }

  if (readOnly) {
    // Owner-only, hard 403 server-side either way — a permanently-disabled
    // correction control adds visual noise without ever being usable, so
    // this hides rather than disables (Remote's own pattern for controls a
    // non-owner can never reach; Console's Next/Previous/Hold instead stay
    // visible-but-disabled since those are this surface's primary actions
    // and a viewer benefits from seeing what a show is doing — the same
    // reasoning doesn't apply to a secondary correction control).
    return null;
  }

  return (
    <div className={cn("flex flex-col gap-2", compact && "gap-2.5")}>
      {/* flex-wrap, not a fixed row — at narrower Console widths (tablet
          portrait, ~1024px) the four quick buttons plus the precision
          toggle don't all fit in Live Now's own column; wrapping the
          toggle onto its own line reads cleanly, an overflowing row
          forcing page-level horizontal scroll does not. */}
      <div className={cn("flex flex-wrap items-center gap-1.5", compact && "gap-2")}>
        {QUICK_DELTAS.map((delta) => (
          <Button
            key={delta}
            variant="secondary"
            size={compact ? "lg" : "sm"}
            disabled={disabled}
            onClick={() => void apply(delta)}
            aria-label={`Correct timer ${formatSigned(delta)} seconds`}
            className={compact ? "flex-1" : undefined}
          >
            {delta < 0 ? <Minus className="h-3.5 w-3.5" strokeWidth={2.5} /> : <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />}
            {formatSigned(delta)}
          </Button>
        ))}
        {!compact && (
          <Button
            variant="ghost"
            size="sm"
            disabled={disabled}
            aria-expanded={preciseOpen}
            onClick={() => setPreciseOpen((v) => !v)}
            aria-label={preciseOpen ? "Hide precise adjustment" : "Show precise adjustment"}
          >
            <Settings2 className="h-3.5 w-3.5" strokeWidth={2} />
          </Button>
        )}
      </div>

      {lockedByOther && (
        <p className="text-console-meta text-status-orange">
          {controllerName ? `${controllerName} has control` : "Locked by another operator"} — corrections won&apos;t apply until you take over.
        </p>
      )}

      {!compact && preciseOpen && (
        <div className="flex items-center gap-2">
          <Input
            value={preciseDraft}
            onChange={(e) => setPreciseDraft(e.target.value)}
            placeholder="mm:ss"
            aria-label="Precise correction amount"
            disabled={disabled}
            className="w-24"
            onKeyDown={(e) => {
              if (e.key === "Enter") submitPrecise(1);
            }}
          />
          <Button variant="secondary" size="sm" disabled={disabled} onClick={() => submitPrecise(-1)}>
            <Minus className="h-3.5 w-3.5" strokeWidth={2.5} />
            Subtract
          </Button>
          <Button variant="secondary" size="sm" disabled={disabled} onClick={() => submitPrecise(1)}>
            <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
            Add
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={confirmDelta !== null}
        title={`Correct the timer ${confirmDelta !== null ? formatSigned(confirmDelta) : ""}?`}
        description={
          confirmDelta !== null && confirmDelta > 0
            ? "This gives the live item more time remaining, visible on every connected display immediately."
            : "This takes time away from the live item, visible on every connected display immediately."
        }
        confirmLabel="Correct Timer"
        tone={confirmDelta !== null && confirmDelta < 0 ? "danger" : "default"}
        loading={pending}
        onConfirm={async () => {
          if (confirmDelta !== null) await apply(confirmDelta);
          setConfirmDelta(null);
          setPreciseDraft("");
          setPreciseOpen(false);
        }}
        onCancel={() => setConfirmDelta(null)}
      />
    </div>
  );
}
