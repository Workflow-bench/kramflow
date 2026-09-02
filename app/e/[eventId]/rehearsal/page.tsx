"use client";

import { useMemo, useState } from "react";
import { FlaskConical, ArrowLeft, Play, Pause, ChevronLeft, ChevronRight, Square } from "lucide-react";
import { useSessions } from "@/lib/use-sessions";
import { useEventId } from "@/lib/event-context";
import { getLive, getNext, getOnDeck, type LiveState, type Alert as AlertType, type AlertSeverity } from "@/lib/types";
import { Button, LinkButton } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { Select } from "@/components/ui/select";
import { AlertBanner } from "@/components/ui/alert-banner";
import { SectionLabel } from "@/components/ui/section-label";
import { OperationalStatus } from "@/components/ui/operational-status";
import { RunPosition } from "@/components/operator/run-position";
import { cn } from "@/lib/utils";

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
export default function RehearsalPage() {
  const eventId = useEventId();
  const sessions = useSessions();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [state, setState] = useState<LiveState>(REHEARSAL_INITIAL);

  const session = useMemo(() => sessions.find((s) => s.id === (sessionId ?? sessions[0]?.id)) ?? null, [sessions, sessionId]);
  const activeSessionId = session?.id ?? "";
  const progress = state.progressBySession[activeSessionId];
  const currentOrder = progress?.currentOrder ?? null;
  const max = session?.items.length ?? 0;
  const isFinished = currentOrder !== null && currentOrder > max;

  const live = session && !isFinished ? getLive(session, { ...state, activeSessionId }) : null;
  const next = session ? getNext(session, { ...state, activeSessionId }) : null;
  const onDeck = session ? getOnDeck(session, { ...state, activeSessionId }) : null;

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
    setState((s) => ({ ...s, pausedAt: s.pausedAt ? null : new Date().toISOString() }));
  }
  function reset() {
    setState({ ...REHEARSAL_INITIAL, activeSessionId });
  }
  const [alertDraft, setAlertDraft] = useState("");
  const [alertSeverity, setAlertSeverity] = useState<AlertSeverity>("warning");
  function postAlert() {
    if (!alertDraft.trim()) return;
    const alert: AlertType = { message: alertDraft.trim(), severity: alertSeverity };
    setState((s) => ({ ...s, alert }));
    setAlertDraft("");
  }

  return (
    <main className="min-h-screen bg-background flex flex-col">
      {/* Unmistakable by design — solid amber, diagonal hazard stripe,
          sticky across the whole page, worded to say explicitly what it
          does NOT do. This is the one visual element in this feature that
          matters most: Dev's own ask was that a rehearsal mode needs to be
          impossible to mistake for the real console. */}
      <div
        className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-3 border-b border-black/20"
        style={{
          background:
            "repeating-linear-gradient(135deg, var(--color-status-orange) 0px, var(--color-status-orange) 14px, #1a1206 14px, #1a1206 28px)",
        }}
      >
        <div className="flex items-center gap-2.5 text-background font-semibold">
          <FlaskConical className="h-4.5 w-4.5 shrink-0" strokeWidth={2.5} />
          <span className="text-console-sm uppercase tracking-wide bg-background/90 text-status-orange px-2.5 py-1 rounded-chip">
            Rehearsal Mode — not live
          </span>
          <span className="hidden sm:inline text-console-meta text-background/80">
            Nothing here reaches a real display, share link, or the real Operator Console.
          </span>
        </div>
        <LinkButton href={`/e/${eventId}/operator`} variant="secondary" size="sm">
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} />
          Exit Rehearsal
        </LinkButton>
      </div>

      {!session ? (
        <div className="px-6 py-8">
          {sessions.length > 1 && (
            <SessionSelect sessions={sessions} activeSessionId={activeSessionId} onChange={(id) => {
              setSessionId(id);
              setState({ ...REHEARSAL_INITIAL, activeSessionId: id });
            }} />
          )}
          <p className="text-console-sm text-muted-2 mt-4">No session to rehearse yet — add one in the Cue Sheet first.</p>
        </div>
      ) : (
        // Same rundown-beside-live-state relationship as the real Console's
        // tablet/desktop composition (app/e/[eventId]/operator/page.tsx) —
        // deliberately reused rather than re-invented, so the muscle memory
        // ("the list is on the left, what's happening is on the right")
        // carries over. Single column below lg: — this surface never had
        // Console's Activity/Broadcast/presence weight, so one column at
        // narrow widths doesn't bury anything the way Console's did.
        <div className="flex-1 lg:grid lg:grid-cols-[1fr_380px] flex flex-col">
          <div className="min-w-0 px-4 sm:px-6 lg:px-10 py-6 lg:py-8">
            {sessions.length > 1 && (
              <SessionSelect sessions={sessions} activeSessionId={activeSessionId} onChange={(id) => {
                setSessionId(id);
                setState({ ...REHEARSAL_INITIAL, activeSessionId: id });
              }} />
            )}
            <SectionLabel className={sessions.length > 1 ? "mt-6" : undefined}>
              {session.dayLabel} • {session.sessionLabel}
            </SectionLabel>
            <ul className="mt-3 flex flex-col rounded-panel border border-line-soft overflow-hidden">
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

          <div className="lg:border-l border-line-soft min-w-0 px-4 sm:px-6 lg:px-8 py-6 lg:py-8 flex flex-col gap-8">
            {state.alert && <AlertBanner alert={state.alert} />}

            <section className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <SectionLabel>{isFinished ? "Finished" : live ? "Rehearsing now" : "Not started"}</SectionLabel>
                {state.pausedAt && <OperationalStatus kind="hold" />}
              </div>
              <p className="text-console-lg text-primary mt-1">{isFinished ? "Rehearsal complete" : live ? live.title : "—"}</p>
              {live?.presenter && <p className="text-console-sm text-muted mt-2">{live.presenter}</p>}
              <RunPosition next={next} onDeck={onDeck} />
            </section>

            <section className="flex flex-col gap-3">
              <SectionLabel>Controls</SectionLabel>
              <div className="flex flex-col gap-3">
                {currentOrder === null ? (
                  <Button variant="primary" size="lg" onClick={start}>
                    <Play className="h-4 w-4" strokeWidth={2} />
                    Start Rehearsal
                  </Button>
                ) : (
                  <Button variant="primary" size="lg" onClick={next_} disabled={isFinished || currentOrder >= max}>
                    {currentOrder >= max ? "Finish" : "Next"}
                    <ChevronRight className="h-4 w-4" strokeWidth={2} />
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
                <Button variant="ghost" size="sm" onClick={reset} className="self-start text-muted-2">
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
