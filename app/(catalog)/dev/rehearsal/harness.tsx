"use client";

import { useEffect, useState } from "react";
import { setSessionUserId } from "@/lib/auth/session-identity";
import { resetRehearsalRuns } from "@/components/rehearsal/persisted-run";
import { authEventEffect, lockEffect, type AuthEventName } from "@/lib/auth/auth-events";
import Link from "next/link";
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

export function RehearsalHarness({
  fixture,
  user,
  cues,
}: {
  fixture: "none" | "zero" | "one" | "two" | "multi";
  user: "a" | "b" | "none";
  cues: "current" | "changed";
}) {
  const [exited, setExited] = useState(false);
  // Synthetic identity for the harness only. Real identity comes from the auth provider.
  useEffect(() => {
    setSessionUserId(user === "none" ? null : `synthetic-user-${user}`);
  }, [user]);
  const sessions = fixtureSessions(fixture);
  if (cues === "changed" && sessions[0]?.items[1]) sessions[0].items[1] = { ...sessions[0].items[1], title: "SYNTHETIC cue 2 (renamed)" };
  return (
    <div>
      <p data-harness-banner className="px-6 py-2 text-[12px] uppercase tracking-[0.16em] text-status-orange">
        Synthetic harness, development only. Fixture: {fixture}-cue. Not event data.
      </p>
      <p className="px-6 text-[12px] flex gap-4">
        <button type="button" data-signout onClick={() => { const e = lockEffect(true); if (e) { resetRehearsalRuns(); setSessionUserId(e.identity); } }}>Sign out (synthetic, confirmed)</button>
        <button type="button" data-signout-failed onClick={() => { const e = lockEffect(false); if (e) { resetRehearsalRuns(); setSessionUserId(e.identity); } }}>Sign out (synthetic, server did not confirm)</button>
        <button type="button" data-auth="TOKEN_REFRESHED" onClick={() => { const e = authEventEffect("TOKEN_REFRESHED" as AuthEventName, "synthetic-user-a"); setSessionUserId(e.identity); if (e.clearRuns) resetRehearsalRuns(); }}>Token refreshed (A)</button>
        <button type="button" data-auth="SIGNED_IN-B" onClick={() => { const e = authEventEffect("SIGNED_IN" as AuthEventName, "synthetic-user-b"); setSessionUserId(e.identity); if (e.clearRuns) resetRehearsalRuns(); }}>Signed in as B</button>
        <button type="button" data-auth="SIGNED_IN-A" onClick={() => { const e = authEventEffect("SIGNED_IN" as AuthEventName, "synthetic-user-a"); setSessionUserId(e.identity); if (e.clearRuns) resetRehearsalRuns(); }}>Signed in as A</button>
      </p>
      <p className="px-6 text-[12px]"><Link data-in-app-link href="/dev/import?live=none" className="underline">In-app link (router navigation)</Link></p>
      {exited && <p data-harness-exit role="status" className="px-6 text-[12px] text-status-green">Exit confirmed. Navigation suppressed in harness.</p>}
      <RehearsalView eventId="synthetic-harness" sessions={sessions} onExit={() => setExited(true)} />
    </div>
  );
}
