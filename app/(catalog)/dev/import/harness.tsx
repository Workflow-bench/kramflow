"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { UploadPanel, type UploadApi } from "@/components/cue-sheet/upload-panel";
import { ImportCompleteStep } from "@/components/cue-sheet/import-complete";
import { planOpenConsole, type OpenConsolePlan } from "@/lib/cue-sheet-open";
import { importedSessionChoices, type ImportDone, type ImportedSessionChoice } from "@/lib/cue-sheet-import-result";
import type { ParsedProgram, ParsedSession } from "@/lib/parse-cuesheet";
import type { Session } from "@/lib/types";

// SYNTHETIC. Two sessions, every title says SYNTHETIC. The request function below
// answers /api/cue-sheet/upload itself; no request leaves the page.
const PREVIEW_SESSIONS: ParsedSession[] = [
  { id: "sat-am", sheet_name: "SYNTHETIC", event_name: "SYNTHETIC event", day_label: "SYNTHETIC Sat", session_label: "AM", sort_order: 0 },
  { id: "sat-pm", sheet_name: "SYNTHETIC", event_name: "SYNTHETIC event", day_label: "SYNTHETIC Sat", session_label: "PM", sort_order: 1 },
];
const PREVIEW_PROGRAMS: ParsedProgram[] = [
  { sort_order: 1, session_id: "sat-am", section_label: null, partition_id: null, type: "item", name: "SYNTHETIC cue A1", description: null, presenter: null, duration: 5 } as ParsedProgram,
  { sort_order: 2, session_id: "sat-am", section_label: null, partition_id: null, type: "item", name: "SYNTHETIC cue A2", description: null, presenter: null, duration: 5 } as ParsedProgram,
  { sort_order: 1, session_id: "sat-pm", section_label: null, partition_id: null, type: "item", name: "SYNTHETIC cue P1", description: null, presenter: null, duration: 5 } as ParsedProgram,
];

// Stored ids: the second session is stored under an event-scoped id (the server's
// B006-S1 mapping), so the choice list must follow the server map, not the file ids.
const SERVER_SESSION_IDS: Record<string, string> = { "sat-am": "sat-am", "sat-pm": "sat-pm~harness" };

function syntheticApi(fail: "none" | "parse" | "commit", log: string[]): UploadApi {
  return {
    async post(url) {
      log.push(`request ${url}`);
      if (url.includes("dryRun=1")) {
        if (fail === "parse") return Response.json({ ok: false, error: "SYNTHETIC parse error: row 3 has no session label" }, { status: 400 });
        return Response.json({ sessions: PREVIEW_SESSIONS, programs: PREVIEW_PROGRAMS, errors: [] }, { status: 200 });
      }
      if (fail === "commit") return Response.json({ ok: false, error: "SYNTHETIC commit failed; nothing was written" }, { status: 500 });
      return Response.json({ ok: true, sessionIds: SERVER_SESSION_IDS }, { status: 200 });
    },
  };
}

// Controlled local store. Holds the live session and control lock for the harness
// only. Persisted in sessionStorage so a reload (refresh coherence) reads the same
// state the console stub reads. Not the real store: no server, no Realtime, no lease.
export const HARNESS_STORE_KEY = "kf-harness-store";
export interface HarnessStore { activeSessionId: string; started: boolean; lockedByOther: boolean }

export function seedStore(live: "none" | "started" | "locked"): HarnessStore {
  if (live === "started") return { activeSessionId: "sat-pm~harness", started: true, lockedByOther: false };
  if (live === "locked") return { activeSessionId: "", started: false, lockedByOther: true };
  return { activeSessionId: "", started: false, lockedByOther: false };
}

// useSyncExternalStore needs a stable snapshot: the same raw string returns the same object.
let cachedRaw: string | null | undefined;
let cachedStore: HarnessStore | null = null;
export function readStore(fallback: HarnessStore): HarnessStore {
  let raw: string | null = null;
  try {
    raw = window.sessionStorage.getItem(HARNESS_STORE_KEY);
  } catch {
    return fallback;
  }
  if (raw === cachedRaw && cachedStore) return cachedStore;
  cachedRaw = raw;
  cachedStore = raw ? (JSON.parse(raw) as HarnessStore) : fallback;
  return cachedStore;
}

const STORE_EVENT = "kf-harness-store-change";

function writeStore(next: HarnessStore) {
  try {
    window.sessionStorage.setItem(HARNESS_STORE_KEY, JSON.stringify(next));
  } catch {
    // Storage unavailable (private window): the harness still runs for this page view.
  }
  window.dispatchEvent(new Event(STORE_EVENT));
}

function subscribeStore(onChange: () => void) {
  window.addEventListener(STORE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(STORE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function ImportHarness({ live, fail }: { live: "none" | "started" | "locked"; fail: "none" | "parse" | "commit" }) {
  const router = useRouter();
  const [log] = useState<string[]>([]);
  const [choices, setChoices] = useState<ImportedSessionChoice[] | null>(null);
  const [outcome, setOutcome] = useState<{ plan: OpenConsolePlan; chosen: string } | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const api = useMemo(() => syntheticApi(fail, log), [fail, log]);
  // Read through useSyncExternalStore: the fixture seed on the server and during
  // hydration, then whatever the last Open console wrote (survives a reload).
  const seed = useMemo(() => seedStore(live), [live]);
  const store = useSyncExternalStore(subscribeStore, () => readStore(seed), () => seed);
  // First visit: write the fixture seed so the Console stub reads the same state the
  // import page does. Only when nothing is stored yet, so a reload keeps the last choice.
  useEffect(() => {
    try {
      if (window.sessionStorage.getItem(HARNESS_STORE_KEY) === null) writeStore(seed);
    } catch {
      // Storage unavailable: the page still runs on the fixture seed.
    }
  }, [seed]);
  const liveId = store.activeSessionId;
  const liveHasStarted = store.started;
  const lockedByOther = store.lockedByOther;
  const sessions: Session[] = [];

  function onDone(done: ImportDone) {
    setChoices(importedSessionChoices(done.sessionIds, done.sessions, done.programs));
    setOutcome(null);
  }

  function onOpen(choice: ImportedSessionChoice) {
    const plan = planOpenConsole({
      chosenStoredId: choice.storedId,
      liveId,
      lockedByOther,
      liveHasStarted,
      dayLabel: choice.dayLabel,
      sessionLabel: choice.sessionLabel,
    });
    // The real page calls selectSession() for "select-then-navigate". The harness does
    // the same against the controlled store, then navigates like the page does.
    let next = store;
    if (plan.kind === "select-then-navigate") {
      next = { ...store, activeSessionId: choice.storedId, started: false };
      setSelected((s) => [...s, choice.storedId]);
      writeStore(next);
    }
    setOutcome({ plan, chosen: `${choice.dayLabel} • ${choice.sessionLabel}` });
    if (plan.kind === "navigate" || plan.kind === "toast-then-navigate" || plan.kind === "select-then-navigate") {
      router.push("/dev/import/console");
    }
  }

  return (
    <div className="p-6 flex flex-col gap-6">
      <p data-harness-banner className="text-[12px] uppercase tracking-[0.16em] text-status-orange">
        Synthetic harness, development only. Fixture: live={live}, fail={fail}. Not event data.
      </p>
      {choices === null ? (
        <UploadPanel eventId="synthetic-harness" sessions={sessions} onDone={onDone} onCancel={() => setOutcome(null)} api={api} />
      ) : (
        <>
          <ImportCompleteStep choices={choices} onOpen={onOpen} onStay={() => setChoices(null)} />
          {outcome && (
            <p data-harness-outcome role="status" className="text-console-sm text-muted">
              {outcome.chosen}: {describe(outcome.plan)}
            </p>
          )}
        </>
      )}
      <pre data-harness-log className="text-[11px] text-muted-2">{log.join("\n")}</pre>
      <pre data-harness-selected className="text-[11px] text-muted-2">{`selectSession calls: ${selected.join(", ") || "none"}`}</pre>
      <p data-harness-store className="text-[11px] text-muted-2">{`store: active=${store.activeSessionId || "none"} started=${store.started} locked=${store.lockedByOther}`}</p>
    </div>
  );
}

function describe(plan: OpenConsolePlan): string {
  switch (plan.kind) {
    case "navigate":
      return "opens the console on the already-live session (no selection)";
    case "refuse-locked":
      return "refused: locked by another operator; stays on the cue sheet";
    case "toast-then-navigate":
      return `does not switch the running session: "${plan.message}"`;
    case "select-then-navigate":
      return "makes this session live (explicit click), then opens the console";
  }
}
