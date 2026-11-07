import type { LiveState } from "./types";

// Decisions behind the Console session picker (components/operator/
// session-popover.tsx), kept free of React so they can be unit-tested in
// the node test environment.
//
// selectSession is one of lib/server/live-action.ts's LOCKED_ACTIONS: the
// server refuses it with 423 unless this tab holds an active control lease.
// The picker used to send it without checking for a lease at all, and the
// 423 was only logged to the console. On an event with no active session
// the Console shows no ControlsPanel (so no Take Control affordance) either,
// which left a fresh event with no way to choose its first session from the
// Console. These helpers make every one of those outcomes explicit.

/** True only when the active session has actually been started. A missing
 *  active session (or one with no recorded progress) is not "in progress":
 *  `undefined !== null` used to make every first selection look like it was
 *  interrupting a running show. */
export function activeSessionHasStarted(state: Pick<LiveState, "activeSessionId" | "progressBySession">): boolean {
  if (!state.activeSessionId) return false;
  const progress = state.progressBySession[state.activeSessionId];
  return progress != null && progress.currentOrder !== null;
}

export type SwitchPreflight =
  /** Send the switch now. */
  | { kind: "ready" }
  /** Viewer/editor roles can never hold the lease. */
  | { kind: "read-only" }
  /** Nobody holds control; this tab must take it before switching. */
  | { kind: "needs-control" }
  /** Another operator holds an active lease. */
  | { kind: "held-by-other" };

export function switchPreflight(input: { isOwner: boolean; iHaveControl: boolean; lockedByOther: boolean }): SwitchPreflight {
  if (!input.isOwner) return { kind: "read-only" };
  if (input.iHaveControl) return { kind: "ready" };
  if (input.lockedByOther) return { kind: "held-by-other" };
  return { kind: "needs-control" };
}

export type SwitchFailure =
  /** The server said this tab does not hold control (423). Nothing changed. */
  | { kind: "control-refused" }
  /** The server refused this account's role (403). Nothing changed. */
  | { kind: "permission-refused" }
  /** The session no longer exists for this event (404). Nothing changed. */
  | { kind: "session-missing" }
  /** The request was rejected as malformed (400). Nothing changed. */
  | { kind: "rejected" }
  /** No reply, or a server error: the switch may or may not have been
   *  written. Must not be resent automatically. */
  | { kind: "uncertain" };

/** Maps the HTTP status from lib/store.tsx's sendAction (null when the
 *  fetch itself failed) to what the operator is told. 409 never reaches
 *  here as a final answer unless sendAction's own bounded version-conflict
 *  retries ran out; a 409 is a refused write, so it is treated as one. */
export function classifySwitchFailure(status: number | null): SwitchFailure {
  switch (status) {
    case 423:
      return { kind: "control-refused" };
    case 401:
    case 403:
      return { kind: "permission-refused" };
    case 404:
      return { kind: "session-missing" };
    case 400:
    case 409:
      return { kind: "rejected" };
    default:
      return { kind: "uncertain" };
  }
}

export function switchFailureMessage(failure: SwitchFailure): string {
  switch (failure.kind) {
    case "control-refused":
      return "Not switched. You need control of the show to change the live session.";
    case "permission-refused":
      return "Not switched. Your access no longer allows changing the live session.";
    case "session-missing":
      return "Not switched. That session no longer exists. Reload to refresh the list.";
    case "rejected":
      return "Not switched. The live state changed while switching. Check the current session, then choose again.";
    case "uncertain":
      return "No confirmation from the server. The switch may not have happened. Check the session shown here before trying again.";
  }
}
