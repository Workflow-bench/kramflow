"use client";

import { useEffect, useState } from "react";
import { getClientId } from "./client-id";
import type { LiveState } from "./types";

// Mirrors app/api/live/route.ts's CONTROLLER_STALE_MS — this copy only
// ever decides when the UI *shows* an unlock affordance sooner rather than
// waiting on a Realtime update that isn't coming (the controller went
// silent, so nothing will change live_state to trigger one); the server
// re-checks staleness itself on every locked action regardless of what
// this computes, so a mismatch here can't let a stale claim block someone
// or let an active one through — only make the UI briefly out of step with
// the server's own decision.
const CONTROLLER_STALE_MS = 45_000;

// Shared by every surface that drives sequencing (Operator, Remote) so
// "is the lock currently active" is computed identically everywhere,
// rather than each surface re-deriving it slightly differently.
export function useControlLock(state: Pick<LiveState, "controllerId" | "controllerClaimedAt">) {
  const [clientId] = useState(getClientId);

  // `now` is read once per render from state, not from a direct Date.now()
  // call in the render body — components/hooks must stay pure functions of
  // their props/state (React's "components and hooks must be idempotent"
  // rule), so the impure clock read happens inside the effect's interval
  // callback instead, and is stored here. Ticks every few seconds purely
  // so staleness recomputes against wall-clock time: controllerClaimedAt
  // itself doesn't change while the controller is silently gone (that's
  // the whole point: no one's renewing it), so without this the UI would
  // keep showing "locked" long after the server would already treat the
  // claim as abandoned and let someone else through.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(id);
  }, []);

  const controllerActive =
    state.controllerId !== null &&
    state.controllerClaimedAt !== null &&
    now - Date.parse(state.controllerClaimedAt) < CONTROLLER_STALE_MS;
  const iHaveControl = controllerActive && state.controllerId === clientId;
  const lockedByOther = controllerActive && state.controllerId !== clientId;

  return { clientId, iHaveControl, lockedByOther };
}
