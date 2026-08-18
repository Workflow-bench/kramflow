import { NextResponse } from "next/server";
import { requireEventOwner } from "@/lib/server/require-event-owner";
import { supabaseAdmin } from "@/lib/supabase/server";
import { programInputSchema, toProgramRow } from "@/lib/validation/program";
import { mapProgramRow, mapPartitionRow } from "@/lib/data/sessions";
import { computeScheduledTimes } from "@/lib/schedule";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const eventId = url.searchParams.get("eventId");
  const sessionId = url.searchParams.get("sessionId");
  const auth = await requireEventOwner(eventId);
  if (auth instanceof NextResponse) return auth;

  const supabase = supabaseAdmin();
  let query = supabase.from("programs").select("*").eq("event_id", auth.eventId).order("sort_order", { ascending: true });
  if (sessionId) query = query.eq("session_id", sessionId);
  const { data, error } = await query;
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  // Same cascade the read-only display surfaces get via lib/data/sessions.ts's
  // fetchSessions — applied here too so the cue sheet editor itself (which
  // reads programs through this route, not fetchSessions) shows live
  // computed times rather than whatever was last written to the row.
  let partitionQuery = supabase.from("partitions").select("*").eq("event_id", auth.eventId);
  if (sessionId) partitionQuery = partitionQuery.eq("session_id", sessionId);
  const { data: partitionRows, error: partitionsError } = await partitionQuery;
  if (partitionsError) return NextResponse.json({ ok: false, error: partitionsError.message }, { status: 500 });

  const rows = data ?? [];
  const partitions = (partitionRows ?? []).map(mapPartitionRow);
  const partitionById = new Map(partitions.map((p) => [p.id, p]));
  const byPartition = new Map<string, ReturnType<typeof mapProgramRow>[]>();
  for (const row of rows) {
    if (!row.partition_id) continue;
    const list = byPartition.get(row.partition_id) ?? [];
    list.push(mapProgramRow(row));
    byPartition.set(row.partition_id, list);
  }
  const computedTimesById = new Map<string, { start: string | null; end: string | null }>();
  for (const [partitionId, items] of byPartition) {
    const partition = partitionById.get(partitionId);
    if (!partition) continue;
    for (const item of computeScheduledTimes(partition, items)) {
      computedTimesById.set(item.id, { start: item.scheduledStart, end: item.scheduledEnd });
    }
  }
  const programs = rows.map((row) => {
    const computed = computedTimesById.get(row.id);
    return computed ? { ...row, start_time: computed.start, end_time: computed.end } : row;
  });

  return NextResponse.json({ ok: true, programs });
}

export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const eventId = (json as Record<string, unknown> | null)?.eventId;
  const auth = await requireEventOwner(typeof eventId === "string" ? eventId : null);
  if (auth instanceof NextResponse) return auth;

  const parsed = programInputSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, errors: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const row = toProgramRow(parsed.data);

  // insert_program_into_partition (supabase/schema.sql) computes the
  // correct position as the end of the target partition's own contiguous
  // run and atomically shifts everything after it. p_event_id scopes the
  // whole operation (advisory lock, sort_order arithmetic, the insert
  // itself) to this one event — see the RPC's own comment.
  const { data, error } = await supabase.rpc("insert_program_into_partition", {
    p_event_id: auth.eventId,
    p_session_id: parsed.data.sessionId,
    p_partition_id: row.partition_id ?? null,
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
    p_auditorium_id: row.auditorium_id ?? null,
    p_time_is_computed: row.time_is_computed ?? false,
  });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, program: Array.isArray(data) ? data[0] : data });
}
