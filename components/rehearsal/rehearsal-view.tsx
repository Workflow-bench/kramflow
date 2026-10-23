"use client";

import { useEffect, useMemo, useState } from "react";
import { clearRun, EMPTY_RUN_STATE, usePersistedRun } from "@/components/rehearsal/persisted-run";
import { cueFingerprint, runMatchesSession } from "@/lib/rehearsal-run";
import { useRouter } from "next/navigation";
import { FlaskConical, ArrowLeft, Play, Pause, ChevronLeft, ChevronRight, Square } from "lucide-react";
import { getLive, getNext, getOnDeck, type LiveState, type Session, type Alert as AlertType, type AlertSeverity } from "@/lib/types";
import { useCountdown } from "@/lib/use-countdown";
import { countdownSeverity } from "@/lib/timing";
import { formatClock } from "@/lib/display-engine/use-display-timer";
import { Button, LinkButton } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { Select } from "@/components/ui/select";
import { AlertBanner } from "@/components/ui/alert-banner";
import { SectionLabel } from "@/components/ui/section-label";
import { OperationalStatus } from "@/components/ui/operational-status";
import { ProgressBar } from "@/components/ui/progress-bar";
import { RunPosition } from "@/components/operator/run-position";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { canStartRehearsal, canFinishRehearsal, isRehearsalComplete, shouldConfirmExit, completionSummary } from "@/lib/rehearsal";

const REHEARSAL_INITIAL: LiveState = {
  activeSessionId: "",
  progressBySession: {},
  pausedAt: null,
  alert: null,
  notesOverrides: {},
  controllerId: null,
  controllerClaimedAt: null,
  itemActuals: {},
};

// Report finding #14 — a mode to run Start/Next/Hold/Alert without any
// risk of it reaching a real display or share link, requested specifically
// because nothing today stops a full tech rehearsal from accidentally
// pushing "LIVE" content to a screen a client or early guest might see.
//
// Architecture choice (flagged in the task as a judgment call): this is a
// **separate page holding its own local, unpersisted state** — not a
// `rehearsal_mode` flag on the real `live_state` row that display/share-
// link routes would need to check and refuse to render for. A flag-based
// approach makes "never reaches a real display" a *runtime check* (every
// display route, and the anonymous /api/display-view poll route, would
// all need to remember to look at the flag, correctly, forever) — one
// missed check anywhere in that surface area leaks a rehearsal cue to a
// real screen. This page instead never calls /api/live, never touches the
// live_state table, and never opens a Realtime channel that any display
// subscribes to — so "can't reach a real display" is true by construction
// rather than by every reader remembering to check a flag. The trade-off,
// stated plainly: this rehearsal doesn't sync across multiple operators'
// tabs the way the real console does (see lib/store.tsx) — it's a solo
// practice run against the event's real cue sheet content, not a
// multi-person live rehearsal. Real session/item data is read normally
// (useSessions, the same read path the real console uses) since
// rehearsing against fabricated content wouldn't be useful — only the
// *progress/hold/alert* state is local and disposable.
export function RehearsalView({ eventId, sessions, onExit }: { eventId: string; sessions: Session[]; onExit?: () => void }) {
  // Run state persists per viewer across in-app history navigation (persisted-run.ts).
  // The stored run is trusted only for the cue data on screen. If the cues changed since
  // the run was recorded, the run is stale: its progress is not shown, and the next
  // action starts a fresh run on the current cues (never a merge into old progress).
  const stampFor = (id: string | null) => cueFingerprint(sessions.find((s) => s.id === id) ?? null);
  const { run, setSessionId, setState, setInteracted } = usePersistedRun(eventId, {
    resolveBase: (r) => {
      const current = r.sessionId ?? sessions[0]?.id ?? null;
      const cur = sessions.find((s) => s.id === current) ?? null;
      return runMatchesSession(r, cur) ? r : { ...r, state: EMPTY_RUN_STATE, interacted: false, fingerprint: null };
    },
    stamp: (r) => {
      const id = r.sessionId ?? sessions[0]?.id ?? null;
      return { sessionId: id, fingerprint: stampFor(id) };
    },
  });
  const sessionId = run.sessionId;
  const storedSession = sessions.find((s) => s.id === (sessionId ?? sessions[0]?.id)) ?? null;
  const runStale = run.sessionId !== null && !runMatchesSession(run, storedSession);
  const state = runStale ? EMPTY_RUN_STATE : run.state;
  const interacted = runStale ? false : run.interacted;

  const session = useMemo(() => sessions.find((s) => s.id === (sessionId ?? sessions[0]?.id)) ?? null, [sessions, sessionId]);
  const activeSessionId = session?.id ?? "";
  const progress = state.progressBySession[activeSessionId];
  const currentOrder = progress?.currentOrder ?? null;
  const max = session?.items.length ?? 0;
  const isFinished = isRehearsalComplete({ currentOrder, max });
  const [exitConfirmOpen, setExitConfirmOpen] = useState(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  // Reset discards the run. Confirm only when meaningful progress would actually be lost
  // (the same rule as the Exit confirmation). A completed or unstarted run is reset directly.
  function requestReset() {
    if (shouldConfirmExit({ currentOrder, max, interacted })) setResetConfirmOpen(true);
    else reset();
  }
  // Reload, tab close and external navigation while a run has discardable progress:
  // the browser asks before leaving. Same rule as the in-app Exit confirmation
  // (lib/rehearsal.ts shouldConfirmExit), so the two cannot disagree. In-app history
  // and Link navigation are not intercepted here; see the rehearsal evidence README.
  const hasProgress = shouldConfirmExit({ currentOrder, max, interacted });
  useEffect(() => {
    if (!hasProgress) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [hasProgress]);

  const router = useRouter();

  const live = session && !isFinished ? getLive(session, { ...state, activeSessionId }) : null;
  const next = session ? getNext(session, { ...state, activeSessionId }) : null;
  const onDeck = session ? getOnDeck(session, { ...state, activeSessionId }) : null;
  // Same countdown Console runs on the real show (lib/use-countdown.ts) —
  // reading progress.startedAt/pausedAt from this page's own local state
  // instead of the real live_state row, but otherwise identical, so
  // rehearsing means actually practicing against the one element that
  // dominates the real Console's screen (the redesign brief's "timing
  // visibility" + "muscle-memory relationship to Operator"). Previously
  // this page had no timer at all — the single most important thing to
  // rehearse (reading the countdown, reacting before it runs out) wasn't
  // rehearsable.
  const countdown = useCountdown(progress?.startedAt ?? null, live?.durationMinutes ?? 0, state.pausedAt);

  function setProgress(order: number | null) {
    setState((s) => ({
      ...s,
      activeSessionId,
      pausedAt: null,
      progressBySession: { ...s.progressBySession, [activeSessionId]: { currentOrder: order, startedAt: order !== null ? new Date().toISOString() : null } },
    }));
  }

  function start() {
    setProgress(1);
  }
  function next_() {
    if (currentOrder === null || currentOrder >= max) return;
    setInteracted(true);
    setProgress(currentOrder + 1);
  }
  function previous() {
    if (currentOrder === null || currentOrder <= 1) return;
    setProgress(currentOrder - 1);
  }
  function finish() {
    setProgress(max + 1);
  }
  function togglePause() {
    setInteracted(true);
    setState((s) => ({ ...s, pausedAt: s.pausedAt ? null : new Date().toISOString() }));
  }
  function reset() {
    setState({ ...REHEARSAL_INITIAL, activeSessionId });
    setInteracted(false);
  }
  const [alertDraft, setAlertDraft] = useState("");
  const [alertSeverity, setAlertSeverity] = useState<AlertSeverity>("warning");
  function postAlert() {
    if (!alertDraft.trim()) return;
    const alert: AlertType = { message: alertDraft.trim(), severity: alertSeverity };
    setState((s) => ({ ...s, alert }));
    setInteracted(true);
    setAlertDraft("");
  }

  return (
    <main className="min-h-screen bg-background flex flex-col">
      {/* Unmistakable by design — solid amber, diagonal hazard stripe,
          sticky across the whole page, worded to say explicitly what it
          does NOT do. This is the one visual element in this feature that
          matters most: Dev's own ask was that a rehearsal mode needs to be
          impossible to mistake for the real console. */}
      {/* F14 (2026-10 review): explanatory text now sits on a solid,
          readable surface; the hazard stripe survives only as a narrow top
          edge accent. The words carry the mode, not the color alone. */}
      <div className="sticky top-0 z-30 border-b border-status-orange/40 bg-[#2a1d08]">
        <div
          aria-hidden="true"
          className="h-1.5"
          style={{
            background:
              "repeating-linear-gradient(135deg, var(--color-status-orange) 0px, var(--color-status-orange) 10px, #1a1206 10px, #1a1206 20px)",
          }}
        />
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <FlaskConical className="h-4.5 w-4.5 shrink-0 text-status-orange" strokeWidth={2.5} aria-hidden="true" />
          <span className="text-console-sm font-semibold uppercase tracking-wide text-status-orange shrink-0">
            Rehearsal · Not live
          </span>
          <span className="hidden sm:inline text-console-meta text-primary/85">
            Nothing here reaches a real display, share link, or the real Operator Console.
          </span>
        </div>
        {shouldConfirmExit({ currentOrder, max, interacted }) ? (
          <Button variant="secondary" size="sm" onClick={() => setExitConfirmOpen(true)}>
            <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} />
            Exit Rehearsal
          </Button>
        ) : (
          <LinkButton href={`/e/${eventId}/operator`} variant="secondary" size="sm">
            <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} />
            Exit Rehearsal
          </LinkButton>
        )}
        </div>
      </div>

      {runStale && (
        <p role="status" className="px-6 pt-4 text-console-meta text-status-orange">
          The cue list changed since this rehearsal started, so it restarted on the current cues.
        </p>
      )}
      {!session ? (
        <div className="px-6 py-8">
          {sessions.length > 1 && (
            <SessionSelect sessions={sessions} activeSessionId={activeSessionId} onChange={(id) => {
              setSessionId(id);
              setState({ ...REHEARSAL_INITIAL, activeSessionId: id });
            }} />
          )}
          <p className="text-console-sm text-muted-2 mt-4">No session to rehearse yet. Add one in the Cue Sheet first.</p>
        </div>
      ) : (
        // Same rundown-beside-live-state relationship as the real Console's
        // tablet/desktop composition (app/e/[eventId]/operator/page.tsx) —
        // deliberately reused rather than re-invented, so the muscle memory
        // ("the list is on the left, what's happening is on the right")
        // carries over at lg+. Below lg, order-* flips the visual sequence
        // (not the DOM, so screen-reader/tab order still follows the list
        // first) to match Operator's own mobile priority — current/next,
        // countdown, and transport controls before the cue list, the same
        // fix the 2026-09 convergence sprint applied to Operator itself.
        // Rehearsing with the list first, controls second — the reverse of
        // Operator's real mobile order — would teach the wrong scan
        // pattern, defeating this page's whole purpose as a safe practice
        // run for live muscle memory.
        // Review F3: at xl this is now the Console's own three-column
        // arrangement (Program | Live | Controls) so positions transfer
        // 1:1 to the real show; lg keeps live+controls stacked on the right.
        <div className="flex-1 flex flex-col lg:grid lg:grid-cols-[1fr_380px] lg:grid-rows-[auto_1fr] lg:[grid-template-areas:'list_live''list_controls'] xl:grid-cols-[1fr_minmax(340px,0.9fr)_320px] xl:grid-rows-1 xl:[grid-template-areas:'list_live_controls']">
          <div className="order-3 lg:order-none lg:[grid-area:list] min-w-0 px-4 sm:px-6 xl:px-12 py-6 xl:py-8">
            {sessions.length > 1 && (
              <SessionSelect sessions={sessions} activeSessionId={activeSessionId} onChange={(id) => {
                setSessionId(id);
                setState({ ...REHEARSAL_INITIAL, activeSessionId: id });
              }} />
            )}
            <SectionLabel className={sessions.length > 1 ? "mt-6" : undefined}>
              {session.dayLabel} • {session.sessionLabel}
            </SectionLabel>
            {/* Unboxed, border-b rows — the same rundown grammar Console's
                own ProgramList uses (components/operator/program-list.tsx),
                not a second, boxed-list treatment for what is otherwise
                the identical relationship (current/done/upcoming). */}
            <ul className="mt-3 flex flex-col">
              {session.items.map((item) => {
                const isLive = live?.id === item.id;
                const isDone = currentOrder !== null && item.order < currentOrder;
                return (
                  <li
                    key={item.id}
                    className={cn(
                      "flex items-center justify-between gap-3 px-4 py-2.5 border-b border-line-soft last:border-b-0",
                      isLive && "bg-status-orange/15"
                    )}
                  >
                    <span className={cn("text-console-row", isDone ? "text-muted-2 line-through" : "text-primary")}>
                      {item.order}. {item.title}
                    </span>
                    {isLive && <OperationalStatus kind="rehearsal" label="Rehearsing" />}
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="order-1 lg:order-none lg:[grid-area:live] lg:border-l border-line-soft min-w-0 px-4 sm:px-6 xl:px-10 py-6 xl:py-8 flex flex-col gap-8">
            {state.alert && <AlertBanner alert={state.alert} />}

            {/* Phase 7a correction: this used to carry the same
                glass-panel/border treatment as Console's Live Now, on the
                (since Phase 5, false) claim that Console's card was the
                shared reference. Console's own Live Now is now unboxed —
                the live item is the operational center of the screen, not
                a card among cards — and this follows suit: same unboxed
                grammar, same dot+label pattern, same aria-live wrapper.
                The one deliberate divergence is color: Console's dot is
                status-green because it's genuinely live; this stays
                status-orange, matching Rehearsal's own established
                identity everywhere else on this page (hazard-stripe
                header, the rundown's "Rehearsing" row highlight) —
                preserving rehearsal/live separation is more important
                than literal parity with Console's color. */}
            <section className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                {live && !isFinished && (
                  <span aria-hidden="true" className="h-2 w-2 rounded-full bg-status-orange shrink-0" />
                )}
                <SectionLabel className={cn(live && !isFinished && "text-status-orange")}>
                  {isFinished ? "Finished" : live ? "Rehearsing now" : "Not started"}
                </SectionLabel>
                {state.pausedAt && <OperationalStatus kind="hold" />}
              </div>
              {/* R11: the live region holds cue identity only (kicker, title,
                  presenter), same as Console's LiveDetailsPanel. The ticking
                  countdown sits outside it so screen readers aren't fed a new
                  announcement every second. */}
              <div aria-live="polite" aria-atomic="true">
                {/* Same kicker line Console's Live Now shows above its own
                    title (components/operator/live-details-panel.tsx) —
                    both read the identical Program.kicker field through
                    getLive(), so omitting it here was a gap, not a
                    deliberate divergence. */}
                {live?.kicker && !isFinished && <p className="text-console-meta text-muted-2 mt-3">{live.kicker}</p>}
                <p className="text-console-lg font-semibold text-primary mt-1">
                  {isFinished ? "Rehearsal complete" : live ? live.title : "—"}
                </p>
                {live?.presenter && !isFinished && <p className="text-console-sm text-muted mt-2">{live.presenter}</p>}
              </div>
              <div>
                {isFinished && (() => {
                  const sum = completionSummary({ sessionLabel: session?.sessionLabel ?? "", max });
                  return (
                    <div className="mt-4 flex flex-col gap-3">
                      <p className="text-console-sm text-muted">
                        {sum.cuesCompleted} of {sum.cuesTotal} cues completed. Nothing was sent to any live screen.
                      </p>
                      <div className="flex gap-3">
                        <Button variant="primary" onClick={reset}>Run again</Button>
                        <LinkButton href={`/e/${eventId}/operator`} variant="secondary">Exit Rehearsal</LinkButton>
                      </div>
                    </div>
                  );
                })()}
                {live && live.type === "item" && live.durationMinutes > 0 && (() => {
                  const severity = countdownSeverity(countdown.remainingSeconds, countdown.isOverrun);
                  return (
                    <div className="mt-6">
                      <p
                        className={cn(
                          "text-console-headline tabular-nums transition-colors duration-200",
                          severity === "overrun" ? "text-status-red" : severity === "approaching" ? "text-status-orange" : "text-primary"
                        )}
                      >
                        {countdown.isOverrun ? "+" : ""}
                        {formatClock(countdown.remainingSeconds)}
                      </p>
                      <div className="mt-3">
                        <ProgressBar
                          fraction={countdown.fraction}
                          tone={state.pausedAt ? "orange" : severity === "overrun" ? "red" : severity === "approaching" ? "orange" : "green"}
                        />
                      </div>
                      <p className="text-console-meta text-muted mt-2">{countdown.isOverrun ? "over" : "remaining"}</p>
                    </div>
                  );
                })()}
              </div>

              <RunPosition next={next} onDeck={onDeck} />
            </section>
          </div>

          <div className="order-2 lg:order-none lg:[grid-area:controls] lg:border-l xl:border-l border-line-soft min-w-0 px-4 sm:px-6 xl:px-8 py-6 xl:py-8 flex flex-col gap-8">
            <p className="text-console-sm text-status-orange">
              Rehearsal · cues and alerts here stay in this tab. No real display changes.
            </p>
            <section className="flex flex-col gap-3">
              <SectionLabel>Controls</SectionLabel>
              <div className="flex flex-col gap-3">
                {currentOrder === null ? (
                  <Button variant="primary" size="lg" onClick={start} disabled={!canStartRehearsal({ max })}>
                    <Play className="h-4 w-4" strokeWidth={2} />
                    Start Rehearsal
                  </Button>
                ) : currentOrder >= max ? (
                  <Button variant="primary" size="lg" onClick={finish} disabled={!canFinishRehearsal({ currentOrder, max }) || isFinished}>
                    Finish
                    <ChevronRight className="h-4 w-4" strokeWidth={2} />
                  </Button>
                ) : (
                  <Button
                    variant="primary"
                    size="lg"
                    onClick={next_}
                    disabled={isFinished}
                    className="h-auto min-h-14 py-2.5 flex-col gap-0.5"
                    aria-label={next ? `Next cue: ${next.title}` : "Next cue"}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      Next cue
                      <ChevronRight className="h-4 w-4" strokeWidth={2} />
                    </span>
                    {next && <span className="text-console-sm font-normal opacity-75 max-w-full truncate">{next.title}</span>}
                  </Button>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <Button variant="secondary" onClick={previous} disabled={currentOrder === null || currentOrder <= 1}>
                    <ChevronLeft className="h-4 w-4" strokeWidth={2} />
                    Previous
                  </Button>
                  <Button variant="secondary" onClick={togglePause} disabled={currentOrder === null || isFinished}>
                    {state.pausedAt ? <Play className="h-4 w-4" strokeWidth={2} /> : <Pause className="h-4 w-4" strokeWidth={2} />}
                    {state.pausedAt ? "Resume" : "Hold"}
                  </Button>
                </div>
                {currentOrder !== null && !isFinished && currentOrder < max && (
                  <Button variant="ghost" size="sm" onClick={finish} className="self-start">
                    <Square className="h-3.5 w-3.5" strokeWidth={2} />
                    Jump to Finish
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={requestReset} className="self-start text-muted-2">
                  Reset rehearsal
                </Button>
              </div>
            </section>

            <section className="flex flex-col gap-3">
              <SectionLabel>Raise Alert (rehearsal only)</SectionLabel>
              <div className="flex flex-col gap-2">
                <Input
                  value={alertDraft}
                  onChange={(e) => setAlertDraft(e.target.value)}
                  placeholder="e.g. Drama Team, please report Stage Left"
                  aria-label="Alert message"
                />
                <div className="flex gap-2">
                  {(["info", "warning", "critical"] as AlertSeverity[]).map((sev) => (
                    <button
                      key={sev}
                      type="button"
                      onClick={() => setAlertSeverity(sev)}
                      aria-pressed={alertSeverity === sev}
                      className={cn(
                        "h-9 px-3 rounded-control text-console-meta font-medium uppercase tracking-wide border",
                        alertSeverity === sev ? "border-accent text-primary bg-card-hover" : "border-line text-muted-2"
                      )}
                    >
                      {sev}
                    </button>
                  ))}
                </div>
                <Button variant="secondary" onClick={postAlert} className="self-start">
                  Post
                </Button>
              </div>
              {state.alert && (
                <Button variant="ghost" size="sm" className="self-start" onClick={() => setState((s) => ({ ...s, alert: null }))}>
                  Dismiss alert
                </Button>
              )}
            </section>
          </div>
        </div>
      )}
      <ConfirmDialog
        open={resetConfirmOpen}
        title="Reset this rehearsal?"
        description="Your rehearsal progress will be discarded. Nothing on any live screen was changed."
        confirmLabel="Reset rehearsal"
        tone="danger"
        onConfirm={() => {
          setResetConfirmOpen(false);
          reset();
        }}
        onCancel={() => setResetConfirmOpen(false)}
      />
      <ConfirmDialog
        open={exitConfirmOpen}
        title="Leave rehearsal?"
        description="Your rehearsal progress will be discarded. Nothing on any live screen was changed."
        confirmLabel="Leave rehearsal"
        tone="danger"
        onConfirm={() => {
          setExitConfirmOpen(false);
          clearRun(eventId); // a confirmed Exit is an explicit discard
          if (onExit) onExit();
          else router.push(`/e/${eventId}/operator`);
        }}
        onCancel={() => setExitConfirmOpen(false)}
      />
    </main>
  );
}

function SessionSelect({
  sessions,
  activeSessionId,
  onChange,
}: {
  sessions: { id: string; dayLabel: string; sessionLabel: string }[];
  activeSessionId: string;
  onChange: (id: string) => void;
}) {
  return (
    <FormField label="Session to rehearse" className="max-w-sm">
      <Select
        value={activeSessionId}
        onChange={onChange}
        options={sessions.map((s) => ({ value: s.id, label: `${s.dayLabel} • ${s.sessionLabel}` }))}
      />
    </FormField>
  );
}
