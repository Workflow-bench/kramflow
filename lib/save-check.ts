// Read-only "Check whether it saved" for a cue save whose outcome is unknown
// (dropped connection, or the client stopped waiting). It reports what the
// server shows at the moment of the check — never a conclusion about whether
// *this* submission succeeded, and never that a retry is safe:
//   - an absent cue may still appear, because the original request can
//     commit after this GET;
//   - a same-name cue may be an earlier one;
//   - a newer version may come from another editor.

export interface SubmittedSnapshot {
  /** Taken at submit time; later draft edits never change it. */
  name: string;
  sessionId: string;
  /** Edits only: the version the form opened and sent. */
  version?: number;
}

export interface CheckedRow {
  id: string;
  name: string;
  version: number;
}

export type SaveCheckResult =
  | { kind: "create-none-visible" }
  | { kind: "create-name-visible"; count: number; name: string }
  | { kind: "edit-missing" }
  | { kind: "edit-version-unchanged"; version: number }
  | { kind: "edit-version-changed"; from: number; to: number }
  | { kind: "edit-version-unknown" }
  | { kind: "check-failed" };

export function interpretSaveCheck(
  submitted: SubmittedSnapshot,
  programId: string | undefined,
  rows: CheckedRow[] | null
): SaveCheckResult {
  if (rows === null) return { kind: "check-failed" };
  if (programId) {
    const row = rows.find((r) => r.id === programId);
    if (!row) return { kind: "edit-missing" };
    if (submitted.version === undefined) return { kind: "edit-version-unknown" };
    return row.version === submitted.version
      ? { kind: "edit-version-unchanged", version: row.version }
      : { kind: "edit-version-changed", from: submitted.version, to: row.version };
  }
  const name = submitted.name.trim().toLowerCase();
  const matches = rows.filter((r) => r.name.trim().toLowerCase() === name);
  return matches.length === 0
    ? { kind: "create-none-visible" }
    : { kind: "create-name-visible", count: matches.length, name: matches[0].name };
}

export function describeSaveCheck(result: SaveCheckResult, submittedName: string): string {
  const name = submittedName.trim();
  switch (result.kind) {
    case "create-none-visible":
      return `No cue named “${name}” is visible in that session at this check. The original request may still finish, so we can’t confirm whether it saved. Your draft is still here; check again in a moment.`;
    case "create-name-visible":
      return result.count === 1
        ? `A cue named “${result.name}” is in that session. It could be this submission or an earlier cue. Inspect it in the cue sheet before deciding what to do.`
        : `${result.count} cues named “${result.name}” are in that session. Any of them could be this submission or an earlier cue. Inspect them in the cue sheet before deciding what to do.`;
    case "edit-missing":
      return "This cue isn’t visible in that session at this check. Reload the cue sheet before deciding what to do.";
    case "edit-version-unchanged":
      return `The server still shows the version you opened (version ${result.version}) at this check. The original request may still finish, so we can’t confirm whether it saved. Your changes are still here; check again in a moment.`;
    case "edit-version-changed":
      return `The server version changed since you opened this cue (version ${result.from} to ${result.to}). That could be your edit or someone else’s. Compare the current values in the cue sheet with your changes before deciding what to do.`;
    case "edit-version-unknown":
      return "The cue is visible, but there’s no version to compare with. Compare the current values in the cue sheet with your changes before deciding what to do.";
    case "check-failed":
      return "Couldn’t check right now. Your draft is still here. Try the check again, or open the cue sheet in another tab.";
  }
}

type FetchLike = (input: string, init?: { method?: string }) => Promise<{ ok: boolean; json: () => Promise<unknown> }>;

/** GET only. Returns null when the check itself fails. */
export async function fetchSessionRows(fetchImpl: FetchLike, eventId: string, sessionId: string): Promise<CheckedRow[] | null> {
  try {
    const res = await fetchImpl(
      `/api/programs?eventId=${encodeURIComponent(eventId)}&sessionId=${encodeURIComponent(sessionId)}`,
      { method: "GET" }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { programs?: CheckedRow[] } | null;
    return data?.programs ?? [];
  } catch {
    return null;
  }
}

/** How long the form waits for a save before treating the outcome as unknown.
 *  The request is not cancelled — the server may still commit it. */
export const SAVE_WAIT_MS = 20_000;

export type SaveRace<T> = { settled: true; value: T } | { settled: false };

/** Waits up to `ms` for `request`; on timeout resolves `{ settled: false }`
 *  and leaves `request` running (its later result can still be observed). */
export function waitAtMost<T>(request: Promise<T>, ms: number): Promise<SaveRace<T>> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => resolve({ settled: false }), ms);
    request.then(
      (value) => {
        clearTimeout(timer);
        resolve({ settled: true, value });
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

/** The snapshot a check compares against: what was sent, never the live
 *  draft. Falls back to the draft only before anything was submitted. */
export function snapshotForCheck(submitted: SubmittedSnapshot | null, draft: SubmittedSnapshot): SubmittedSnapshot {
  return submitted ?? draft;
}

export type ResponseMode = "current" | "late" | "earlier";

export interface AttemptState {
  /** Timed-out requests still running. */
  pending: number;
  /** Earlier timed-out requests that later returned OK. */
  earlierSaved: number;
  /** Earlier create attempts whose outcome stays unknown for good: the
   *  connection failed, or the server answered 5xx, with no later answer to
   *  settle it. Separate from `pending` (still waiting for a response). An
   *  edit never counts: the version-guarded PATCH means a later successful
   *  edit rules out the earlier one having applied. */
  unresolved: number;
  /** This form has shown an unknown outcome before. */
  hadUnknown: boolean;
}

export type SaveResponseKind =
  | "earlier-accepted"
  | "earlier-error"
  | "unknown-server-error"
  | "conflict"
  | "conflict-maybe-own-attempt"
  | "failed"
  | "saved-close"
  | "saved-late"
  | "saved-earlier-pending"
  | "saved-earlier-unresolved"
  | "saved-earlier-accepted";

/** How the form should treat one save answer. A 5xx never counts as "not
 *  saved" (a gateway can time out after the write committed), a 409 after an
 *  unknown outcome may be the user's own earlier attempt, and a success never
 *  closes silently while an earlier attempt might add a second copy. */
export function classifySaveResponse(res: { ok: boolean; status: number }, mode: ResponseMode, attempts: AttemptState): SaveResponseKind {
  if (mode === "earlier") return res.ok ? "earlier-accepted" : "earlier-error";
  if (!res.ok) {
    if (res.status >= 500) return "unknown-server-error";
    if (res.status === 409) return attempts.hadUnknown ? "conflict-maybe-own-attempt" : "conflict";
    return "failed";
  }
  if (mode === "late") return "saved-late";
  if (attempts.earlierSaved > 0) return "saved-earlier-accepted";
  if (attempts.pending > 0) return "saved-earlier-pending";
  if (attempts.unresolved > 0) return "saved-earlier-unresolved";
  return "saved-close";
}
