// Save-attempt lifecycle for the cue form, kept free of React so the timing
// cases can be tested with deferred responses and fake timers.
//
// Rules:
// - One deadline covers the whole answer: waiting for headers, and reading
//   the body of an error answer. A 2xx needs no body (the API's success
//   contract is the status), so it's never read. A body that stalls past the
//   deadline is given up; the status alone still decides.
// - Which attempt an answer belongs to — current, late (current but already
//   timed out) or earlier (superseded by a newer submit) — is decided after
//   every await, immediately before anything is reported.
// - A read-only check reports only if no newer submit or check started while
//   its GET was in flight.
// - A success reports whether the draft still matches what was sent, so the
//   form clears "unsaved changes" only for the revision that was saved.
// - Nothing here ever re-sends.

import {
  classifySaveResponse,
  fetchSessionRows,
  interpretSaveCheck,
  snapshotForCheck,
  waitAtMost,
  type CheckedRow,
  type ResponseMode,
  type SaveCheckResult,
  type SaveResponseKind,
  type SubmittedSnapshot,
} from "./save-check";

export interface ResponseLike {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}

export interface SaveAnswer {
  ok: boolean;
  status: number;
  fieldErrors?: Record<string, string[]>;
  /** The error body didn't arrive before the deadline. */
  bodyTimedOut?: boolean;
}

export type SaveEffect =
  | { type: "saving"; value: boolean }
  | { type: "unknown"; reason: "timeout" | "network" }
  | {
      type: "answer";
      kind: SaveResponseKind;
      mode: ResponseMode;
      status: number;
      fieldErrors?: Record<string, string[]>;
      /** An error body didn't arrive in time, so field errors are unknown. */
      bodyTimedOut?: boolean;
      /** The draft still equals the submitted revision. */
      revisionMatches: boolean;
      /** What this attempt sent (e.g. which session to refresh). */
      snapshot: SubmittedSnapshot;
      /** Earlier create attempts with an outcome that can't be settled. */
      earlierUnresolved: number;
    }
  | { type: "checking"; value: boolean }
  | { type: "check"; result: SaveCheckResult; snapshot: SubmittedSnapshot };

/** Status first; the body only for errors, and only within `remainingMs`. */
export async function readSaveAnswer(res: ResponseLike, remainingMs: number): Promise<SaveAnswer> {
  if (res.ok) return { ok: true, status: res.status };
  if (remainingMs <= 0) return { ok: false, status: res.status, bodyTimedOut: true };
  try {
    const body = await waitAtMost(
      res.json().catch(() => null),
      remainingMs
    );
    if (!body.settled) return { ok: false, status: res.status, bodyTimedOut: true };
    const data = body.value as { errors?: { fieldErrors?: Record<string, string[]> } } | null;
    return { ok: false, status: res.status, fieldErrors: data?.errors?.fieldErrors };
  } catch {
    return { ok: false, status: res.status };
  }
}

interface Attempt {
  id: number;
  revision: number;
  snapshot: SubmittedSnapshot;
  timedOut: boolean;
}

export interface SaveSessionOptions {
  deadlineMs: number;
  /** Receives every effect. Can also be set later with `setHandler`. */
  emit?: (effect: SaveEffect) => void;
  now?: () => number;
}

export class SaveSession {
  private seq = 0;
  private current: Attempt | null = null;
  private checkSeq = 0;
  /** Timed-out requests still running. */
  private pending = 0;
  private earlierSaved = 0;
  /** Earlier create attempts whose outcome can no longer be settled. */
  private unresolved = 0;
  private hadUnknown = false;
  /** Draft revision, bumped on every edit. */
  private revision = 0;
  private handler: (effect: SaveEffect) => void;

  constructor(private readonly opts: SaveSessionOptions) {
    this.handler = opts.emit ?? (() => {});
  }

  /** The component re-points this after each render so effects use fresh props. */
  setHandler(handler: (effect: SaveEffect) => void) {
    this.handler = handler;
  }

  /** Call on every draft edit. */
  noteEdit() {
    this.revision++;
  }

  private emit(effect: SaveEffect) {
    this.handler(effect);
  }

  private now() {
    return (this.opts.now ?? Date.now)();
  }

  async submit(snapshot: SubmittedSnapshot, send: () => Promise<ResponseLike>): Promise<void> {
    const attempt: Attempt = { id: ++this.seq, revision: this.revision, snapshot, timedOut: false };
    this.current = attempt;
    this.checkSeq++; // any check still in flight belongs to an older attempt
    this.emit({ type: "checking", value: false });
    this.emit({ type: "saving", value: true });
    const deadlineAt = this.now() + this.opts.deadlineMs;

    let request: Promise<ResponseLike>;
    try {
      request = send();
    } catch {
      // Thrown before anything was sent, so nothing can have been added.
      this.hadUnknown = true;
      if (this.current === attempt) {
        this.emit({ type: "unknown", reason: "network" });
        this.emit({ type: "saving", value: false });
      }
      return;
    }

    let res: ResponseLike;
    try {
      const race = await waitAtMost(request, this.opts.deadlineMs);
      if (!race.settled) {
        attempt.timedOut = true;
        this.pending++;
        this.finishUnknown(attempt, "timeout");
        request.then(
          async (late) => {
            const answer = await readSaveAnswer(late, this.opts.deadlineMs);
            this.pending--;
            this.apply(attempt, answer);
          },
          () => {
            // The late connection failed: no answer will ever settle it.
            this.pending--;
            this.markUnresolved(attempt);
          }
        );
        return;
      }
      res = race.value;
    } catch {
      this.finishUnknown(attempt, "network");
      return;
    }

    // Headers arrived in time; an error body gets only what's left.
    const answer = await readSaveAnswer(res, deadlineAt - this.now());
    try {
      this.apply(attempt, answer);
    } finally {
      // Even if a handler throws, the form must not stay locked.
      if (this.current === attempt) this.emit({ type: "saving", value: false });
    }
  }

  /** Read-only check of what the server shows for the current attempt. */
  async check(fetchImpl: Parameters<typeof fetchSessionRows>[0], eventId: string, fallback: SubmittedSnapshot, programId?: string) {
    const attempt = this.current;
    const snapshot = snapshotForCheck(attempt?.snapshot ?? null, fallback);
    const mine = ++this.checkSeq;
    this.emit({ type: "checking", value: true });
    const rows: CheckedRow[] | null = await fetchSessionRows(fetchImpl, eventId, snapshot.sessionId);
    if (mine !== this.checkSeq || attempt !== this.current) return; // superseded; its owner reset "checking"
    this.emit({ type: "check", result: interpretSaveCheck(snapshot, programId, rows), snapshot });
    this.emit({ type: "checking", value: false });
  }

  /** A create whose commit can no longer be confirmed either way. */
  private markUnresolved(attempt: Attempt) {
    if (attempt.snapshot.version === undefined) this.unresolved++;
  }

  private finishUnknown(attempt: Attempt, reason: "timeout" | "network") {
    // A timeout is still transport-pending; a network failure is final.
    if (reason === "network") this.markUnresolved(attempt);
    if (this.current !== attempt) return;
    this.hadUnknown = true;
    this.emit({ type: "unknown", reason });
    this.emit({ type: "saving", value: false });
  }

  private apply(attempt: Attempt, answer: SaveAnswer) {
    // Decided now, after every await — not when the answer started arriving.
    const mode: ResponseMode = attempt !== this.current ? "earlier" : attempt.timedOut ? "late" : "current";
    const earlierUnresolved = this.unresolved;
    const kind = classifySaveResponse(answer, mode, {
      pending: this.pending,
      earlierSaved: this.earlierSaved,
      unresolved: this.unresolved,
      hadUnknown: this.hadUnknown,
    });
    if (kind === "earlier-accepted") this.earlierSaved++;
    if (kind === "unknown-server-error") this.hadUnknown = true;
    // A 5xx leaves this attempt's commit unknown for good (an earlier one
    // too). Counted after classifying, so an answer never warns about itself.
    if (!answer.ok && answer.status >= 500) this.markUnresolved(attempt);
    this.emit({
      type: "answer",
      kind,
      mode,
      status: answer.status,
      fieldErrors: answer.fieldErrors,
      bodyTimedOut: answer.bodyTimedOut,
      revisionMatches: this.revision === attempt.revision,
      snapshot: attempt.snapshot,
      earlierUnresolved,
    });
  }
}
