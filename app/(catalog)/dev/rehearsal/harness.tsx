"use client";

import { useState } from "react";
import { RehearsalView } from "@/components/rehearsal/rehearsal-view";
import type { Program, Session } from "@/lib/types";

// Synthetic fixtures. Titles say SYNTHETIC so no screenshot can be read as event data.
function item(order: number): Program {
  return {
    id: `synthetic-item-${order}`,
    order,
    type: "item",
    title: `SYNTHETIC cue ${order}`,
    kicker: null,
    itemCode: null,
    presenter: null,
    presenterRequirement: null,
    presenterContact: null,
    sectionLabel: null,
    partitionId: null,
    scheduledStart: null,
    scheduledEnd: null,
    timeIsComputed: false,
    durationMinutes: 5,
    audio: { mic: false, track: false },
    video: { sidescreen: "none", backdrop: false, pptSide: false },
    lights: { hall: null, stage: null },
    cameraAngle: null,
    props: null,
    curtains: null,
    stageNotes: null,
    team: null,
    notes: null,
    status: "confirmed",
    colorTag: null,
    auditoriumId: null,
  };
}

function oneSession(id: string, count: number, label: string): Session {
  return {
    id,
    sheetName: "SYNTHETIC",
    eventName: "SYNTHETIC harness event",
    dayLabel: "SYNTHETIC day",
    sessionLabel: label,
    items: Array.from({ length: count }, (_, i) => item(i + 1)),
    partitions: [],
  };
}

function fixtureSessions(fixture: "none" | "zero" | "one" | "two" | "multi"): Session[] {
  if (fixture === "none") return [];
  if (fixture === "two") return [oneSession("synthetic-session-a", 3, "SYNTHETIC session A"), oneSession("synthetic-session-b", 2, "SYNTHETIC session B")];
  const count = fixture === "zero" ? 0 : fixture === "one" ? 1 : 4;
  return [oneSession("synthetic-session", count, `SYNTHETIC ${fixture}-cue session`)];
}

export function RehearsalHarness({ fixture }: { fixture: "none" | "zero" | "one" | "two" | "multi" }) {
  const [exited, setExited] = useState(false);
  const sessions = fixtureSessions(fixture);
  return (
    <div>
      <p data-harness-banner className="px-6 py-2 text-[12px] uppercase tracking-[0.16em] text-status-orange">
        Synthetic harness, development only. Fixture: {fixture}-cue. Not event data.
      </p>
      {exited && <p data-harness-exit role="status" className="px-6 text-[12px] text-status-green">Exit confirmed. Navigation suppressed in harness.</p>}
      <RehearsalView eventId="synthetic-harness" sessions={sessions} onExit={() => setExited(true)} />
    </div>
  );
}
