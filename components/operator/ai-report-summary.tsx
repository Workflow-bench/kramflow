"use client";

import { useMemo, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { computeSessionTimingReport } from "@/lib/timing";
import type { LiveState, Session } from "@/lib/types";
import { useAiEnabled } from "@/lib/use-ai-enabled";

interface Narrative {
  headline: string;
  summary: string;
  went_well: string[];
  lost_time: string[];
  next_time: string[];
}

// Written summary at the top of the timing report. Every figure is computed
// by computeSessionTimingReport (the same numbers the tables below show);
// the AI only turns them into prose, so what it says can be checked against
// the table. Once generated it prints with the rest of the page.
export function AiReportSummary({
  eventId,
  eventName,
  sessions,
  state,
}: {
  eventId: string;
  eventName: string;
  sessions: Session[];
  state: LiveState;
}) {
  const enabled = useAiEnabled();
  const [narrative, setNarrative] = useState<Narrative | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busyRef = useRef(false);

  const payload = useMemo(
    () =>
      sessions
        .map((session) => ({ session, report: computeSessionTimingReport(session, state) }))
        .filter(({ report }) => report.actualStart !== null)
        .map(({ session, report }) => ({
          label: `${session.dayLabel} • ${session.sessionLabel}`,
          isFinished: report.isFinished,
          plannedMinutes: report.plannedDurationMinutes,
          actualMinutes: report.actualDurationMinutes,
          startVarianceMinutes: report.startVarianceMinutes,
          finishVarianceMinutes: report.finishVarianceMinutes,
          items: report.items.map((i) => ({
            name: i.program.title,
            plannedMinutes: i.plannedMinutes,
            actualMinutes: i.actualMinutes,
            varianceMinutes: i.varianceMinutes,
            exception: i.exception,
          })),
        })),
    [sessions, state]
  );

  if (!enabled) return null;

  async function run() {
    if (busyRef.current || payload.length === 0) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/session-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, eventName, sessions: payload }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setError(data?.error ?? "Couldn't write the summary. Try again.");
        return;
      }
      setNarrative(data.narrative);
    } catch {
      setError("Couldn't reach the server. Try again.");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="mt-6">
      <div className="print:hidden flex items-center gap-3 flex-wrap">
        <Button variant="secondary" size="sm" onClick={run} loading={busy} disabled={payload.length === 0}>
          <Sparkles className="h-4 w-4" strokeWidth={2} />
          {narrative ? "Rewrite summary" : "Write summary with AI"}
        </Button>
        {payload.length === 0 && <span className="text-sm text-neutral-500">Run a session first to summarize it.</span>}
        {error && <span className="text-sm text-red-700">{error}</span>}
      </div>

      {narrative && (
        <section className="mt-4 rounded border border-neutral-200 bg-neutral-50 px-4 py-3 print:break-inside-avoid">
          <h2 className="text-lg font-medium">{narrative.headline}</h2>
          <p className="mt-1.5 text-sm text-neutral-700">{narrative.summary}</p>
          <BulletGroup title="Went well" items={narrative.went_well} />
          <BulletGroup title="Where time was lost" items={narrative.lost_time} />
          <BulletGroup title="For next time" items={narrative.next_time} />
          <p className="mt-3 text-xs text-neutral-500">
            Written by AI from the timing figures below. It describes what the numbers show, not why it happened.
          </p>
        </section>
      )}
    </div>
  );
}

function BulletGroup({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="mt-3 text-sm text-neutral-700">
      <p className="font-medium text-neutral-800">{title}</p>
      <ul className="mt-1 list-disc list-inside">
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
