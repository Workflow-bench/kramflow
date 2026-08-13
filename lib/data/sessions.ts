// DB row <-> app-shape mapping, plus the query used to fetch everything.
// Works with either the admin (service-role) or browser (anon) Supabase
// client — both expose the same `.from(...).select(...)` surface, and reads
// are public per supabase/schema.sql's RLS policies. This replaces the old
// static `lib/cuesheet.ts` import; see docs/ARCHITECTURE.md for why the
// swap is contained to this file plus lib/use-sessions.ts.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Partition, Program, Session } from "@/lib/types";
import { computeScheduledTimes } from "@/lib/schedule";

interface ProgramRow {
  id: string;
  sort_order: number;
  session_id: string;
  section_label: string | null;
  partition_id: string | null;
  type: "item" | "break";
  name: string;
  description: string | null;
  presenter: string | null;
  presenter_requirement: string | null;
  presenter_contact: string | null;
  duration: number;
  start_time: string | null;
  end_time: string | null;
  time_is_computed: boolean;
  audio_mics: boolean;
  audio_track: boolean;
  video_sidescreen: "none" | "slides" | "live_feed";
  backdrop: boolean;
  video_ppt_needed: boolean;
  hall_lights: string | null;
  stage_lights: string | null;
  camera_angle: string | null;
  props: string | null;
  curtains: "open" | "closed" | null;
  remarks: string | null;
  status: "confirmed" | "draft" | "cut" | "tbd";
  color_tag: string | null;
  auditorium_id: string | null;
}

interface PartitionRow {
  id: string;
  session_id: string;
  label: string;
  sort_order: number;
  start_time: string | null;
}

interface SessionRow {
  id: string;
  sheet_name: string;
  event_name: string;
  day_label: string;
  session_label: string;
  sort_order: number;
}

export function mapProgramRow(row: ProgramRow): Program {
  return {
    id: row.id,
    order: row.sort_order,
    type: row.type,
    title: row.name,
    // kicker/itemCode/team have no column in the current schema (dropped
    // when the schema was redefined around the user's fixed field list) —
    // kept on the Program type as legacy-null until any surface needs them
    // reinstated.
    kicker: null,
    itemCode: null,
    presenter: row.presenter,
    presenterRequirement: row.presenter_requirement,
    presenterContact: row.presenter_contact,
    sectionLabel: row.section_label,
    partitionId: row.partition_id,
    scheduledStart: row.start_time,
    scheduledEnd: row.end_time,
    timeIsComputed: row.time_is_computed,
    durationMinutes: row.duration,
    audio: { mic: row.audio_mics, track: row.audio_track },
    video: { sidescreen: row.video_sidescreen, backdrop: row.backdrop, pptSide: row.video_ppt_needed },
    lights: { hall: row.hall_lights, stage: row.stage_lights },
    cameraAngle: row.camera_angle,
    props: row.props,
    curtains: row.curtains,
    // Temporary stand-in until Phase 3 replaces the Green Room's
    // stageNotes-driven "Entrance" section with the props-handling panel —
    // `description` is the closest existing column with the same intent.
    stageNotes: row.description,
    team: null,
    notes: row.remarks,
    status: row.status,
    colorTag: row.color_tag,
    auditoriumId: row.auditorium_id,
  };
}

export function mapPartitionRow(row: PartitionRow): Partition {
  return {
    id: row.id,
    sessionId: row.session_id,
    label: row.label,
    sortOrder: row.sort_order,
    startTime: row.start_time,
  };
}

function mapSessionRow(row: SessionRow, items: Program[], partitions: Partition[]): Session {
  return {
    id: row.id,
    sheetName: row.sheet_name,
    eventName: row.event_name,
    dayLabel: row.day_label,
    sessionLabel: row.session_label,
    items,
    partitions,
  };
}

export async function fetchSessions(client: SupabaseClient): Promise<Session[]> {
  const [
    { data: sessionRows, error: sessionsError },
    { data: programRows, error: programsError },
    { data: partitionRows, error: partitionsError },
  ] = await Promise.all([
    client.from("sessions").select("*").order("sort_order", { ascending: true }),
    client.from("programs").select("*").order("sort_order", { ascending: true }),
    client.from("partitions").select("*").order("sort_order", { ascending: true }),
  ]);

  if (sessionsError) throw sessionsError;
  if (programsError) throw programsError;
  if (partitionsError) throw partitionsError;

  const itemsBySession = new Map<string, Program[]>();
  for (const row of (programRows ?? []) as ProgramRow[]) {
    const list = itemsBySession.get(row.session_id) ?? [];
    list.push(mapProgramRow(row));
    itemsBySession.set(row.session_id, list);
  }

  const partitionsBySession = new Map<string, Partition[]>();
  for (const row of (partitionRows ?? []) as PartitionRow[]) {
    const list = partitionsBySession.get(row.session_id) ?? [];
    list.push(mapPartitionRow(row));
    partitionsBySession.set(row.session_id, list);
  }

  // Item 6b's cascade is applied here, once, centrally — every consumer
  // (av/general/green-room pages, the display-engine timeline, the cue
  // sheet itself) reads scheduledStart/scheduledEnd off Program already
  // resolved, so there's no separate "recompute" step any caller could
  // forget to trigger after a duration/order change.
  for (const [sessionId, items] of itemsBySession) {
    const partitions = partitionsBySession.get(sessionId) ?? [];
    if (partitions.length === 0) continue;
    const partitionById = new Map(partitions.map((p) => [p.id, p]));
    const byPartition = new Map<string, Program[]>();
    for (const item of items) {
      if (!item.partitionId) continue;
      const list = byPartition.get(item.partitionId) ?? [];
      list.push(item);
      byPartition.set(item.partitionId, list);
    }
    const computedById = new Map<string, Program>();
    for (const [partitionId, groupItems] of byPartition) {
      const partition = partitionById.get(partitionId);
      if (!partition) continue;
      for (const computed of computeScheduledTimes(partition, groupItems)) {
        computedById.set(computed.id, computed);
      }
    }
    itemsBySession.set(
      sessionId,
      items.map((item) => computedById.get(item.id) ?? item)
    );
  }

  return ((sessionRows ?? []) as SessionRow[]).map((row) =>
    mapSessionRow(row, itemsBySession.get(row.id) ?? [], partitionsBySession.get(row.id) ?? [])
  );
}

export function getSessionById(sessions: Session[], id: string): Session | undefined {
  return sessions.find((s) => s.id === id);
}
