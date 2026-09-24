import { NextResponse } from "next/server";
import { requireEventAccess } from "@/lib/server/require-event-access";
import { aiErrorResponse, guardAi } from "@/lib/server/ai-guard";
import { runStructured } from "@/lib/server/ai";
import { supabaseAdmin } from "@/lib/supabase/server";
import { buildReviewPrompt, READINESS_REVIEW_SYSTEM, readinessReviewSchema, type ReviewItem } from "@/lib/ai/readiness-review";

const MAX_ITEMS = 1000;

// POST { eventId, sessionId } — read-only AI review of one session's stored
// cue sheet. Reads the rows itself rather than trusting a client-supplied
// copy, and drops presenter phone numbers (only whether one exists is sent).
export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  const auth = await requireEventAccess(typeof body.eventId === "string" ? body.eventId : null, "viewer");
  if (auth instanceof NextResponse) return auth;
  if (typeof body.sessionId !== "string" || !body.sessionId) {
    return NextResponse.json({ ok: false, error: "sessionId is required" }, { status: 400 });
  }

  const blocked = await guardAi(auth.userId, "readiness-review");
  if (blocked) return blocked;

  const admin = supabaseAdmin();
  const { data: session } = await admin
    .from("sessions")
    .select("day_label, session_label")
    .eq("event_id", auth.eventId)
    .eq("id", body.sessionId)
    .maybeSingle();
  if (!session) return NextResponse.json({ ok: false, error: "Session not found" }, { status: 404 });

  const { data: rows, error } = await admin
    .from("programs")
    .select(
      "sort_order, type, name, section_label, presenter, presenter_contact, duration, start_time, end_time, audio_mics, audio_track, video_sidescreen, video_ppt_needed, backdrop, remarks, presenter_requirement, status"
    )
    .eq("event_id", auth.eventId)
    .eq("session_id", body.sessionId)
    .order("sort_order", { ascending: true })
    .limit(MAX_ITEMS + 1);
  if (error) return NextResponse.json({ ok: false, error: "Couldn't load the cue sheet." }, { status: 500 });
  if (!rows || rows.length === 0) {
    return NextResponse.json({ ok: false, error: "This session has no items to review." }, { status: 422 });
  }
  if (rows.length > MAX_ITEMS) {
    return NextResponse.json({ ok: false, error: `Too many items to review at once (limit ${MAX_ITEMS}).` }, { status: 413 });
  }

  const items: ReviewItem[] = rows.map((r) => ({
    order: r.sort_order,
    type: r.type,
    name: r.name,
    section: r.section_label,
    presenter: r.presenter,
    has_presenter_contact: Boolean(r.presenter_contact),
    duration: r.duration,
    start_time: r.start_time,
    end_time: r.end_time,
    audio_mics: r.audio_mics,
    audio_track: r.audio_track,
    video_sidescreen: r.video_sidescreen,
    video_ppt_needed: r.video_ppt_needed,
    backdrop: r.backdrop,
    remarks: r.remarks,
    presenter_requirement: r.presenter_requirement,
    status: r.status,
  }));

  try {
    const review = await runStructured({
      system: READINESS_REVIEW_SYSTEM,
      prompt: buildReviewPrompt(`${session.day_label} • ${session.session_label}`, items),
      schema: readinessReviewSchema,
      maxTokens: 8000,
      effort: "medium",
    });
    const names = new Map(items.map((i) => [i.order, i.name]));
    return NextResponse.json({
      ok: true,
      summary: review.summary,
      // Model-supplied order numbers are checked against the real ones so a
      // hallucinated reference can't point at an item that isn't there.
      findings: review.findings.slice(0, 12).map((f) => ({
        severity: f.severity,
        title: f.title,
        detail: f.detail,
        items: f.item_orders.filter((o) => names.has(o)).map((o) => ({ order: o, name: names.get(o)! })),
      })),
    });
  } catch (err) {
    return aiErrorResponse(err);
  }
}
