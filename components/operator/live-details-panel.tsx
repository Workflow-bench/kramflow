"use client";

import { useEffect, useState } from "react";
import { effectiveNotes, getLive, type LiveState, type Session } from "@/lib/types";
import { useEventStore } from "@/lib/store";
import { useEventId } from "@/lib/event-context";
import { useCountdown } from "@/lib/use-countdown";
import { formatClock } from "@/lib/display-engine/use-display-timer";
import { supabaseBrowser } from "@/lib/supabase/client";
import { ProgressBar } from "@/components/tv/progress-bar";
import { HoldBadge } from "@/components/tv/hold-badge";
import { SectionLabel } from "@/components/tv/section-label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

export function LiveDetailsPanel({ session }: { session: Session }) {
  const { state, setNotes } = useEventStore();
  const toast = useToast();
  const live = getLive(session, state);
  const progress = state.progressBySession[state.activeSessionId];
  const currentOrder = progress?.currentOrder ?? null;
  const countdown = useCountdown(progress?.startedAt ?? null, live?.durationMinutes ?? 0, state.pausedAt);
  const isFinished = currentOrder !== null && currentOrder > session.items.length;

  // Controlled + an explicit Save button, not save-on-blur — a stray click
  // away from the textarea (switching panels, clicking a control) used to
  // silently commit whatever was typed, with no review step.
  //
  // Must seed/track against effectiveNotes (the notesOverrides-aware
  // helper), not the raw live.notes field — live.notes is only the static
  // cue-sheet value. Using the raw field meant this editor never showed a
  // saved override (the operator's own prior edit, or one saved from
  // /remote), even though every TV display correctly renders it via
  // effectiveNotes() — the operator was the one person who couldn't see
  // what was actually live, and typing from that stale blank baseline would
  // silently clobber the real note on Save.
  const liveNotes = live ? effectiveNotes(state, live) : "";
  const [draft, setDraft] = useState(liveNotes);
  const [saving, setSaving] = useState(false);
  // Reset the draft whenever the live item or its stored notes change —
  // done during render (React's documented "adjusting state when a prop
  // changes" pattern) rather than in a useEffect, which would run an
  // extra render-after-commit cycle for what's really a synchronous
  // derivation.
  const notesKey = `${live?.id ?? ""}:${liveNotes}`;
  const [trackedNotesKey, setTrackedNotesKey] = useState(notesKey);
  if (notesKey !== trackedNotesKey) {
    setTrackedNotesKey(notesKey);
    setDraft(liveNotes);
  }

  if (isFinished) return <SessionSummary session={session} state={state} />;

  if (currentOrder === null || !live) {
    return (
      <div className="h-full flex items-center">
        <p className="text-body text-muted-2">Press Start to begin the program.</p>
      </div>
    );
  }

  const dirty = draft !== liveNotes;

  async function handleSave() {
    if (!live) return;
    setSaving(true);
    const ok = await setNotes(live.id, draft);
    setSaving(false);
    if (!ok) toast.error("Couldn't save notes — try again");
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2">
        <SectionLabel>Live Now</SectionLabel>
        {state.pausedAt && <HoldBadge />}
      </div>

      {live.kicker && <p className="text-caption text-muted-2 mt-3">{live.kicker}</p>}
      <p className="text-subtitle text-primary mt-1">{live.title}</p>
      {live.presenter && <p className="text-body text-muted mt-2">{live.presenter}</p>}

      {live.type === "item" && live.durationMinutes > 0 && (
        <div className="mt-8">
          <p
            className={cn(
              "text-[3rem] leading-none font-semibold tabular-nums",
              countdown.isOverrun ? "text-status-red" : "text-primary"
            )}
          >
            {countdown.isOverrun ? "+" : ""}
            {formatClock(countdown.remainingSeconds)}
          </p>
          <div className="mt-3">
            <ProgressBar
              fraction={countdown.fraction}
              tone={state.pausedAt ? "orange" : countdown.isOverrun ? "red" : "green"}
            />
          </div>
          <p className="text-caption text-muted mt-2">
            {countdown.isOverrun ? "over" : "remaining"}
          </p>
        </div>
      )}

      <div className="mt-10 flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-between">
          <SectionLabel>Notes</SectionLabel>
          {dirty && (
            <Button variant="primary" size="sm" onClick={handleSave} loading={saving}>
              Save
            </Button>
          )}
        </div>
        <Textarea
          key={live.id}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Stage notes — cues, mic setup, entrances…"
          aria-label="Stage notes"
          className="mt-3 flex-1 min-h-24 bg-card resize-none"
        />
      </div>
    </div>
  );
}

interface ActivityRow {
  detail: string | null;
  created_at: string;
}

function formatMinutes(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function formatClockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

// The center panel used to just say "Session finished." for the rest of
// the operator's shift — the single largest piece of screen real estate
// doing nothing at exactly the moment there's the most to review.
//
// activity_log has no session_id column (it's a short shared operator
// history, not per-session analytics — see components/operator/
// activity-log.tsx), so "this session's" actual start/finish can't be
// queried directly. Heuristic instead: the newest "Finished session" entry
// is the one that just triggered this view (finishing is a deliberate,
// infrequent action), and the newest "Started" entry before it is when
// this run began. Good enough for a same-shift summary; deliberately not
// attempted across a session switch, where it'd shown nothing rather than
// something misleading.
function SessionSummary({ session, state }: { session: Session; state: LiveState }) {
  const eventId = useEventId();
  const [rows, setRows] = useState<ActivityRow[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabaseBrowser()
      .from("activity_log")
      .select("detail, created_at")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data }: { data: ActivityRow[] | null }) => {
        if (!cancelled && data) setRows(data);
      });
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  const items = session.items.filter((i) => i.type === "item");
  const breaks = session.items.filter((i) => i.type === "break");
  const scheduledMinutes = session.items.reduce((sum, i) => sum + i.durationMinutes, 0);
  const notesCount = session.items.filter((i) => effectiveNotes(state, i).length > 0).length;

  let startedAt: string | null = null;
  let finishedAt: string | null = null;
  let alertCount = 0;
  if (rows) {
    const finishIdx = rows.findIndex((r) => r.detail === "Finished session");
    if (finishIdx >= 0) {
      finishedAt = rows[finishIdx].created_at;
      // Walk backward in time from the finish looking for the "Started"
      // that began this run. A "Switched session" entry in between means
      // the log crossed into a different session's history before we found
      // one — activity_log has no session_id, so that "Started" (if any)
      // could belong to whatever session was active before the switch.
      // Bail rather than pair mismatched Start/Finish across sessions.
      for (let i = finishIdx + 1; i < rows.length; i++) {
        const detail = rows[i].detail;
        if (detail === "Switched session") break;
        if (detail === "Started") {
          startedAt = rows[i].created_at;
          // rows is newest-first, so the run's window is the slice between
          // the finish (older index bound) and this start (younger bound).
          alertCount = rows.slice(finishIdx + 1, i).filter((r) => r.detail?.startsWith("Alert:")).length;
          break;
        }
      }
    }
  }
  const actualMinutes =
    startedAt && finishedAt ? Math.round((Date.parse(finishedAt) - Date.parse(startedAt)) / 60000) : null;

  return (
    <div className="h-full flex flex-col justify-center">
      <SectionLabel>Session Summary</SectionLabel>
      <p className="text-subtitle text-primary mt-2">
        {session.dayLabel} · {session.sessionLabel}
      </p>
      {startedAt && finishedAt && (
        <p className="text-caption text-muted-2 mt-1">
          {formatClockTime(startedAt)} – {formatClockTime(finishedAt)}
        </p>
      )}

      <div className="grid grid-cols-2 gap-x-8 gap-y-5 mt-8 max-w-sm">
        <Stat label="Items run" value={String(items.length)} />
        <Stat label="Breaks" value={String(breaks.length)} />
        <Stat label="Scheduled" value={formatMinutes(scheduledMinutes)} />
        <Stat label="Actual runtime" value={actualMinutes !== null ? formatMinutes(actualMinutes) : "—"} />
      </div>

      {(notesCount > 0 || alertCount > 0) && (
        <div className="mt-8 pt-6 border-t border-white/10 flex flex-col gap-1.5 max-w-sm">
          {alertCount > 0 && (
            <p className="text-caption text-muted">
              {alertCount} alert{alertCount === 1 ? "" : "s"} raised during the session
            </p>
          )}
          {notesCount > 0 && (
            <p className="text-caption text-muted">
              {notesCount} item{notesCount === 1 ? "" : "s"} had stage notes
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-title text-primary tabular-nums">{value}</p>
      <p className="text-caption text-muted-2 mt-1">{label}</p>
    </div>
  );
}
