import { z } from "zod";
import { COLOR_TAG_VALUES } from "@/lib/color-tags";

// Single source of truth for the programs table's fixed column list (see
// supabase/schema.sql and the restructure plan's "Data model" section).
// Used by: the ad-hoc entry form (components/forms/program-form.tsx), the
// Excel upload route (app/api/cue-sheet/upload/route.ts), and the programs
// CRUD API (app/api/programs/*) — one schema, so the column list can never
// drift between the three entry points.

const nullableString = z.string().trim().min(1).nullable().optional();

export const programInputSchema = z.object({
  sortOrder: z.number().int().min(0).optional(),
  sessionId: z.string().min(1, "Session is required"),
  sectionLabel: nullableString,
  partitionId: z.string().uuid().nullable().optional(),
  type: z.enum(["item", "break"]).default("item"),
  name: z.string().trim().min(1, "Name is required"),
  description: nullableString,
  presenter: nullableString,
  presenterRequirement: nullableString,
  presenterContact: nullableString,
  duration: z.number().int().min(0, "Duration can't be negative").default(0),
  startTime: nullableString,
  endTime: nullableString,
  timeIsComputed: z.boolean().default(false),
  audioMics: z.boolean().default(false),
  audioTrack: z.boolean().default(false),
  videoSidescreen: z.enum(["none", "slides", "live_feed"]).default("none"),
  backdrop: z.boolean().default(false),
  videoPptNeeded: z.boolean().default(false),
  hallLights: nullableString,
  stageLights: nullableString,
  cameraAngle: nullableString,
  props: nullableString,
  curtains: z.enum(["open", "closed"]).nullable().optional(),
  remarks: nullableString,
  status: z.enum(["confirmed", "draft", "cut", "tbd"]).default("confirmed"),
  colorTag: z.enum(COLOR_TAG_VALUES).nullable().optional(),
  auditoriumId: z.string().uuid().nullable().optional(),
});

export type ProgramInput = z.infer<typeof programInputSchema>;

export const programUpdateSchema = programInputSchema.partial().extend({
  sessionId: z.string().min(1).optional(),
  name: z.string().trim().min(1).optional(),
});

export type ProgramUpdate = z.infer<typeof programUpdateSchema>;

// camelCase (app/form shape) -> snake_case (DB column) — the API routes
// write this shape directly to Supabase.
export function toProgramRow(input: Partial<ProgramInput>) {
  const row: Record<string, unknown> = {};
  if (input.sortOrder !== undefined) row.sort_order = input.sortOrder;
  if (input.sessionId !== undefined) row.session_id = input.sessionId;
  if (input.sectionLabel !== undefined) row.section_label = input.sectionLabel;
  if (input.partitionId !== undefined) row.partition_id = input.partitionId;
  if (input.type !== undefined) row.type = input.type;
  if (input.name !== undefined) row.name = input.name;
  if (input.description !== undefined) row.description = input.description;
  if (input.presenter !== undefined) row.presenter = input.presenter;
  if (input.presenterRequirement !== undefined) row.presenter_requirement = input.presenterRequirement;
  if (input.presenterContact !== undefined) row.presenter_contact = input.presenterContact;
  if (input.duration !== undefined) row.duration = input.duration;
  if (input.startTime !== undefined) row.start_time = input.startTime;
  if (input.endTime !== undefined) row.end_time = input.endTime;
  if (input.timeIsComputed !== undefined) row.time_is_computed = input.timeIsComputed;
  if (input.audioMics !== undefined) row.audio_mics = input.audioMics;
  if (input.audioTrack !== undefined) row.audio_track = input.audioTrack;
  if (input.videoSidescreen !== undefined) row.video_sidescreen = input.videoSidescreen;
  if (input.backdrop !== undefined) row.backdrop = input.backdrop;
  if (input.videoPptNeeded !== undefined) row.video_ppt_needed = input.videoPptNeeded;
  if (input.hallLights !== undefined) row.hall_lights = input.hallLights;
  if (input.stageLights !== undefined) row.stage_lights = input.stageLights;
  if (input.cameraAngle !== undefined) row.camera_angle = input.cameraAngle;
  if (input.props !== undefined) row.props = input.props;
  if (input.curtains !== undefined) row.curtains = input.curtains;
  if (input.remarks !== undefined) row.remarks = input.remarks;
  if (input.status !== undefined) row.status = input.status;
  if (input.colorTag !== undefined) row.color_tag = input.colorTag;
  if (input.auditoriumId !== undefined) row.auditorium_id = input.auditoriumId;
  return row;
}

// Snake_case mirror of the same rules, for validating rows that already
// come in DB-column shape — i.e. lib/parse-cuesheet.ts's output, used by
// the Excel upload route's dry-run/commit validation. Same column list,
// same constraints as programInputSchema above; kept as a second schema
// rather than a runtime case-converter to stay simple and explicit.
export const programRowSchema = z.object({
  sort_order: z.number().int().min(0),
  session_id: z.string().min(1),
  section_label: nullableString,
  partition_id: z.string().uuid().nullable().optional(),
  type: z.enum(["item", "break"]),
  name: z.string().trim().min(1, "Name is required"),
  description: nullableString,
  presenter: nullableString,
  presenter_requirement: nullableString,
  presenter_contact: nullableString,
  duration: z.number().int().min(0, "Duration can't be negative"),
  start_time: nullableString,
  end_time: nullableString,
  audio_mics: z.boolean(),
  audio_track: z.boolean(),
  video_sidescreen: z.enum(["none", "slides", "live_feed"]),
  backdrop: z.boolean(),
  video_ppt_needed: z.boolean(),
  hall_lights: nullableString,
  stage_lights: nullableString,
  camera_angle: nullableString,
  props: nullableString,
  curtains: z.enum(["open", "closed"]).nullable().optional(),
  remarks: nullableString,
  status: z.enum(["confirmed", "draft", "cut", "tbd"]),
  color_tag: z.enum(COLOR_TAG_VALUES).nullable().optional(),
});
