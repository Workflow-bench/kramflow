"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, Printer } from "lucide-react";
import { useSessions } from "@/lib/use-sessions";
import { useEventStore } from "@/lib/store";
import { useEventId } from "@/lib/event-context";
import { computeSessionTimingReport, formatClockTime, formatMinutes, type ItemVariance } from "@/lib/timing";
import type { LiveState, Session } from "@/lib/types";
import { Button, LinkButton } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const EXCEPTION_LABEL: Record<ItemVariance["exception"], string> = {
  none: "",
  "in-progress": "in progress",
  "not-reached": "not yet reached",
  skipped: "never run",
  interrupted: "interrupted",
};

// C. PROFESSIONAL WORKFLOW GAP — "what actually happened, vs. what was
// planned" had no answer anywhere once a session ended beyond Console's own
// SessionSummary (components/operator/live-details-panel.tsx), a brief
// glance-and-move-on card that derives its one "actual runtime" number from
// activity_log's Started/Finished string-matching (a real, pre-existing,
// documented limitation of that component — activity_log has no
// session_id). This is the fuller item-by-item version, reusing the SAME
// canonical timing engine (lib/timing.ts's computeSessionTimingReport) the
// live Operator Console projection uses — deliberately built on item_actuals
// instead, which IS keyed correctly per session (via each program's own
// id), not a second, independently-arrived-at set of numbers.
//
// Same print-to-PDF pattern the Cue Sheet already established (see
// .../cue-sheet/print/page.tsx's own comment) — a standalone light page,
// window.print() hands off to the browser's real Save-as-PDF, no second
// PDF-generation stack. No CSV/export variant: nothing here is meaningfully
// reusable as raw data outside this page (it's a summary derived on the
// fly from item_actuals, not a source-of-truth data export).
export default function TimingReportPage() {
  const eventId = useEventId();
  const sessions = useSessions();
  const { state } = useEventStore();
  const [eventName, setEventName] = useState("");

  useEffect(() => {
    fetch(`/api/events/${eventId}`)
      .then((res) => res.json())
      .then((data) => setEventName(data?.event?.name ?? ""))
      .catch(() => {});
  }, [eventId]);

  return (
    <main className="min-h-screen bg-white text-black">
      <div className="print:hidden sticky top-0 flex items-center justify-between gap-3 border-b border-neutral-200 bg-white px-6 h-14">
        <LinkButton href={`/e/${eventId}/operator/cue-sheet`} variant="ghost" size="sm">
          <ChevronLeft className="h-4 w-4" strokeWidth={2} />
          Back
        </LinkButton>
        <Button variant="primary" size="sm" onClick={() => window.print()}>
          <Printer className="h-4 w-4" strokeWidth={2} />
          Print / Save as PDF
        </Button>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8 print:p-0 print:max-w-none">
        <h1 className="text-2xl font-semibold">{eventName || "Timing Report"}</h1>
        <p className="text-neutral-500 text-sm mt-1">Planned vs. actual — one section per session, most recent run only.</p>

        {sessions.length === 0 && <p className="mt-4 text-neutral-500">No sessions to report on yet.</p>}

        {sessions.map((session, sessionIndex) => (
          <SessionReportSection
            key={session.id}
            session={session}
            state={state}
            isFirst={sessionIndex === 0}
          />
        ))}
      </div>
    </main>
  );
}

function SessionReportSection({ session, state, isFirst }: { session: Session; state: LiveState; isFirst: boolean }) {
  const report = computeSessionTimingReport(session, state);
  const hasRun = report.actualStart !== null;
  const isFinished = report.isFinished;

  return (
    <section className={isFirst ? "mt-6" : "mt-10 print:break-before-page print:mt-0"}>
      <h2 className="text-lg font-medium border-b border-neutral-300 pb-1.5">
        {session.dayLabel} • {session.sessionLabel}
      </h2>

      {!hasRun ? (
        <p className="mt-3 text-neutral-500 text-sm">This session has not been run yet — nothing to report.</p>
      ) : (
        <>
          {!isFinished && (
            <p className="mt-3 text-sm text-neutral-500 bg-neutral-50 border border-neutral-200 rounded px-3 py-2">
              This session is still in progress — figures below reflect what&apos;s happened so far, not a final
              summary. Items not yet reached aren&apos;t listed as exceptions.
            </p>
          )}

          {/* SESSION SUMMARY */}
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-3">
            <Stat label="Planned" value={formatMinutes(report.plannedDurationMinutes)} />
            <Stat
              label="Actual"
              value={isFinished && report.actualDurationMinutes !== null ? formatMinutes(report.actualDurationMinutes) : "In progress"}
            />
            <Stat
              label="Ran"
              value={
                report.actualStart && isFinished && report.actualFinish
                  ? `${formatClockTime(report.actualStart)} – ${formatClockTime(report.actualFinish)}`
                  : report.actualStart
                    ? `${formatClockTime(report.actualStart)} – in progress`
                    : "—"
              }
            />
            <Stat
              label="Completed items"
              value={`${report.items.filter((i) => i.exception === "none").length}/${report.items.length}`}
            />
          </div>

          {/* TIMING OUTCOME */}
          <div className="mt-5 flex flex-wrap gap-x-8 gap-y-2 text-sm">
            <VarianceStat label="Start variance" minutes={report.startVarianceMinutes} />
            {isFinished && <VarianceStat label="Finish variance" minutes={report.finishVarianceMinutes} />}
            <BiggestVariance label="Biggest overrun" items={report.items} direction="over" />
            <BiggestVariance label="Biggest underrun" items={report.items} direction="under" />
          </div>

          {/* ITEM-BY-ITEM VARIANCE */}
          <table className="w-full mt-5 text-sm border-collapse">
            <thead>
              <tr className="text-left text-neutral-500 border-b border-neutral-300">
                <th className="py-1.5 pr-2 font-normal w-8">#</th>
                <th className="py-1.5 pr-2 font-normal">Item</th>
                <th className="py-1.5 pr-2 font-normal w-16 text-right">Planned</th>
                <th className="py-1.5 pr-2 font-normal w-16 text-right">Actual</th>
                <th className="py-1.5 pr-2 font-normal w-24 text-right">Variance</th>
              </tr>
            </thead>
            <tbody>
              {report.items.map((item) => (
                <tr key={item.program.id} className="border-b border-neutral-100 print:break-inside-avoid">
                  <td className="py-1.5 pr-2 tabular-nums text-neutral-500">{item.program.order}</td>
                  <td className="py-1.5 pr-2">
                    {item.program.title}
                    {item.program.type === "break" && <span className="text-neutral-400"> (break)</span>}
                  </td>
                  <td className="py-1.5 pr-2 tabular-nums text-neutral-500 text-right">
                    {item.plannedMinutes > 0 ? `${item.plannedMinutes}m` : "—"}
                  </td>
                  <td className="py-1.5 pr-2 tabular-nums text-neutral-500 text-right">
                    {item.actualMinutes !== null ? `${item.actualMinutes}m` : "—"}
                  </td>
                  <td className="py-1.5 pr-2 tabular-nums text-right">
                    {item.varianceMinutes !== null ? (
                      <span className={cn(item.varianceMinutes > 0 ? "text-orange-700" : item.varianceMinutes < 0 ? "text-blue-700" : "text-neutral-400")}>
                        {item.varianceMinutes > 0 ? "+" : ""}
                        {item.varianceMinutes}m {item.varianceMinutes > 0 ? "over" : item.varianceMinutes < 0 ? "under" : ""}
                      </span>
                    ) : (
                      <span className="text-neutral-400">{EXCEPTION_LABEL[item.exception]}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* NOTABLE EXCEPTIONS — only genuinely notable states: a real
              skip or a real interruption. "in-progress" (the live item)
              and "not-reached" (hasn't happened yet) are the expected,
              unremarkable state of a session that's still running, so
              they're excluded here even though the table above still
              shows them accurately. */}
          {report.items.some((i) => i.exception === "skipped" || i.exception === "interrupted") && (
            <div className="mt-4 text-sm text-neutral-600">
              <p className="font-medium text-neutral-700">Notable exceptions</p>
              <ul className="mt-1.5 list-disc list-inside">
                {report.items
                  .filter((i) => i.exception === "skipped" || i.exception === "interrupted")
                  .map((i) => (
                    <li key={i.program.id}>
                      {i.program.title} — {i.exception === "skipped" ? "never run" : "started but not completed (interrupted)"}
                    </li>
                  ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-lg tabular-nums">{value}</p>
      <p className="text-xs text-neutral-500 mt-0.5">{label}</p>
    </div>
  );
}

function VarianceStat({ label, minutes }: { label: string; minutes: number | null }) {
  if (minutes === null) {
    return (
      <p>
        <span className="text-neutral-500">{label}:</span> <span className="text-neutral-400">—</span>
      </p>
    );
  }
  const word = minutes > 0 ? "late" : minutes < 0 ? "early" : "on time";
  return (
    <p>
      <span className="text-neutral-500">{label}:</span>{" "}
      <span className={minutes > 0 ? "text-orange-700" : minutes < 0 ? "text-blue-700" : "text-neutral-700"}>
        {minutes === 0 ? "On time" : `${Math.abs(minutes)}m ${word}`}
      </span>
    </p>
  );
}

function BiggestVariance({ label, items, direction }: { label: string; items: ItemVariance[]; direction: "over" | "under" }) {
  const candidates = items.filter((i) => i.varianceMinutes !== null && (direction === "over" ? i.varianceMinutes > 0 : i.varianceMinutes < 0));
  if (candidates.length === 0) {
    return (
      <p>
        <span className="text-neutral-500">{label}:</span> <span className="text-neutral-400">none</span>
      </p>
    );
  }
  const worst = candidates.reduce((a, b) => (Math.abs(a.varianceMinutes!) > Math.abs(b.varianceMinutes!) ? a : b));
  return (
    <p>
      <span className="text-neutral-500">{label}:</span>{" "}
      <span className={direction === "over" ? "text-orange-700" : "text-blue-700"}>
        {worst.program.title} ({worst.varianceMinutes! > 0 ? "+" : ""}
        {worst.varianceMinutes}m)
      </span>
    </p>
  );
}
