import "server-only";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/server";
import type { ParsedCueSheet, ParsedProgram } from "@/lib/parse-cuesheet";
import { programRowSchema } from "@/lib/validation/program";

// The write half of a cue-sheet import, shared by the Excel upload route and
// the AI import's confirm step so both replace sessions the same way (one
// transaction via replace_session_programs) and log the same activity row.

export interface RowError {
  index: number;
  name: string;
  errors: string[];
}

export function validateRows(programs: ParsedProgram[]): RowError[] {
  const errors: RowError[] = [];
  programs.forEach((row, index) => {
    const result = programRowSchema.safeParse(row);
    if (!result.success) {
      errors.push({ index, name: row.name, errors: result.error.issues.map((i) => i.message) });
    }
  });
  return errors;
}

// Same ceilings lib/parse-cuesheet.ts applies to an uploaded workbook, for
// the AI confirm step, where the payload comes from the browser rather than
// a parsed file.
export const MAX_SESSIONS = 50;
export const MAX_PROGRAMS = 5000;

export const parsedCueSheetSchema = z.object({
  sessions: z
    .array(
      z.object({
        id: z.string().min(1),
        sheet_name: z.string(),
        event_name: z.string(),
        day_label: z.string(),
        session_label: z.string(),
        sort_order: z.number().int().min(0),
      })
    )
    .max(MAX_SESSIONS),
  partitions: z.array(
    z.object({
      id: z.string().uuid(),
      session_id: z.string().min(1),
      label: z.string().min(1),
      sort_order: z.number().int().min(0),
      start_time: z.string().nullable(),
    })
  ),
  programs: z.array(programRowSchema).max(MAX_PROGRAMS),
});

// Cross-references the schema can't express: every row must point at a
// session (and partition) that is actually part of this payload, and no two
// rows in a session may share a sort_order (the table's unique constraint).
export function checkCueSheetIntegrity(sheet: ParsedCueSheet): string | null {
  const sessionIds = new Set(sheet.sessions.map((s) => s.id));
  if (sessionIds.size !== sheet.sessions.length) return "Duplicate session ids.";
  const partitionSession = new Map(sheet.partitions.map((p) => [p.id, p.session_id]));
  if (partitionSession.size !== sheet.partitions.length) return "Duplicate section ids.";
  for (const p of sheet.partitions) {
    if (!sessionIds.has(p.session_id)) return "A section points at an unknown session.";
  }
  const seen = new Set<string>();
  for (const row of sheet.programs) {
    if (!sessionIds.has(row.session_id)) return "An item points at an unknown session.";
    if (row.partition_id && partitionSession.get(row.partition_id) !== row.session_id) {
      return "An item points at a section from a different session.";
    }
    const key = `${row.session_id}:${row.sort_order}`;
    if (seen.has(key)) return "Two items in a session share the same position.";
    seen.add(key);
  }
  return null;
}

export type CommitResult =
  | { ok: true; sessionsWritten: number; programsWritten: number }
  | { ok: false; status: number; error: string };

// One database call, one transaction: import_cue_sheet (migration
// 20260930000000) upserts sessions, clears every affected session's programs
// and partitions (including sessions the file leaves empty), and inserts the
// new rows. A failure at any step rolls the whole import back. The database
// enforces the tenant check using actorId; errors are logged here and returned
// to the client generically.
export async function commitCueSheet(eventId: string, actorId: string, sheet: ParsedCueSheet): Promise<CommitResult> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase.rpc("import_cue_sheet", {
    p_event_id: eventId,
    p_actor_id: actorId,
    p_sessions: sheet.sessions,
    p_partitions: sheet.partitions,
    p_programs: sheet.programs,
  });
  if (error) {
    console.error("[cue-sheet import] rpc failed:", error.message);
    if (error.code === "42501") return { ok: false, status: 403, error: "Not allowed to import into this event." };
    return { ok: false, status: 500, error: "Import failed. Nothing was changed. Try again." };
  }
  const counts = data as { sessionsWritten: number; programsWritten: number };
  return { ok: true, sessionsWritten: counts.sessionsWritten, programsWritten: counts.programsWritten };
}
