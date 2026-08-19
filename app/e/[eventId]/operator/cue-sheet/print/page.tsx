"use client";

import { Fragment, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Printer } from "lucide-react";
import { useSessions } from "@/lib/use-sessions";
import { useEventId } from "@/lib/event-context";
import { Button } from "@/components/ui/button";

// Report finding #28 — a printable/PDF export path for the cue sheet. This
// is a standalone light-on-white page rather than reusing the operator
// console's dark theme: a stage manager's printed rundown needs to be
// legible on paper and cheap to print, not visually consistent with the
// on-screen console. "Export PDF" opens this route, and window.print()
// hands off to the browser's own Save-as-PDF — no PDF-generation
// dependency needed, and it inherits the browser's real pagination instead
// of a hand-rolled one.
export default function CueSheetPrintPage() {
  const eventId = useEventId();
  const sessions = useSessions();
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
        <Link href={`/e/${eventId}/operator/cue-sheet`}>
          <Button variant="ghost" size="sm">
            <ChevronLeft className="h-4 w-4" strokeWidth={2} />
            Back
          </Button>
        </Link>
        <Button variant="primary" size="sm" onClick={() => window.print()}>
          <Printer className="h-4 w-4" strokeWidth={2} />
          Print / Save as PDF
        </Button>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8 print:p-0 print:max-w-none">
        <h1 className="text-2xl font-semibold">{eventName || "Cue Sheet"}</h1>

        {sessions.length === 0 && <p className="mt-4 text-neutral-500">No sessions to print yet.</p>}

        {sessions.map((session, sessionIndex) => {
          const partitionLabel = new Map(session.partitions.map((p) => [p.id, p.label]));
          let lastPartitionKey: string | null | undefined = undefined;
          return (
            <section key={session.id} className={sessionIndex > 0 ? "mt-10 print:break-before-page print:mt-0" : "mt-6"}>
              <h2 className="text-lg font-medium border-b border-neutral-300 pb-1.5">
                {session.dayLabel} • {session.sessionLabel}
              </h2>
              <table className="w-full mt-3 text-sm border-collapse">
                <thead>
                  <tr className="text-left text-neutral-500 border-b border-neutral-300">
                    <th className="py-1.5 pr-2 font-normal w-8">#</th>
                    <th className="py-1.5 pr-2 font-normal w-20">Start</th>
                    <th className="py-1.5 pr-2 font-normal">Item</th>
                    <th className="py-1.5 pr-2 font-normal">Presenter</th>
                    <th className="py-1.5 pr-2 font-normal w-16 text-right">Dur</th>
                  </tr>
                </thead>
                <tbody>
                  {session.items.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-3 text-neutral-400">
                        No items in this session.
                      </td>
                    </tr>
                  )}
                  {session.items.map((item) => {
                    const key = item.partitionId ?? item.sectionLabel ?? null;
                    const showSectionHeader = key !== lastPartitionKey;
                    lastPartitionKey = key;
                    const label = item.partitionId ? partitionLabel.get(item.partitionId) : item.sectionLabel;
                    return (
                      <Fragment key={item.id}>
                        {showSectionHeader && label && (
                          <tr key={`${item.id}-section`}>
                            <td colSpan={5} className="pt-3 pb-1 text-xs font-medium uppercase tracking-wide text-neutral-500">
                              {label}
                            </td>
                          </tr>
                        )}
                        <tr className="border-b border-neutral-100 print:break-inside-avoid">
                          <td className="py-1.5 pr-2 tabular-nums text-neutral-500">{item.order}</td>
                          <td className="py-1.5 pr-2 tabular-nums text-neutral-500">{item.scheduledStart ?? "—"}</td>
                          <td className="py-1.5 pr-2">
                            {item.title}
                            {item.type === "break" && <span className="text-neutral-400"> (break)</span>}
                          </td>
                          <td className="py-1.5 pr-2 text-neutral-600">{item.presenter ?? ""}</td>
                          <td className="py-1.5 pr-2 tabular-nums text-neutral-500 text-right">
                            {item.durationMinutes > 0 ? `${item.durationMinutes}m` : ""}
                          </td>
                        </tr>
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </section>
          );
        })}
      </div>
    </main>
  );
}
