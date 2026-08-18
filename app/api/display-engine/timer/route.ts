import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { verifyDisplayAccess } from "@/lib/server/verify-display-access";

interface TimerState {
  mode: string;
  source: "auto" | "manual";
  startedAt: string | null;
  durationSeconds: number;
  pausedAt: string | null;
  adjustmentSeconds: number;
  thresholds: { yellowAt: number; orangeAt: number; redAt: number; criticalAfter: number };
}

// PATCH every timer action — still no requireAuth() (Presenter's own
// unauthenticated controls), but event_id-resolved the same way as
// display-engine/hold/route.ts — see that file's comment.
export async function PATCH(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const access = await verifyDisplayAccess(
    typeof body.token === "string" ? body.token : undefined,
    typeof body.eventId === "string" ? body.eventId : undefined
  );
  if (!access.ok) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 403 });

  const action = body.action;
  if (typeof action !== "string") {
    return NextResponse.json({ ok: false, error: "Missing action" }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const { data: row, error: fetchError } = await supabase
    .from("display_state")
    .select("timer, timer_version")
    .eq("event_id", access.eventId)
    .single();
  if (fetchError) return NextResponse.json({ ok: false, error: fetchError.message }, { status: 500 });
  const timer = row.timer as TimerState;
  const timerVersion = row.timer_version as number;

  let next: TimerState;
  switch (action) {
    case "setMode":
      next = { ...timer, mode: String(body.mode) };
      break;
    case "setSource":
      next = { ...timer, source: body.source === "manual" ? "manual" : "auto" };
      break;
    case "start":
      next = {
        ...timer,
        source: "manual",
        durationSeconds: Number(body.durationSeconds),
        adjustmentSeconds: 0,
        startedAt: new Date().toISOString(),
        pausedAt: null,
      };
      break;
    case "pause":
      if (timer.pausedAt) return NextResponse.json({ ok: true, noop: true });
      next = { ...timer, pausedAt: new Date().toISOString() };
      break;
    case "resume": {
      if (!timer.pausedAt || !timer.startedAt) {
        next = { ...timer, pausedAt: null };
        break;
      }
      const pausedMs = Date.now() - Date.parse(timer.pausedAt);
      next = { ...timer, startedAt: new Date(Date.parse(timer.startedAt) + pausedMs).toISOString(), pausedAt: null };
      break;
    }
    case "reset":
      next = { ...timer, startedAt: null, pausedAt: null, adjustmentSeconds: 0 };
      break;
    case "adjust":
      next = { ...timer, adjustmentSeconds: timer.adjustmentSeconds + Number(body.deltaSeconds) };
      break;
    case "setThresholds":
      next = { ...timer, thresholds: body.thresholds as TimerState["thresholds"] };
      break;
    default:
      return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
  }

  const { data: updated, error } = await supabase
    .from("display_state")
    .update({ timer: next, timer_version: timerVersion + 1 })
    .eq("event_id", access.eventId)
    .eq("timer_version", timerVersion)
    .select("timer_version");
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  if (!updated || updated.length === 0) {
    return NextResponse.json({ ok: false, error: "Conflict — timer changed, please retry" }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
}
