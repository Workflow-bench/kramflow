import { NextResponse } from "next/server";
import { requireEventAccess } from "@/lib/server/require-event-access";
import { supabaseAdmin } from "@/lib/supabase/server";
import { logActivityAs } from "@/lib/server/activity-log";
import type { Alert } from "@/lib/types";

// Single PATCH endpoint for every live-state mutation (start/next/previous/
// jumpTo/finish/togglePause/setAlert/dismissAlert/setNotes/selectSession/
// reset). One endpoint rather than one route per action because they all
// share the same "read live_state, compute next state, write it back,
// append an activity_log row" shape — see lib/store.tsx for the client
// side of this, which subscribes to Realtime rather than reading this
// route's response body directly.

interface ItemActual {
  actualStart: string | null;
  actualEnd: string | null;
}

interface LiveStateRow {
  active_session_id: string | null;
  paused_at: string | null;
  alert: Alert | null;
  progress_by_session: Record<string, { currentOrder: number | null; startedAt: string | null }>;
  notes_overrides: Record<string, string>;
  item_actuals: Record<string, ItemActual>;
  version: number;
  controller_id: string | null;
  controller_claimed_at: string | null;
}

// Sequencing actions are the ones that silently clobber another operator's
// state (Next clearing a Hold someone else just set). Alert/Notes stay
// unlocked and collaborative on purpose — they
// don't have the same "someone else's in-progress action gets erased"
// failure mode, and gating them too would make ordinary multi-operator use
// needlessly more locked-down than the bug this exists to fix.
const LOCKED_ACTIONS = new Set([
  "start",
  "next",
  "previous",
  "jumpTo",
  "finish",
  "togglePause",
  "selectSession",
  "reset",
  "resetSession",
]);

// A claim older than this is treated as abandoned — the controlling tab
// crashed, lost network, or was just closed without releasing — so it
// can't permanently lock the show. Comfortably longer than the ~15s
// heartbeat lib/store.tsx's controller renewal sends while held.
const CONTROLLER_STALE_MS = 45_000;

function isControllerActive(row: LiveStateRow): boolean {
  if (!row.controller_id || !row.controller_claimed_at) return false;
  return Date.now() - Date.parse(row.controller_claimed_at) < CONTROLLER_STALE_MS;
}

// item_actuals is keyed by programs.id (stable across reorders), but every
// action here only ever knows a *position* (currentOrder, the caller's
// max/min/order args) — resolved here, against programs.sort_order, rather
// than threading program ids through every client call site (several of
// them, e.g. components/operator/jump-control.tsx, only ever have a
// hand-typed order number, never the Program row it resolves to).
async function programIdAtOrder(
  supabase: ReturnType<typeof supabaseAdmin>,
  sessionId: string | null,
  order: number | null
): Promise<string | null> {
  if (!sessionId || order === null) return null;
  const { data } = await supabase
    .from("programs")
    .select("id")
    .eq("session_id", sessionId)
    .eq("sort_order", order)
    .maybeSingle();
  return data?.id ?? null;
}

// An item "becomes current" — overwrite actualStart, and clear any
// actualEnd left over from an earlier pass through the same item (it hasn't
// ended *this* pass yet). See live_state.item_actuals's column comment
// (migration-pilot-readiness-v2.sql) for the full semantics.
function withArrival(
  itemActuals: Record<string, ItemActual>,
  programId: string | null,
  now: string
): Record<string, ItemActual> {
  if (!programId) return itemActuals;
  return { ...itemActuals, [programId]: { actualStart: now, actualEnd: null } };
}

// Forward progress *away* from an item — stamp actualEnd, keep whatever
// actualStart this pass already recorded. Never called for previous/a
// backward jump.
function withDeparture(
  itemActuals: Record<string, ItemActual>,
  programId: string | null,
  now: string
): Record<string, ItemActual> {
  if (!programId) return itemActuals;
  const existing = itemActuals[programId];
  return { ...itemActuals, [programId]: { actualStart: existing?.actualStart ?? now, actualEnd: now } };
}

export async function PATCH(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const action = body.action;
  if (typeof action !== "string") {
    return NextResponse.json({ ok: false, error: "Missing action" }, { status: 400 });
  }

  const eventId = body.eventId;
  const auth = await requireEventAccess(typeof eventId === "string" ? eventId : null, "owner");
  if (auth instanceof NextResponse) return auth;

  const supabase = supabaseAdmin();
  const { data: row, error: fetchError } = await supabase
    .from("live_state")
    .select("*")
    .eq("event_id", auth.eventId)
    .single();
  if (fetchError) {
    return NextResponse.json({ ok: false, error: fetchError.message }, { status: 500 });
  }
  const current = row as LiveStateRow;

  const activeProgress = () =>
    current.progress_by_session[current.active_session_id ?? ""] ?? { currentOrder: null, startedAt: null };

  const clientId = typeof body.clientId === "string" ? body.clientId : null;

  // Enforced here, not just hinted at client-side — the client's own lock
  // check (components/operator/controls-panel.tsx) is a UX nicety so a
  // locked-out operator doesn't have to click-and-fail to find out; this is
  // what actually stops the R2-BUG-1 clobber if two operators' clicks land
  // close enough together to race past the client-side check.
  if (LOCKED_ACTIONS.has(action) && isControllerActive(current) && current.controller_id !== clientId) {
    return NextResponse.json({ ok: false, error: "locked", controllerId: current.controller_id }, { status: 423 });
  }

  let patch: Partial<LiveStateRow> = {};
  let detail = "";

  switch (action) {
    case "claimControl": {
      if (!clientId) return NextResponse.json({ ok: false }, { status: 400 });
      const force = body.force === true;
      if (isControllerActive(current) && current.controller_id !== clientId && !force) {
        return NextResponse.json({ ok: false, error: "locked", controllerId: current.controller_id }, { status: 423 });
      }
      patch = { controller_id: clientId, controller_claimed_at: new Date().toISOString() };
      detail = "Took control";
      break;
    }
    case "renewControl": {
      // Silent no-op if this tab doesn't (or no longer) hold the lock —
      // e.g. it raced with someone else's takeover — rather than a loud
      // failure for what's just a background heartbeat.
      if (!clientId || current.controller_id !== clientId) {
        return NextResponse.json({ ok: true, noop: true });
      }
      patch = { controller_claimed_at: new Date().toISOString() };
      break;
    }
    case "releaseControl": {
      if (!clientId || current.controller_id !== clientId) {
        return NextResponse.json({ ok: true, noop: true });
      }
      patch = { controller_id: null, controller_claimed_at: null };
      detail = "Released control";
      break;
    }
    case "selectSession": {
      const sessionId = body.sessionId;
      if (typeof sessionId !== "string") return NextResponse.json({ ok: false }, { status: 400 });
      patch = { active_session_id: sessionId, paused_at: null };
      detail = `Switched session`;
      break;
    }
    case "start": {
      const now = new Date().toISOString();
      const landingId = await programIdAtOrder(supabase, current.active_session_id, 1);
      patch = {
        progress_by_session: {
          ...current.progress_by_session,
          [current.active_session_id ?? ""]: { currentOrder: 1, startedAt: now },
        },
        paused_at: null,
        item_actuals: withArrival(current.item_actuals, landingId, now),
      };
      detail = "Started";
      break;
    }
    case "next": {
      const maxOrder = body.maxOrder;
      if (typeof maxOrder !== "number") return NextResponse.json({ ok: false }, { status: 400 });
      const { currentOrder } = activeProgress();
      if (currentOrder === null || currentOrder >= maxOrder) {
        return NextResponse.json({ ok: true, noop: true });
      }
      const now = new Date().toISOString();
      const [departureId, landingId] = await Promise.all([
        programIdAtOrder(supabase, current.active_session_id, currentOrder),
        programIdAtOrder(supabase, current.active_session_id, currentOrder + 1),
      ]);
      patch = {
        progress_by_session: {
          ...current.progress_by_session,
          [current.active_session_id ?? ""]: { currentOrder: currentOrder + 1, startedAt: now },
        },
        paused_at: null,
        item_actuals: withArrival(withDeparture(current.item_actuals, departureId, now), landingId, now),
      };
      detail = `Advanced to item ${currentOrder + 1}`;
      break;
    }
    case "previous": {
      const minOrder = body.minOrder;
      if (typeof minOrder !== "number") return NextResponse.json({ ok: false }, { status: 400 });
      const { currentOrder } = activeProgress();
      if (currentOrder === null || currentOrder <= minOrder) {
        return NextResponse.json({ ok: true, noop: true });
      }
      const now = new Date().toISOString();
      const landingId = await programIdAtOrder(supabase, current.active_session_id, currentOrder - 1);
      patch = {
        progress_by_session: {
          ...current.progress_by_session,
          [current.active_session_id ?? ""]: { currentOrder: currentOrder - 1, startedAt: now },
        },
        paused_at: null,
        // No departure write here — a rewind never stamps actualEnd on the
        // item being left. See withDeparture's doc comment.
        item_actuals: withArrival(current.item_actuals, landingId, now),
      };
      detail = `Went back to item ${currentOrder - 1}`;
      break;
    }
    case "jumpTo": {
      const order = body.order;
      const maxOrder = body.maxOrder;
      if (typeof order !== "number" || typeof maxOrder !== "number") {
        return NextResponse.json({ ok: false }, { status: 400 });
      }
      // Unlike next/previous (which no-op past a boundary a rapid double
      // click can legitimately reach), an out-of-range jump target is
      // invalid input, not a race — reject it outright rather than
      // clamping, matching what the Jump dialog's own client-side input
      // already restricts to (1..max).
      if (order < 1 || order > maxOrder) {
        return NextResponse.json({ ok: false, error: "order is out of range" }, { status: 400 });
      }
      const { currentOrder } = activeProgress();
      const now = new Date().toISOString();
      const isForward = currentOrder !== null && order > currentOrder;
      const [departureId, landingId] = await Promise.all([
        isForward ? programIdAtOrder(supabase, current.active_session_id, currentOrder) : Promise.resolve(null),
        programIdAtOrder(supabase, current.active_session_id, order),
      ]);
      let itemActuals = current.item_actuals;
      if (isForward) itemActuals = withDeparture(itemActuals, departureId, now);
      itemActuals = withArrival(itemActuals, landingId, now);
      patch = {
        progress_by_session: {
          ...current.progress_by_session,
          [current.active_session_id ?? ""]: { currentOrder: order, startedAt: now },
        },
        paused_at: null,
        item_actuals: itemActuals,
      };
      detail = `Jumped to item ${order}`;
      break;
    }
    case "finish": {
      const maxOrder = body.maxOrder;
      if (typeof maxOrder !== "number") return NextResponse.json({ ok: false }, { status: 400 });
      const now = new Date().toISOString();
      const { currentOrder } = activeProgress();
      const departureId = await programIdAtOrder(supabase, current.active_session_id, currentOrder);
      patch = {
        progress_by_session: {
          ...current.progress_by_session,
          [current.active_session_id ?? ""]: { currentOrder: maxOrder + 1, startedAt: null },
        },
        paused_at: null,
        item_actuals: withDeparture(current.item_actuals, departureId, now),
      };
      detail = "Finished session";
      break;
    }
    case "togglePause": {
      if (current.paused_at) {
        const pausedMs = Date.now() - Date.parse(current.paused_at);
        const progress = activeProgress();
        const shiftedStartedAt = progress.startedAt
          ? new Date(Date.parse(progress.startedAt) + pausedMs).toISOString()
          : null;
        patch = {
          progress_by_session: {
            ...current.progress_by_session,
            [current.active_session_id ?? ""]: { ...progress, startedAt: shiftedStartedAt },
          },
          paused_at: null,
        };
        detail = "Resumed";
      } else {
        patch = { paused_at: new Date().toISOString() };
        detail = "Hold started";
      }
      break;
    }
    case "setAlert": {
      const alert = body.alert as Alert | undefined;
      if (!alert || typeof alert.message !== "string") return NextResponse.json({ ok: false }, { status: 400 });
      patch = { alert };
      detail = `Alert: ${alert.message}`;
      break;
    }
    case "dismissAlert": {
      patch = { alert: null };
      detail = "Alert dismissed";
      break;
    }
    case "setNotes": {
      const programId = body.programId;
      const notes = body.notes;
      if (typeof programId !== "string" || typeof notes !== "string") {
        return NextResponse.json({ ok: false }, { status: 400 });
      }
      patch = { notes_overrides: { ...current.notes_overrides, [programId]: notes } };
      detail = "Notes updated";
      break;
    }
    case "reset": {
      patch = {
        active_session_id: current.active_session_id,
        progress_by_session: {},
        paused_at: null,
        alert: null,
        notes_overrides: {},
      };
      detail = "Reset";
      break;
    }
    // Session-scoped un-start — 2026-09 product-integrity pass. The
    // event-wide "reset" above was never reachable from any UI (verified
    // by grep — Presenter's own local timer Reset and Rehearsal's local
    // reset() share the label but never call this route) and, by design,
    // clears every session's progress/hold/alert/notes at once — verified
    // as a real gap during whole-rundown-projection testing, where
    // un-starting one test session had no way to avoid wiping every other
    // session's legitimate progress too.
    //
    // Scoped strictly to progress_by_session[sessionId] — removes that one
    // key, every other session's entry untouched. Deliberately does NOT
    // touch item_actuals: migration 0007_pilot_readiness_v2.sql's own
    // column comment states this exactly ("a session/rehearsal-adjacent
    // reset on the real console does not erase real timing history") —
    // this is the same established principle, just applied at session
    // scope instead of event scope, not a new one. Deliberately does NOT
    // touch notes_overrides either — stage notes are operator-authored cue
    // annotations, not progress; keyed by program id, not session, so
    // "this session's notes" isn't even a well-defined subset without a
    // second query, and conflating "restart this session's sequence" with
    // "erase notes someone wrote" would be a real, unrelated side effect
    // (the existing event-wide reset already does this, but extending
    // that specific behavior wasn't asked for and isn't reused here).
    case "resetSession": {
      const sessionId = body.sessionId;
      if (typeof sessionId !== "string") return NextResponse.json({ ok: false }, { status: 400 });
      const { data: sessionRow, error: sessionError } = await supabase
        .from("sessions")
        .select("day_label, session_label")
        .eq("id", sessionId)
        .eq("event_id", auth.eventId)
        .maybeSingle();
      if (sessionError) return NextResponse.json({ ok: false, error: sessionError.message }, { status: 500 });
      if (!sessionRow) return NextResponse.json({ ok: false, error: "Session not found" }, { status: 404 });

      const remainingProgress = { ...current.progress_by_session };
      delete remainingProgress[sessionId];
      patch = { progress_by_session: remainingProgress };
      // paused_at/alert are event-wide singleton fields, not session-
      // scoped — only clear them when the session being reset is the one
      // that's actually active right now; otherwise they belong to
      // whichever OTHER session is live and must not be touched.
      if (current.active_session_id === sessionId) {
        patch.paused_at = null;
        patch.alert = null;
      }
      detail = `Reset progress for "${sessionRow.day_label} • ${sessionRow.session_label}"`;
      break;
    }
    default:
      return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
  }

  // Optimistic concurrency: only write if `version` still matches what we
  // read at the top of this request. If another PATCH landed in between
  // (two near-simultaneous actions), this update() matches zero rows
  // instead of silently overwriting that other write — the client retries
  // once (lib/store.tsx's sendAction) rather than losing an update.
  //
  // select("*"), not select("version") — the write itself was already
  // atomic and correctly version-checked; the only gap was that this
  // route computed the authoritative next state and then threw it away,
  // so the initiating tab had nothing to apply except the boolean success
  // and had to wait for its own Realtime echo of the write it just made
  // (2026-09 blocker remediation: same-tab action acknowledgement). The
  // full updated row lets lib/store.tsx's sendAction apply it immediately
  // via the exact same mapRow() the Realtime handler already uses — one
  // mapping function, two places it gets called from, not two competing
  // implementations of "what does a live_state row mean."
  const { data: updated, error: updateError } = await supabase
    .from("live_state")
    .update({ ...patch, version: current.version + 1 })
    .eq("event_id", auth.eventId)
    .eq("version", current.version)
    .select("*");
  if (updateError) {
    return NextResponse.json({ ok: false, error: updateError.message }, { status: 500 });
  }
  if (!updated || updated.length === 0) {
    return NextResponse.json({ ok: false, error: "The live state changed. Try again." }, { status: 409 });
  }

  // renewControl's success path deliberately leaves `detail` empty — it's
  // a background heartbeat every ~15s while control is held, not a
  // meaningful audit event; logging it would spam the Activity feed
  // operators actually read with noise unrelated to the show itself.
  if (detail) {
    await logActivityAs(supabase, auth.eventId, auth.userId, action, detail);
  }
  return NextResponse.json({ ok: true, state: updated[0] });
}
