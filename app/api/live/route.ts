import { NextResponse } from "next/server";
import { requireEventAccess } from "@/lib/server/require-event-access";
import { supabaseAdmin } from "@/lib/supabase/server";
import type { Alert } from "@/lib/types";

// Single PATCH endpoint for every live-state mutation (start/next/previous/
// jumpTo/finish/togglePause/setAlert/dismissAlert/setNotes/selectSession/
// reset). One endpoint rather than one route per action because they all
// share the same "read live_state, compute next state, write it back,
// append an activity_log row" shape — see lib/store.tsx for the client
// side of this, which subscribes to Realtime rather than reading this
// route's response body directly.

interface LiveStateRow {
  active_session_id: string | null;
  paused_at: string | null;
  alert: Alert | null;
  progress_by_session: Record<string, { currentOrder: number | null; startedAt: string | null }>;
  notes_overrides: Record<string, string>;
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
const LOCKED_ACTIONS = new Set(["start", "next", "previous", "jumpTo", "finish", "togglePause", "selectSession"]);

// A claim older than this is treated as abandoned — the controlling tab
// crashed, lost network, or was just closed without releasing — so it
// can't permanently lock the show. Comfortably longer than the ~15s
// heartbeat lib/store.tsx's controller renewal sends while held.
const CONTROLLER_STALE_MS = 45_000;

function isControllerActive(row: LiveStateRow): boolean {
  if (!row.controller_id || !row.controller_claimed_at) return false;
  return Date.now() - Date.parse(row.controller_claimed_at) < CONTROLLER_STALE_MS;
}

async function logActivity(eventId: string, action: string, detail: string) {
  const supabase = supabaseAdmin();
  const { error } = await supabase.from("activity_log").insert({ event_id: eventId, action, detail });
  if (error) console.error("[api/live] activity_log insert failed:", error);
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
      patch = {
        progress_by_session: {
          ...current.progress_by_session,
          [current.active_session_id ?? ""]: { currentOrder: 1, startedAt: new Date().toISOString() },
        },
        paused_at: null,
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
      patch = {
        progress_by_session: {
          ...current.progress_by_session,
          [current.active_session_id ?? ""]: { currentOrder: currentOrder + 1, startedAt: new Date().toISOString() },
        },
        paused_at: null,
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
      patch = {
        progress_by_session: {
          ...current.progress_by_session,
          [current.active_session_id ?? ""]: { currentOrder: currentOrder - 1, startedAt: new Date().toISOString() },
        },
        paused_at: null,
      };
      detail = `Went back to item ${currentOrder - 1}`;
      break;
    }
    case "jumpTo": {
      const order = body.order;
      if (typeof order !== "number") return NextResponse.json({ ok: false }, { status: 400 });
      patch = {
        progress_by_session: {
          ...current.progress_by_session,
          [current.active_session_id ?? ""]: { currentOrder: order, startedAt: new Date().toISOString() },
        },
        paused_at: null,
      };
      detail = `Jumped to item ${order}`;
      break;
    }
    case "finish": {
      const maxOrder = body.maxOrder;
      if (typeof maxOrder !== "number") return NextResponse.json({ ok: false }, { status: 400 });
      patch = {
        progress_by_session: {
          ...current.progress_by_session,
          [current.active_session_id ?? ""]: { currentOrder: maxOrder + 1, startedAt: null },
        },
        paused_at: null,
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
    default:
      return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
  }

  // Optimistic concurrency: only write if `version` still matches what we
  // read at the top of this request. If another PATCH landed in between
  // (two near-simultaneous actions), this update() matches zero rows
  // instead of silently overwriting that other write — the client retries
  // once (lib/store.tsx's sendAction) rather than losing an update.
  const { data: updated, error: updateError } = await supabase
    .from("live_state")
    .update({ ...patch, version: current.version + 1 })
    .eq("event_id", auth.eventId)
    .eq("version", current.version)
    .select("version");
  if (updateError) {
    return NextResponse.json({ ok: false, error: updateError.message }, { status: 500 });
  }
  if (!updated || updated.length === 0) {
    return NextResponse.json({ ok: false, error: "Conflict — live state changed, please retry" }, { status: 409 });
  }

  // renewControl's success path deliberately leaves `detail` empty — it's
  // a background heartbeat every ~15s while control is held, not a
  // meaningful audit event; logging it would spam the Activity feed
  // operators actually read with noise unrelated to the show itself.
  if (detail) await logActivity(auth.eventId, action, detail);
  return NextResponse.json({ ok: true });
}
