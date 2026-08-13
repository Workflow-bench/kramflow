import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/require-auth";
import { supabaseAdmin } from "@/lib/supabase/server";
import { parseCueSheet, type ParsedPartition, type ParsedProgram, type ParsedSession } from "@/lib/parse-cuesheet";
import { programRowSchema } from "@/lib/validation/program";

// POST a .xlsx file (multipart/form-data, field name "file").
// ?dryRun=1 parses + validates without writing, returning the parsed rows
// and any validation errors for a review step (docs/USER_FLOW.md's
// "Import Excel -> Review Program" step). Without it, commits to Supabase:
// upserts sessions, replaces each affected session's programs wholesale
// (same "delete then insert" reasoning as scripts/seed.ts — the parser
// doesn't assign stable per-row ids across re-uploads).

interface RowError {
  index: number;
  name: string;
  errors: string[];
}

function validateRows(programs: ParsedProgram[]): RowError[] {
  const errors: RowError[] = [];
  programs.forEach((row, index) => {
    const result = programRowSchema.safeParse(row);
    if (!result.success) {
      errors.push({ index, name: row.name, errors: result.error.issues.map((i) => i.message) });
    }
  });
  return errors;
}

export async function POST(request: Request) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;

  const dryRun = new URL(request.url).searchParams.get("dryRun") === "1";

  let file: File | null = null;
  try {
    const formData = await request.formData();
    const entry = formData.get("file");
    if (entry instanceof File) file = entry;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid form data" }, { status: 400 });
  }

  if (!file) {
    return NextResponse.json({ ok: false, error: "No file provided" }, { status: 400 });
  }

  let parsed: { sessions: ParsedSession[]; partitions: ParsedPartition[]; programs: ParsedProgram[] };
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    parsed = parseCueSheet(buffer);
  } catch (err) {
    return NextResponse.json({ ok: false, error: `Failed to parse file: ${(err as Error).message}` }, { status: 400 });
  }

  const rowErrors = validateRows(parsed.programs);

  if (dryRun) {
    return NextResponse.json({
      ok: true,
      dryRun: true,
      sessions: parsed.sessions,
      programs: parsed.programs,
      errors: rowErrors,
    });
  }

  if (rowErrors.length > 0) {
    return NextResponse.json({ ok: false, error: "Validation failed", errors: rowErrors }, { status: 400 });
  }

  const supabase = supabaseAdmin();

  const { error: sessionsError } = await supabase.from("sessions").upsert(parsed.sessions, { onConflict: "id" });
  if (sessionsError) return NextResponse.json({ ok: false, error: sessionsError.message }, { status: 500 });

  // Atomic: replace_session_programs (supabase/schema.sql) deletes and
  // re-inserts in one transaction, so a failure partway through can't leave
  // a session with zero programs — see the function's own comment.
  const sessionIds = [...new Set(parsed.programs.map((p) => p.session_id))];
  const { error: replaceError } = await supabase.rpc("replace_session_programs", {
    p_session_ids: sessionIds,
    p_partitions: parsed.partitions,
    p_programs: parsed.programs,
  });
  if (replaceError) return NextResponse.json({ ok: false, error: replaceError.message }, { status: 500 });

  await supabase.from("activity_log").insert({
    action: "cueSheetUpload",
    detail: `Uploaded ${file.name}: ${parsed.sessions.length} sessions, ${parsed.programs.length} programs`,
  });

  return NextResponse.json({
    ok: true,
    dryRun: false,
    sessionsWritten: parsed.sessions.length,
    programsWritten: parsed.programs.length,
  });
}
