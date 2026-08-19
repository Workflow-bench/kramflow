import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { requireEventAccess } from "@/lib/server/require-event-access";
import { supabaseAdmin } from "@/lib/supabase/server";

// Report finding #28 — the cue sheet had no export path at all: an operator
// who wanted a printable/offline copy (for a stage manager without a
// laptop, or a backup before a risky bulk edit) had no way to get one. One
// workbook, one sheet per session, in the same column layout
// lib/parse-cuesheet.ts's resolveColumns() expects — so an exported file
// can be re-imported elsewhere, not just read. Viewer-tier: exporting is a
// read, not a write.

function minutesToFraction(min: number): number {
  return min / 1440;
}

// Inverse of parse-cuesheet.ts's excelTimeToLabel — turns a "9:00 AM" style
// label back into a fraction-of-a-day, so re-importing an exported file
// round-trips through the same time representation the parser expects
// rather than leaving Start/End Time blank.
function labelToFraction(label: string | null): number | null {
  if (!label) return null;
  const m = label.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return null;
  let hours = parseInt(m[1], 10) % 12;
  if (m[3].toUpperCase() === "PM") hours += 12;
  const minutes = parseInt(m[2], 10);
  return (hours * 60 + minutes) / 1440;
}

const HEADERS = [
  "#",
  "Start Time",
  "End Time",
  "Duration (Min)",
  "Item",
  "Description",
  "Presenter",
  "Presenter Requirement",
  "Presenter Contact",
  "Mics (wireless/ stage/podium)",
  "Audio",
  "Sidescreens",
  "Backdrop",
  "Side",
  "Hall Lights",
  "Stage/Speaker Lights",
  "Camera Angle",
  "Props",
  "Curtains",
  "Notes",
];

interface ProgramRow {
  sort_order: number;
  session_id: string;
  section_label: string | null;
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
}

interface SessionRow {
  id: string;
  sheet_name: string;
  event_name: string;
  day_label: string;
  session_label: string;
  sort_order: number;
}

function buildSheet(session: SessionRow, programs: ProgramRow[]): XLSX.WorkSheet {
  const rows: unknown[][] = [];
  rows.push([`${session.event_name}\n${session.day_label} | ${session.session_label}`]);
  rows.push([]);
  rows.push(HEADERS);

  let lastSection: string | null | undefined = undefined;
  for (const p of programs) {
    if (p.section_label !== lastSection) {
      if (p.section_label) rows.push([p.section_label]);
      lastSection = p.section_label;
    }
    if (p.type === "break") {
      rows.push([p.name + (p.remarks ? ` [${p.remarks}]` : "")]);
      continue;
    }
    rows.push([
      p.sort_order,
      labelToFraction(p.start_time),
      labelToFraction(p.end_time),
      minutesToFraction(p.duration),
      // The name goes in Description, not Item — parse-cuesheet.ts's
      // resolveColumns() treats Item as a short raw code (subject to
      // prettifyItemCode's hyphen-to-space rewrite) and only falls back to
      // it when Description is empty. Writing the name here instead means
      // a name re-imported from an exported file comes back byte-for-byte,
      // rather than getting run through code-prettifying it was never
      // meant for.
      "",
      p.name,
      p.presenter ?? "",
      p.presenter_requirement ?? "",
      p.presenter_contact ?? "",
      p.audio_mics ? "Y" : "",
      p.audio_track ? "Y" : "",
      p.video_sidescreen === "live_feed" ? "Live Feed" : p.video_sidescreen === "slides" ? "Y" : "",
      p.backdrop ? "Y" : "",
      p.video_ppt_needed ? "Y" : "",
      p.hall_lights ?? "",
      p.stage_lights ?? "",
      p.camera_angle ?? "",
      p.props ?? "",
      p.curtains === "closed" ? "Closed" : p.curtains === "open" ? "Open" : "",
      p.remarks ?? "",
    ]);
  }

  const sheet = XLSX.utils.aoa_to_sheet(rows);
  const timeCols = [1, 2, 3];
  for (let r = 3; r < rows.length; r++) {
    for (const c of timeCols) {
      const ref = XLSX.utils.encode_cell({ r, c });
      if (sheet[ref] && typeof sheet[ref].v === "number") sheet[ref].z = "h:mm AM/PM";
    }
  }
  return sheet;
}

export async function GET(request: Request) {
  const eventId = new URL(request.url).searchParams.get("eventId");
  const auth = await requireEventAccess(eventId, "viewer");
  if (auth instanceof NextResponse) return auth;

  const supabase = supabaseAdmin();
  const [{ data: sessions, error: sessionsError }, { data: programs, error: programsError }] = await Promise.all([
    supabase.from("sessions").select("*").eq("event_id", auth.eventId).order("sort_order", { ascending: true }),
    supabase.from("programs").select("*").eq("event_id", auth.eventId).order("sort_order", { ascending: true }),
  ]);
  if (sessionsError) return NextResponse.json({ ok: false, error: sessionsError.message }, { status: 500 });
  if (programsError) return NextResponse.json({ ok: false, error: programsError.message }, { status: 500 });
  if (!sessions || sessions.length === 0) {
    return NextResponse.json({ ok: false, error: "This event has no sessions to export." }, { status: 400 });
  }

  const wb = XLSX.utils.book_new();
  const usedNames = new Set<string>();
  for (const session of sessions as SessionRow[]) {
    const sessionPrograms = (programs as ProgramRow[]).filter((p) => p.session_id === session.id);
    let name = (session.sheet_name || `${session.day_label} ${session.session_label}`).slice(0, 31) || session.id;
    // Sheet names must be unique within a workbook — truncation to 31 chars
    // (the xlsx hard limit) can collide two distinct sessions onto the same
    // name, so disambiguate with a numeric suffix rather than silently
    // overwriting one session's sheet with another's.
    let suffix = 2;
    while (usedNames.has(name)) {
      const base = name.slice(0, 28);
      name = `${base}~${suffix++}`;
    }
    usedNames.add(name);
    XLSX.utils.book_append_sheet(wb, buildSheet(session, sessionPrograms), name);
  }

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  const filename = `cue-sheet-${new Date().toISOString().slice(0, 10)}.xlsx`;
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
