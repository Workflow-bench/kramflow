// Isomorphic cue-sheet parser — takes an .xlsx file's bytes, returns rows
// shaped for the Supabase `sessions`/`programs` tables (see
// supabase/schema.sql). No `fs` calls, so this runs both from the one-time
// seed script (scripts/seed.mjs) and from the runtime upload route
// (app/api/cue-sheet/upload/route.ts, Phase 2) — one parser, one column
// mapping, per docs/DATA_MODEL.md's original column-by-header-text approach.

import * as XLSX from "xlsx";

export interface ParsedSession {
  id: string;
  sheet_name: string;
  event_name: string;
  day_label: string;
  session_label: string;
  sort_order: number;
}

// Client-generated (crypto.randomUUID()) so replace_session_programs can
// insert partitions and programs referencing them in the same call without
// a temp_id-to-real-id mapping step — see supabase/schema.sql's comment on
// that function.
export interface ParsedPartition {
  id: string;
  session_id: string;
  label: string;
  sort_order: number;
  start_time: string | null;
}

export interface ParsedProgram {
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
}

export interface ParsedCueSheet {
  sessions: ParsedSession[];
  partitions: ParsedPartition[];
  programs: ParsedProgram[];
}

function norm(s: unknown): string {
  return (s ?? "").toString().replace(/\r\n/g, " ").replace(/\s+/g, " ").trim();
}

function excelTimeToLabel(fraction: unknown): string | null {
  if (typeof fraction !== "number") return null;
  const totalMinutes = Math.round(fraction * 1440);
  let hours = Math.floor(totalMinutes / 60) % 24;
  const minutes = totalMinutes % 60;
  const period = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  if (hours === 0) hours = 12;
  return `${hours}:${String(minutes).padStart(2, "0")} ${period}`;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// A bare-label row (non-numeric "#") is either a section/day divider
// (grouping context for following items) or a real break/meal item that
// belongs in the live sequence. Classified by keyword — verified against
// every divider row in the bundled cue sheet (see docs/DATA_MODEL.md).
function isBreakLabel(text: string): boolean {
  return /break|breakfast|lunch|dinner|end of day|depart/i.test(text);
}

function isSectionLabel(text: string): boolean {
  return /^day\s+\d/i.test(text) || /section\s*\d/i.test(text) || norm(text).toLowerCase() === "conclusion";
}

// Only strips the footnote asterisk and turns hyphens into spaces — it used
// to also strip a trailing "-N"/"-N.M" counter (meant to collapse
// "Video-1"/"Video-2" into a plain "Video"), but every real "Word-N" item
// with no per-instance description text (Emcee-1..4, MC Skit-1..7, etc. —
// confirmed against the real SS26 cue sheet) is a genuinely distinct
// segment, not a repeat: stripping the number made 39 of 244 real program
// items across the weekend collapse into duplicate on-screen names with no
// way to tell them apart on the Operator/Green Room/AV/Presenter screens.
// "Video-N" rows never actually hit this fallback in practice since they
// all carry their own description text.
function prettifyItemCode(code: string): string {
  if (!code) return "";
  return norm(code)
    .replace(/[*]+$/g, "")
    .replace(/-/g, " ")
    .trim();
}

interface ColumnMap {
  order: number;
  startTime: number;
  endTime: number;
  duration: number;
  item: number;
  description: number;
  presenter: number;
  presenterRequirement: number;
  presenterContact: number;
  mic: number;
  audioTrack: number;
  sidescreen: number;
  backdrop: number;
  pptSide: number;
  hallLights: number;
  stageLights: number;
  cameraAngle: number;
  props: number;
  curtains: number;
  notes: number;
}

function resolveColumns(rows: unknown[][]): ColumnMap {
  const r1 = (rows[1] || []).map(norm);
  const r2 = (rows[2] || []).map(norm);
  const width = Math.max(r1.length, r2.length);
  const labelAt: Record<number, string> = {};
  for (let c = 0; c < width; c++) {
    labelAt[c] = r2[c] || r1[c];
  }
  const find = (...labels: string[]) => {
    for (let c = 0; c < width; c++) {
      if (labels.includes(labelAt[c])) return c;
    }
    return -1;
  };
  return {
    order: find("#"),
    startTime: find("Start Time"),
    endTime: find("End Time"),
    duration: find("Duration (Min)", "Duration"),
    item: find("Item"),
    description: find("Description"),
    presenter: find("Presenter"),
    presenterRequirement: find("Presenter Requirement"),
    presenterContact: find("Presenter Contact"),
    mic: find("Mics (wireless/ stage/podium)"),
    audioTrack: find("Audio"),
    sidescreen: find("Sidescreens"),
    backdrop: find("Backdrop"),
    pptSide: find("Side"),
    hallLights: find("Hall Lights"),
    stageLights: find("Stage/Speaker Lights"),
    cameraAngle: find("Camera Angle"),
    props: find("Props"),
    curtains: find("Curtains"),
    notes: find("Notes"),
  };
}

function parseTitleTripleAndSession(sheetName: string, titleCellRaw: unknown) {
  const lines = (titleCellRaw ?? "")
    .toString()
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const last = lines[lines.length - 1] ?? sheetName;
  const [dayLabel, sessionLabel] = last.split("|").map((s) => s.trim());
  return {
    eventName: lines[0] ?? sheetName,
    dayLabel: dayLabel ?? sheetName,
    sessionLabel: sessionLabel ?? "",
  };
}

function parseSheet(sheetName: string, sheet: XLSX.WorkSheet, sessionSortOrder: number) {
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" });
  const cols = resolveColumns(rows);
  const { eventName, dayLabel, sessionLabel } = parseTitleTripleAndSession(sheetName, rows[0]?.[0]);

  const sessionId = slugify(`${dayLabel}-${sessionLabel}`);
  const programs: ParsedProgram[] = [];
  const partitions: ParsedPartition[] = [];
  let currentSection: string | null = null;
  let currentPartitionId: string | null = null;
  let partitionOrder = 0;
  let order = 0;

  for (let i = 3; i < rows.length; i++) {
    const row = rows[i];
    const col0 = row[cols.order];

    if (typeof col0 === "number") {
      order += 1;
      const startFrac = row[cols.startTime];
      const endFrac = row[cols.endTime];
      const durFrac = row[cols.duration];
      let durationMinutes = typeof durFrac === "number" ? Math.round(durFrac * 1440) : 0;
      if (!durationMinutes && typeof startFrac === "number" && typeof endFrac === "number") {
        durationMinutes = Math.round((endFrac - startFrac) * 1440);
      }

      const itemCode = norm(row[cols.item]);
      const rawDescription = norm(row[cols.description]);
      const description = /^see notes/i.test(rawDescription) ? "" : rawDescription;
      let name = "";
      if (description.includes("|")) {
        name = description.slice(description.indexOf("|") + 1).trim();
      } else if (description) {
        name = description;
      } else {
        name = prettifyItemCode(itemCode) || "Untitled";
      }

      const sidescreenRaw = norm(row[cols.sidescreen]);
      const pptSideRaw = cols.pptSide >= 0 ? norm(row[cols.pptSide]) : "";
      const curtainRaw = cols.curtains >= 0 ? norm(row[cols.curtains]) : "";

      programs.push({
        sort_order: order,
        session_id: sessionId,
        section_label: currentSection,
        partition_id: currentPartitionId,
        type: "item",
        name,
        description: description || null,
        presenter: norm(row[cols.presenter]) || null,
        presenter_requirement: cols.presenterRequirement >= 0 ? norm(row[cols.presenterRequirement]) || null : null,
        presenter_contact: cols.presenterContact >= 0 ? norm(row[cols.presenterContact]) || null : null,
        duration: durationMinutes,
        start_time: excelTimeToLabel(startFrac),
        end_time: excelTimeToLabel(endFrac),
        audio_mics: norm(row[cols.mic]) === "Y",
        audio_track: norm(row[cols.audioTrack]) === "Y",
        video_sidescreen: sidescreenRaw === "Live Feed" ? "live_feed" : sidescreenRaw === "Y" ? "slides" : "none",
        backdrop: norm(row[cols.backdrop]) === "Y",
        video_ppt_needed: pptSideRaw.startsWith("Y"),
        hall_lights: norm(row[cols.hallLights]) || null,
        stage_lights: cols.stageLights >= 0 ? norm(row[cols.stageLights]) || null : null,
        camera_angle: cols.cameraAngle >= 0 ? norm(row[cols.cameraAngle]) || null : null,
        props: cols.props >= 0 ? norm(row[cols.props]) || null : null,
        curtains: curtainRaw === "Closed" ? "closed" : curtainRaw === "Open" ? "open" : null,
        remarks: norm(row[cols.notes]) || null,
        status: "confirmed",
        color_tag: null,
      });
      continue;
    }

    const label = norm(col0);
    if (!label || label === "Duration") continue; // footer totals row, skip entirely

    if (isBreakLabel(label)) {
      order += 1;
      const match = label.match(/\s*\[([^\]]+)\]\s*$/);
      const clean = match ? norm(label.slice(0, match.index)) : label;
      const aside = match ? match[1].trim() : null;
      programs.push({
        sort_order: order,
        session_id: sessionId,
        section_label: currentSection,
        partition_id: currentPartitionId,
        type: "break",
        name: clean,
        description: null,
        presenter: null,
        presenter_requirement: null,
        presenter_contact: null,
        duration: 0,
        start_time: null,
        end_time: null,
        audio_mics: false,
        audio_track: false,
        video_sidescreen: "none",
        backdrop: false,
        video_ppt_needed: false,
        hall_lights: null,
        stage_lights: null,
        camera_angle: null,
        props: null,
        curtains: null,
        remarks: aside,
        status: "confirmed",
        color_tag: null,
      });
    } else if (isSectionLabel(label)) {
      currentSection = label;
      partitionOrder += 1;
      currentPartitionId = crypto.randomUUID();
      partitions.push({
        id: currentPartitionId,
        session_id: sessionId,
        label,
        sort_order: partitionOrder,
        start_time: null,
      });
    }
    // Any other stray label row is ignored (defensive default).
  }

  const session: ParsedSession = {
    id: sessionId,
    sheet_name: sheetName,
    event_name: eventName,
    day_label: dayLabel,
    session_label: sessionLabel,
    sort_order: sessionSortOrder,
  };

  return { session, partitions, programs };
}

// Sanity ceilings independent of the upload route's byte-size cap — xlsx
// (SheetJS) has open, unfixed prototype-pollution/ReDoS advisories
// (GHSA-4r6h-8v6p-xvw6, GHSA-5pgg-2g8v-p4x9), and a small file can still
// declare a large in-memory sheet (a real 244-item, multi-day cue sheet is
// nowhere close to either limit). Rejecting oversized input here, before
// row-by-row parsing runs, keeps a crafted small file from doing
// disproportionate work.
const MAX_SHEETS = 50;
const MAX_ROWS_PER_SHEET = 5000;

export function parseCueSheet(buffer: Buffer | ArrayBuffer): ParsedCueSheet {
  const wb = XLSX.read(buffer, { type: "buffer" });

  if (wb.SheetNames.length > MAX_SHEETS) {
    throw new Error(`Too many sheets (${wb.SheetNames.length}). The limit is ${MAX_SHEETS}.`);
  }
  wb.SheetNames.forEach((name) => {
    const ref = wb.Sheets[name]["!ref"];
    const range = ref ? XLSX.utils.decode_range(ref) : null;
    const rowCount = range ? range.e.r - range.s.r + 1 : 0;
    if (rowCount > MAX_ROWS_PER_SHEET) {
      throw new Error(`Sheet "${name}" has too many rows (${rowCount}). The limit is ${MAX_ROWS_PER_SHEET}.`);
    }
  });

  const sessions: ParsedSession[] = [];
  const partitions: ParsedPartition[] = [];
  const programs: ParsedProgram[] = [];

  wb.SheetNames.forEach((name, i) => {
    const { session, partitions: sessionPartitions, programs: sessionPrograms } = parseSheet(name, wb.Sheets[name], i);
    sessions.push(session);
    partitions.push(...sessionPartitions);
    programs.push(...sessionPrograms);
  });

  return { sessions, partitions, programs };
}
