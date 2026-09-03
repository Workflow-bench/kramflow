"use client";

import { useEffect, useState } from "react";
import { effectiveNotes, getLive, getNext, getOnDeck, driftMinutes, type LiveState, type Program, type Session } from "@/lib/types";
import { computeRundownProjection, driftSeverity, formatClockTime, formatMinutes } from "@/lib/timing";
import { useEventStore } from "@/lib/store";
import { useEventId } from "@/lib/event-context";
import { useCountdown } from "@/lib/use-countdown";
import { formatClock } from "@/lib/display-engine/use-display-timer";
import { supabaseBrowser } from "@/lib/supabase/client";
import { ProgressBar } from "@/components/ui/progress-bar";
import { OperationalStatus } from "@/components/ui/operational-status";
import { SectionLabel } from "@/components/ui/section-label";
import { RunPosition } from "./run-position";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

export function LiveDetailsPanel({
  session,
  hideNotes = false,
}: {
  session: Session;
  /** Mobile-only: Notes renders separately via <LiveNotes> further down the
   *  page instead of inline here — see operator/page.tsx's mobile ordering
   *  comment for why. Desktop/tablet never pass this, so their layout is
   *  unchanged. */
  hideNotes?: boolean;
}) {
  const { state } = useEventStore();
  const live = getLive(session, state);
  const next = getNext(session, state);
  const onDeck = getOnDeck(session, state);
  const progress = state.progressBySession[state.activeSessionId];
  const currentOrder = progress?.currentOrder ?? null;
  const countdown = useCountdown(progress?.startedAt ?? null, live?.durationMinutes ?? 0, state.pausedAt);
  const isFinished = currentOrder !== null && currentOrder > session.items.length;
  // EXPECTED_START(next item) = PLANNED_START(next item) + current drift —
  // see lib/timing.ts's module doc. The same one number applies uniformly
  // to every not-yet-reached item ("if current drift persists"), so Next
  // needs nothing more than the live item's own drift, already computed.
  const currentDriftMinutes = live ? driftMinutes(live, state) : null;

  if (isFinished) return <SessionSummary session={session} state={state} />;

  if (currentOrder === null || !live) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-1.5">
        <p className="text-console-sm text-muted-2">Press Start to begin the program.</p>
        {currentOrder === null && <ProjectedFinishLine session={session} state={state} />}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2">
        <SectionLabel>Live Now</SectionLabel>
        {state.pausedAt && <OperationalStatus kind="hold" />}
      </div>

      {live.kicker && <p className="text-console-meta text-muted-2 mt-3">{live.kicker}</p>}
      <p className="text-console-lg text-primary mt-1">{live.title}</p>
      {live.presenter && <p className="text-console-sm text-muted mt-2">{live.presenter}</p>}
      <DriftLine program={live} state={state} />
      <ProjectedFinishLine session={session} state={state} />

      {live.type === "item" && live.durationMinutes > 0 && (
        <div className="mt-8">
          <p
            className={cn(
              "text-console-headline tabular-nums",
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
          <p className="text-console-meta text-muted mt-2">
            {countdown.isOverrun ? "over" : "remaining"}
          </p>
        </div>
      )}

      <RunPosition next={next} onDeck={onDeck} currentDriftMinutes={currentDriftMinutes} />

      {!hideNotes && (
        <div className="mt-10 flex-1 flex flex-col min-h-0">
          <LiveNotesFields session={session} />
        </div>
      )}
    </div>
  );
}

// The notes editor itself, factored out so mobile can place it in a
// different scroll position (<LiveNotes>, below) from the rest of Live Now
// without a second, drifting copy of the save logic.
function LiveNotesFields({ session }: { session: Session }) {
  const { state, setNotes } = useEventStore();
  const toast = useToast();
  const live = getLive(session, state);
  const [saving, setSaving] = useState(false);

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

  if (!live) return null;
  const dirty = draft !== liveNotes;

  async function handleSave() {
    if (!live) return;
    setSaving(true);
    try {
      const ok = await setNotes(live.id, draft);
      if (!ok) toast.error("Couldn't save notes — try again");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
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
    </>
  );
}

// Mobile-only placement of the notes editor, positioned lower on the page
// (see operator/page.tsx) than Live Now's other content — see this file's
// LiveDetailsPanel hideNotes prop comment.
export function LiveNotes({ session }: { session: Session }) {
  return (
    <div className="flex flex-col">
      <LiveNotesFields session={session} />
    </div>
  );
}

// "Are we ahead or behind" for the item that's actually live right now —
// the one glance-able timing question an operator under pressure needs an
// answer to. Silent (renders nothing) whenever the comparison isn't
// meaningful: no scheduled time on this item, or it hasn't really gone
// live yet (item_actuals only gets written by the real /api/live path —
// Rehearsal never touches it, so this never shows a rehearsal run as
// "12m behind" against the real schedule).
function DriftLine({ program, state }: { program: Program; state: LiveState }) {
  const drift = driftMinutes(program, state);
  if (drift === null) return null;

  const severity = driftSeverity(drift);
  if (severity === "on-schedule") {
    return <p className="text-console-meta text-muted-2 mt-2">On schedule</p>;
  }
  const behind = drift > 0;
  // ±10s reads identically to ±4m today (both just "mild," same weight as
  // the pre-existing single-tier treatment) — severity === "significant"
  // (the ≥5min line, same one lib/timing.ts's Presenter-timer-derived
  // threshold uses) is the one case this phase's own instruction called
  // out: "do not make ±10 seconds visually equivalent to +20 minutes."
  return (
    <p
      className={cn(
        "text-console-meta mt-2 tabular-nums",
        severity === "significant"
          ? behind
            ? "text-status-red font-medium"
            : "text-status-blue font-medium"
          : behind
            ? "text-status-orange"
            : "text-status-blue"
      )}
    >
      {Math.abs(drift)}m {behind ? "behind schedule" : "ahead of schedule"}
    </p>
  );
}

// Whole-rundown projection — "what does the current drift mean for the
// REST of the session," the gap plain per-item drift (above) doesn't
// answer. One canonical computation (lib/timing.ts's
// computeRundownProjection), shared with the post-event report so the two
// can never calculate this differently. Recomputed every 30s, not every
// second — formatClockTime only shows hour:minute, so finer-grained
// updates would just be wasted renders, not any real added precision.
function ProjectedFinishLine({ session, state }: { session: Session; state: LiveState }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const projection = computeRundownProjection(session, state, now);

  if (projection.finish.kind === "unavailable") {
    // "finished" is handled by SessionSummary taking over the whole panel;
    // "not-started" has nothing to extrapolate from yet — both render
    // nothing here rather than an empty/confusing line.
    if (projection.finish.reason !== "replaying-earlier-item") return null;
    return <p className="text-console-meta text-muted-2 mt-1">Replaying an earlier item — projection paused</p>;
  }

  const label = projection.finish.kind === "planned" ? "Planned finish" : "Projected finish";
  const severity = projection.currentDriftMinutes !== null ? driftSeverity(projection.currentDriftMinutes) : "on-schedule";
  return (
    <p
      className={cn(
        "text-console-meta mt-1 tabular-nums",
        severity === "significant" ? "text-status-orange font-medium" : "text-muted-2"
      )}
    >
      {label} ~{formatClockTime(projection.finish.at)}
    </p>
  );
}

interface ActivityRow {
  detail: string | null;
  created_at: string;
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
      <p className="text-console-lg text-primary mt-2">
        {session.dayLabel} · {session.sessionLabel}
      </p>
      {startedAt && finishedAt && (
        <p className="text-console-meta text-muted-2 mt-1">
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
        <div className="mt-8 pt-6 border-t border-line flex flex-col gap-1.5 max-w-sm">
          {alertCount > 0 && (
            <p className="text-console-meta text-muted">
              {alertCount} alert{alertCount === 1 ? "" : "s"} raised during the session
            </p>
          )}
          {notesCount > 0 && (
            <p className="text-console-meta text-muted">
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
      <p className="text-console-lg text-primary tabular-nums">{value}</p>
      <p className="text-console-meta text-muted-2 mt-1">{label}</p>
    </div>
  );
}
