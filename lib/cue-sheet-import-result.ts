import type { ParsedSession } from "./parse-cuesheet";
import type { Session } from "./types";

// Pure helpers for the cue-sheet import review and result steps (Lane C).
// Sessions are matched by their day and session labels, not by id: the server
// stores a repeat import under an event-scoped id (B006-S1), so an id match
// misses a session this event already has.

// What a panel reports after a successful commit. `sessionIds` is the server's
// source-to-stored map; `sessions` and `programs` are what was submitted.
export interface ImportDone {
  sessionIds: Record<string, string>;
  sessions: ParsedSession[];
  programs: { session_id: string }[];
}

function labelKey(dayLabel: string, sessionLabel: string): string {
  return `${dayLabel.trim().toLowerCase()}\u0000${sessionLabel.trim().toLowerCase()}`;
}

// Existing sessions of this event that the import will replace wholesale.
export function replacedSessions(existing: Session[], parsed: ParsedSession[]): Session[] {
  const keys = new Set(parsed.map((s) => labelKey(s.day_label, s.session_label)));
  return existing.filter((s) => keys.has(labelKey(s.dayLabel, s.sessionLabel)));
}

export interface ImportedSessionChoice {
  storedId: string;
  dayLabel: string;
  sessionLabel: string;
  itemCount: number;
}

// The sessions this import wrote, in the order the file listed them, with the
// id each was stored under. `sessionIds` is the server's source-to-stored map.
export function importedSessionChoices(
  sessionIds: Record<string, string>,
  parsed: ParsedSession[],
  programs: { session_id: string }[]
): ImportedSessionChoice[] {
  const choices: ImportedSessionChoice[] = [];
  for (const s of parsed) {
    const storedId = sessionIds[s.id];
    if (!storedId) continue;
    choices.push({
      storedId,
      dayLabel: s.day_label,
      sessionLabel: s.session_label,
      itemCount: programs.filter((p) => p.session_id === s.id).length,
    });
  }
  return choices;
}
