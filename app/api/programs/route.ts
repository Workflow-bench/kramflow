import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/require-auth";
import { supabaseAdmin } from "@/lib/supabase/server";
import { programInputSchema, toProgramRow } from "@/lib/validation/program";

export async function GET(request: Request) {
  const sessionId = new URL(request.url).searchParams.get("sessionId");
  const supabase = supabaseAdmin();
  let query = supabase.from("programs").select("*").order("sort_order", { ascending: true });
  if (sessionId) query = query.eq("session_id", sessionId);
  const { data, error } = await query;
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, programs: data });
}

export async function POST(request: Request) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = programInputSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, errors: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const row = toProgramRow(parsed.data);

  // Atomic: computing "next sort_order" and inserting used to be two
  // separate round trips, which could collide when two "Add item" requests
  // landed close together (see supabase/schema.sql's insert_program_at_end
  // for the race and the pg_advisory_xact_lock fix).
  const { data, error } = await supabase.rpc("insert_program_at_end", {
    p_session_id: parsed.data.sessionId,
    p_sort_order: parsed.data.sortOrder ?? null,
    p_section_label: row.section_label ?? null,
    p_type: row.type,
    p_name: row.name,
    p_description: row.description ?? null,
    p_presenter: row.presenter ?? null,
    p_presenter_requirement: row.presenter_requirement ?? null,
    p_presenter_contact: row.presenter_contact ?? null,
    p_duration: row.duration,
    p_start_time: row.start_time ?? null,
    p_end_time: row.end_time ?? null,
    p_audio_mics: row.audio_mics,
    p_audio_track: row.audio_track,
    p_video_sidescreen: row.video_sidescreen,
    p_backdrop: row.backdrop,
    p_video_ppt_needed: row.video_ppt_needed,
    p_hall_lights: row.hall_lights ?? null,
    p_stage_lights: row.stage_lights ?? null,
    p_camera_angle: row.camera_angle ?? null,
    p_props: row.props ?? null,
    p_curtains: row.curtains ?? null,
    p_remarks: row.remarks ?? null,
    p_status: row.status,
    p_color_tag: row.color_tag ?? null,
  });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, program: Array.isArray(data) ? data[0] : data });
}
